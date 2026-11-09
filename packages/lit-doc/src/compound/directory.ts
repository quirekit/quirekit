import { ByteView } from '../binary/bytes'
import { requireDoc } from '../errors'
import type { DocReadDiagnostic } from '../types'
import type { DirectoryMember } from './types'
import { findFlatDetachedStreams } from './recovery/directory'

/**
 * Computes a simple per-code-unit uppercase key without expanding names.
 * @param name - Original directory name.
 * @returns Case-insensitive lookup identity.
 */
export function directoryNameKey(name: string): string {
  let key = ''
  for (let index = 0; index < name.length; index++) {
    const unit = name[index]!
    const upper = unit.toUpperCase()
    key += upper.length === 1 ? upper : unit
  }
  return key
}

/**
 * Traverses directory membership while retaining each stream's parent identity.
 * @param bytes - Directory stream bytes.
 * @param version - CFB major version.
 * @param inputSize - Maximum meaningful stream size allowed by this file.
 * @param mode - Complete source preflight or per-request stream-size validation.
 * @param diagnostics - Owner of bounded directory recovery decisions.
 * @returns Reachable members with the root first.
 */
export function readDirectory(bytes: Uint8Array, version: number, inputSize: number, mode: 'all' | 'requested' = 'all', diagnostics: DocReadDiagnostic[] = []): DirectoryMember[] {
  const view = new ByteView(bytes, 'invalid-cfb')
  // v3 never consumes the upper size word. A final slot with all 124 used
  // bytes retains its identity without fabricating the unused four bytes.
  const partial = mode === 'requested' && version === 3 && bytes.length % 128 >= 124
  const slots = Math.floor(bytes.length / 128) + (partial ? 1 : 0)
  const visited = new Uint8Array(slots)
  const names = new Set<string>()
  const pending = [{ id: 0, parent: -1 }]
  const members: DirectoryMember[] = []
  let deviations = partial ? 1 : 0
  let rootLinkDamaged = false, detachedAttempted = false
  /** @returns Whether one proven flat-directory batch was scheduled after the original traversal. */
  function scheduleDetached(): boolean {
    if (mode !== 'requested' || !rootLinkDamaged || detachedAttempted) return false
    detachedAttempted = true
    const detached = findFlatDetachedStreams(view, slots, visited)
    for (const id of detached) pending.push({ id, parent: 0 })
    if (detached.length) diagnostics.push({ code: 'cfb-flat-directory-recovered',
      message: `${detached.length} detached stream records are recovered after a broken root-level link. Every used non-root slot is a stream without children, so root is the only possible parent.` })
    return detached.length > 0
  }
  while (pending.length || scheduleDetached()) {
    const { id, parent } = pending.pop()!
    if (mode === 'requested' && (id >= slots || visited[id])) {
      if (parent === 0) rootLinkDamaged = true
      deviations++; continue
    }
    requireDoc(id < slots && !visited[id], 'invalid-cfb', 'Invalid or cyclic directory identity')
    visited[id] = 1
    const offset = id * 128
    // Sibling edges retain their established parent even when this member's
    // own name or type is unusable. A stream child never establishes membership.
    for (const field of [68, 72]) {
      const sibling = view.u32(offset + field)
      if (mode === 'requested' && id === 0 && sibling !== 0xffffffff) { deviations++; continue }
      requireDoc(id !== 0 || sibling === 0xffffffff, 'invalid-cfb', 'Root directory cannot have siblings')
      if (sibling !== 0xffffffff) pending.push({ id: sibling, parent })
    }
    let type = view.u8(offset + 66)
    if (mode === 'requested' && id === 0 && type !== 5) {
      type = 5
      diagnostics.push({ code: 'cfb-root-type-recovered',
        message: 'Directory slot zero identifies the root despite its damaged type field. Its actual fields and all stream ownership checks remain independently validated.' })
    }
    if (mode === 'requested' && id !== 0 && type !== 1 && type !== 2) { deviations++; continue }
    requireDoc(id === 0 ? type === 5 : type === 1 || type === 2, 'invalid-cfb', 'Invalid directory member type')
    let nameBytes = view.u16(offset + 64)
    if (mode === 'requested' && (nameBytes < 2 || nameBytes > 64 || nameBytes % 2)) {
      nameBytes = 0
      for (let index = 0; index < 64; index += 2) if (view.u16(offset + index) === 0) { nameBytes = index + 2; break }
      deviations++
    }
    if (mode === 'requested' && id !== 0 && nameBytes < 2) { deviations++; continue }
    requireDoc(nameBytes >= 2 && nameBytes <= 64 && nameBytes % 2 === 0,
      'invalid-cfb', 'Invalid directory name length or terminator')
    const terminated = view.u16(offset + nameBytes - 2) === 0
    requireDoc(mode === 'requested' || id === 0 || terminated, 'invalid-cfb', 'Invalid directory name length or terminator')
    let name = ''
    for (let index = 0; index < nameBytes - (terminated || id !== 0 ? 2 : 0); index += 2) name += String.fromCharCode(view.u16(offset + index))
    if (mode === 'requested' && id !== 0 && (!name.length || /\0/u.test(name))) { deviations++; continue }
    requireDoc(id === 0 || name.length > 0 && !/\0/u.test(name) && (mode === 'requested' || !/[/\\:!]/u.test(name)), 'invalid-cfb', 'Invalid directory name')
    if (id !== 0 && (!terminated || /[/\\:!]/u.test(name))) deviations++
    // The root is identified by slot and type, never by its historical label.
    // Ordinary stream names retain their independent parent and lookup checks.
    const rootLabelIgnored = id === 0 && (!terminated || directoryNameKey(name) !== 'ROOT ENTRY')
    const identity = `${parent}:${directoryNameKey(name)}`
    requireDoc(!names.has(identity), 'invalid-cfb', 'Duplicate directory member name')
    names.add(identity)
    // Older v3 writers left the upper size word uninitialized; it is not a 64-bit size.
    const size = type === 1 ? 0 : view.u32(offset + 120) + (version === 4 ? view.u32(offset + 124) * 2 ** 32 : 0)
    if (mode === 'all') requireDoc(Number.isSafeInteger(size) && size <= inputSize, 'invalid-cfb', 'Directory stream size exceeds physical input')
    members.push({ id, parent, name, type, size, start: view.u32(offset + 116), ...(rootLabelIgnored ? { rootLabelIgnored: true } : {}) })
    const child = view.u32(offset + 76)
    requireDoc(mode === 'requested' || type !== 2 || child === 0xffffffff, 'invalid-cfb', 'A directory stream cannot contain children')
    if (type === 2 && child !== 0xffffffff) deviations++
    if (type !== 2 && child !== 0xffffffff) pending.push({ id: child, parent: id })
  }
  if (deviations) diagnostics.push({ code: 'cfb-directory-recovered',
    message: `${deviations} invalid directory links, members or naming constraints are omitted or bounded while retaining root-reachable storage identities.` })
  return members
}
