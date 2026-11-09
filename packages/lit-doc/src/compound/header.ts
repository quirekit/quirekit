import { ByteView } from '../binary/bytes'
import { requireDoc } from '../errors'
import type { DocReadDiagnostic, DocReadLimits } from '../types'
import type { CompoundHeader } from './types'
import { chainEnd } from './allocation'

/**
 * Admits only bounded CFB v3/v4 containers, without mistaking ZIP for DOCX.
 * @param input - Stream-relative input view.
 * @param limits - Validated resource limits.
 * @param diagnostics - Owner for explicit container compatibility decisions.
 * @param recover - Whether impossible count hints may be bounded by physical storage.
 * @returns Header fields required by the allocation reader.
 */
export function readHeader(input: ByteView, limits: DocReadLimits, diagnostics: DocReadDiagnostic[], recover = false): CompoundHeader {
  requireDoc(input.bytes.length <= limits.maxInputBytes, 'limit-exceeded', 'Input byte limit exceeded')
  const signature = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]
  requireDoc(signature.every((value, index) => input.bytes[index] === value),
    'unsupported-container', 'Expected a CFB container; ZIP, RTF, and other inputs require their own readers')
  input.check(0, 512)
  const version = input.u16(26)
  requireDoc(version === 3 || version === 4, 'invalid-cfb', 'Unsupported CFB major version')
  const sectorSize = version === 3 ? 512 : 4096
  requireDoc(input.u16(30) === (version === 3 ? 9 : 12), 'invalid-cfb', 'Invalid CFB byte order or sector geometry')
  requireDoc(input.bytes.length >= 3 * sectorSize,
    'invalid-cfb', 'Container is truncated or not sector aligned')

  // Sector addresses follow the verified v3/v4 layout. Legacy fixed hints do
  // not select another byte order or mini allocator, so expose their deviation.
  const deviations = [
    ['byte order', input.u16(28) !== 0xfffe],
    ['mini-sector shift', input.u16(32) !== 6],
    ['mini-stream cutoff', input.u32(56) !== 4096],
    ['header CLSID', input.slice(8, 16).some(value => value !== 0)],
    ['reserved bytes', input.slice(34, 6).some(value => value !== 0)],
    ['header padding', input.slice(512, sectorSize - 512).some(value => value !== 0)],
  ] as const
  const fields = deviations.filter(([, changed]) => changed).map(([name]) => name)
  if (fields.length) diagnostics.push({ code: 'cfb-header-constants',
    message: `CFB fixed header fields differ (${fields.join(', ')}). The verified sector layout uses little-endian values, 64-byte mini sectors and a 4096-byte cutoff.` })
  if (input.bytes.length % sectorSize !== 0) diagnostics.push({ code: 'cfb-partial-last-sector',
    message: 'The final physical CFB sector is partial. Every copied stream range remains bounded by actual input bytes.' })

  // A partial final sector exists only while it has real bytes. Individual FAT,
  // directory and stream reads keep their original bounds and ownership checks.
  const sectorCount = Math.ceil(input.bytes.length / sectorSize) - 1
  const header = {
    version, sectorSize, sectorCount, fatCount: input.u32(44),
    directoryStart: input.u32(48), directoryCount: input.u32(40),
    miniFatStart: input.u32(60), miniFatCount: input.u32(64),
    difatStart: input.u32(68), difatCount: input.u32(72),
  }
  const countsValid = header.fatCount > 0 && header.fatCount <= sectorCount
    && header.miniFatCount <= sectorCount && header.difatCount <= sectorCount
    && (version === 3 ? header.directoryCount === 0 : header.directoryCount > 0 && header.directoryCount <= sectorCount)
  requireDoc(countsValid || recover && header.fatCount > 0, 'invalid-cfb', 'Invalid allocation counts')
  if (!countsValid) {
    diagnostics.push({ code: 'cfb-allocation-count-recovered',
      message: 'Inconsistent allocation counts are bounded by actual sectors and declared position prefixes; v3 directory count is unused.' })
    header.fatCount = Math.min(header.fatCount, sectorCount)
    header.miniFatCount = Math.min(header.miniFatCount, sectorCount)
    header.difatCount = Math.min(header.difatCount, sectorCount)
    header.directoryCount = version === 3 ? 0 : Math.min(header.directoryCount, sectorCount)
  }
  const inactive: string[] = []
  if (header.miniFatCount === 0 && header.miniFatStart !== chainEnd) {
    header.miniFatStart = chainEnd; inactive.push('MiniFAT')
  }
  if (header.difatCount === 0 && header.difatStart !== chainEnd) {
    header.difatStart = chainEnd; inactive.push('DIFAT')
  }
  if (inactive.length) diagnostics.push({ code: 'cfb-unused-allocation-pointer',
    message: `Unused ${inactive.join(' and ')} starting pointers are treated as empty chains because their declared counts are zero.` })
  return header
}
