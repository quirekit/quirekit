import { ByteView } from '../binary/bytes'
import { requireDoc } from '../errors'
import type { DocReadDiagnostic } from '../types'
import type { CompoundHeader, CompoundStorage } from './types'

export const chainEnd = 0xfffffffe
export const unusedSector = 0xffffffff

/**
 * Reads the complete FAT location map, including chained DIFAT sectors.
 * @param input - Complete container bytes.
 * @param header - Validated geometry and counts.
 * @param recover - Whether bounded allocation metadata deviations are reported.
 * @returns Allocation state with metadata sectors already owned.
 */
export function readAllocation(input: ByteView, header: CompoundHeader, recover = false): CompoundStorage {
  const diagnostics: DocReadDiagnostic[] = []
  const claimed = new Uint8Array(header.sectorCount)
  const fatIds: number[] = []
  const fatPages = new Map<number, number>()
  const difatIds: number[] = []
  let unusedPointers = 0, positionCount = 0, capacity = 0
  /**
   * Admits one FAT sector into its ordered map.
   * @param id - Physical sector identity or unused slot.
   */
  function append(id: number): void {
    const position = positionCount++
    if (id === unusedSector) return
    if (recover && (id >= claimed.length || claimed[id] || (id + 2) * header.sectorSize > input.bytes.length)) {
      diagnostics.push({ code: 'cfb-allocation-count-recovered', message: 'An unusable declared FAT position is omitted; only distinct complete physical FAT sectors are interpreted.' })
      return
    }
    requireDoc(fatIds.length < header.fatCount, 'invalid-cfb', 'DIFAT exceeds declared FAT count')
    claimSector(claimed, id)
    fatPages.set(position, id)
    capacity = (position + 1) * header.sectorSize / 4
    fatIds.push(id)
  }
  /**
   * Reads exactly the declared prefix and counts deviations in unused slots.
   * @param offset - First physical position word.
   * @param slots - Complete position area in this header or page.
   * @param used - Declared effective prefix, independent of missing entries.
   */
  function readPositions(offset: number, slots: number, used: number): void {
    for (let index = 0; index < slots; index++) {
      const id = input.u32(offset + index * 4)
      if (index < used) append(id)
      else if (id !== unusedSector) unusedPointers++
    }
  }
  const initial = Math.min(header.fatCount, 109)
  readPositions(76, 109, initial)
  let remaining = header.fatCount - initial
  let next = header.difatStart
  for (let count = 0; count < header.difatCount; count++) {
    if (recover && (next >= claimed.length || claimed[next] || (next + 2) * header.sectorSize > input.bytes.length)) break
    claimSector(claimed, next)
    difatIds.push(next)
    const offset = (next + 1) * header.sectorSize
    const slots = header.sectorSize / 4 - 1
    const used = Math.min(remaining, slots)
    readPositions(offset, slots, used)
    remaining -= used
    next = input.u32(offset + header.sectorSize - 4)
  }
  requireDoc(recover ? fatIds.length > 0 : remaining === 0 && fatIds.length === header.fatCount,
    'invalid-cfb', 'DIFAT length does not match its header')
  requireDoc(recover || capacity >= header.sectorCount, 'invalid-cfb', 'FAT does not cover the file')
  if (recover && (remaining !== 0 || fatIds.length !== header.fatCount || difatIds.length !== header.difatCount))
    diagnostics.push({ code: 'cfb-allocation-count-recovered', message: 'Available declared FAT/DIFAT positions determine the bounded allocation map despite inconsistent counts.' })
  if (capacity < header.sectorCount) diagnostics.push({ code: 'cfb-unmapped-file-tail',
    message: 'Physical file sectors beyond actual FAT capacity cannot supply allocation entries.' })

  // Missing metadata pages retain their logical FAT addresses. Compacting later
  // pages across a hole would assign their next-sector entries to other streams.
  const fat = new Uint32Array(Math.min(header.sectorCount, capacity)).fill(unusedSector)
  for (let index = 0; index < fat.length; index++) {
    const sector = fatPages.get(Math.floor(index / (header.sectorSize / 4)))
    if (sector !== undefined) fat[index] = input.u32((sector + 1) * header.sectorSize + index % (header.sectorSize / 4) * 4)
  }
  const markersValid = fatIds.every((id) => fat[id] === 0xfffffffd || fat[id] === chainEnd) && difatIds.every((id) => fat[id] === 0xfffffffc)
  requireDoc(recover || markersValid,
    'invalid-cfb', 'Allocation metadata has invalid FAT ownership markers')
  // DIFAT locations already claim every FAT sector before any stream walks.
  // A legacy self-entry terminator therefore cannot expose metadata as user data.
  const terminatedFatSectors = fatIds.filter(id => fat[id] === chainEnd).length
  if (!markersValid) diagnostics.push({ code: 'cfb-allocation-marker-recovered',
    message: 'FAT/DIFAT locations retain exclusive metadata ownership despite inconsistent self markers.' })
  if (terminatedFatSectors) diagnostics.push({
    code: 'fat-sector-end-marker',
    message: `${terminatedFatSectors} FAT sectors use ENDOFCHAIN self markers; their DIFAT locations retain exclusive metadata ownership.`,
  })
  if (unusedPointers) diagnostics.push({ code: 'cfb-unused-difat-entries',
    message: `${unusedPointers} unused DIFAT slots contain values. Only declared FAT position prefixes determine allocation metadata.` })
  if (next !== chainEnd) diagnostics.push({ code: 'cfb-unused-allocation-pointer',
    message: 'The final declared DIFAT page has an unused next pointer. The declared page count bounds traversal.' })
  return { input, header, fat, claimed, diagnostics, recover }
}

/**
 * Claims a physical or miniature allocation unit exactly once.
 * @param claimed - Occupancy map in the relevant coordinate space.
 * @param id - Allocation unit identity.
 */
export function claimSector(claimed: Uint8Array, id: number): void {
  requireDoc(id < claimed.length && claimed[id] === 0, 'invalid-cfb', 'Allocation chain is cyclic, shared, or out of bounds')
  claimed[id] = 1
}

/**
 * Validates a bounded chain before committing any allocation ownership.
 * @param table - Next-unit map.
 * @param claimed - Occupancy map for this allocator.
 * @param start - Initial unit, or end marker for an empty stream.
 * @param expected - Exact number of units when known.
 * @param maximum - Maximum traversable units.
 * @param diagnostics - Enables real-prefix recovery with explicit chain deviations.
 * @returns Units in stream order.
 */
export function walkChain(table: Uint32Array, claimed: Uint8Array, start: number,
  expected: number | undefined, maximum: number, diagnostics?: DocReadDiagnostic[]): number[] {
  const units: number[] = []
  const visited = new Set<number>()
  let next = start
  while (next !== chainEnd) {
    if (diagnostics && expected !== undefined && units.length === expected) {
      diagnostics.push({ code: 'cfb-chain-tail-ignored', message: 'Allocation links after the complete declared stream payload are ignored.' })
      break
    }
    if (diagnostics && units.length && (next >= table.length || next >= claimed.length || claimed[next] || visited.has(next))) {
      diagnostics.push({ code: 'cfb-stream-truncated', message: 'An invalid allocation continuation terminates the actual independently owned stream prefix.' })
      break
    }
    requireDoc(units.length < maximum, 'limit-exceeded', 'Allocation chain limit exceeded')
    requireDoc(expected === undefined || units.length < expected, 'invalid-cfb', 'Allocation chain is longer than declared')
    requireDoc(next < claimed.length && claimed[next] === 0 && !visited.has(next),
      'invalid-cfb', 'Allocation chain is cyclic, shared, or out of bounds')
    visited.add(next)
    units.push(next)
    requireDoc(next < table.length, 'invalid-cfb', 'Allocation unit has no next-sector entry')
    next = table[next]!
  }
  requireDoc(diagnostics !== undefined || expected === undefined || units.length === expected, 'invalid-cfb', 'Allocation chain is shorter than declared')
  if (diagnostics && expected !== undefined && units.length < expected) diagnostics.push({
    code: 'cfb-stream-truncated', message: 'The actual allocation prefix is shorter than the declared stream size.' })
  for (const unit of units) claimed[unit] = 1
  return units
}

/**
 * Copies only meaningful bytes from an already admitted normal-sector chain.
 * @param storage - Container allocation context.
 * @param chain - Verified physical sector identities.
 * @param length - Number of meaningful bytes to copy.
 * @returns Independent stream bytes.
 */
export function copyNormalStream(storage: CompoundStorage, chain: readonly number[], length: number): Uint8Array {
  if (storage.recover) {
    let actual = 0
    for (const sector of chain) {
      const available = Math.min(storage.header.sectorSize, Math.max(0, storage.input.bytes.length - (sector + 1) * storage.header.sectorSize))
      actual += available
      if (available < storage.header.sectorSize) break
    }
    if (actual < length) {
      storage.diagnostics.push({ code: 'cfb-stream-truncated', message: 'Only the contiguous actual stream bytes are retained; missing physical bytes are omitted.' })
      length = actual
    }
  }
  requireDoc(length <= chain.length * storage.header.sectorSize, 'invalid-cfb', 'Stream exceeds its allocated chain')
  const result = new Uint8Array(length)
  let offset = 0
  for (const sector of chain) {
    if (offset === length) break
    const count = Math.min(storage.header.sectorSize, length - offset)
    result.set(storage.input.slice((sector + 1) * storage.header.sectorSize, count), offset)
    offset += count
  }
  return result
}
