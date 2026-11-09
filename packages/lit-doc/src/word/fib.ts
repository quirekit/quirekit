import { ByteView } from '../binary/bytes'
import { requireDoc } from '../errors'
import type { DocReadDiagnostic, DocReadLimits, DocStoryKind, DocStoryRange } from '../types'
import type { WordHeader, WordRecordRange } from './types'

const versions = new Map<number, readonly [number, number]>([
  // Compatible Word 97 markers share its complete known locator prefix.
  // Actual counted tails still determine the effective extension's position.
  [0xc0, [93, 0]], [0xc1, [93, 0]], [0xc2, [93, 0]], [0xc3, [93, 0]],
  [0xd9, [108, 2]], [0x101, [136, 2]], [0x10c, [164, 2]], [0x112, [183, 5]],
])
const storyKinds: readonly DocStoryKind[] = ['main', 'footnote', 'header', 'comment', 'endnote', 'textbox', 'headerTextbox']
const storyFields = [3, 4, 5, 7, 8, 9, 10]

/**
 * Reads counted FIB regions without assuming that later fields share a fixed offset.
 * @param bytes - WordDocument stream.
 * @param limits - Validated resource ceilings.
 * @param recover - Whether actual known locator prefixes and stream bounds may replace stale hints.
 * @returns Versioned source locators and character intervals.
 */
export function readWordHeader(bytes: Uint8Array, limits: DocReadLimits, recover = false): WordHeader {
  const view = new ByteView(bytes, 'invalid-fib')
  view.check(0, 32)
  requireDoc(view.u16(0) === 0xa5ec, 'not-word-document', 'WordDocument does not contain a Word FIB')
  const flags = view.u16(10)
  requireDoc((flags & 0x100) === 0, 'encrypted-document', 'Encrypted or obfuscated DOC is not supported')
  const baseVersion = view.u16(2)
  requireDoc(versions.has(baseVersion) || recover && baseVersion === 0xbf, 'unsupported-version', `Unsupported DOC FIB version: ${baseVersion}`)

  // Each region owns its count. Validate before deriving the next region's address.
  const shortCount = view.u16(32)
  requireDoc(shortCount >= 14, 'invalid-fib', 'Incomplete FIB word region')
  let position = 34 + shortCount * 2
  const longCount = view.u16(position)
  requireDoc(longCount >= 22, 'invalid-fib', 'Incomplete FIB double-word region')
  const longStart = position + 2
  view.check(longStart, longCount * 4)
  position = longStart + longCount * 4
  const recordCount = view.u16(position)
  const recordStart = position + 2
  view.check(recordStart, recordCount * 8)
  position = recordStart + recordCount * 8
  const newCount = view.u16(position)
  view.check(position + 2, newCount * 2)
  const version = newCount ? view.u16(position + 2) : baseVersion
  const expected = versions.get(version)
  requireDoc(expected, 'unsupported-version', `Unsupported newer DOC FIB version: ${version}`)
  const missingExtension = newCount === 0 && expected[1] !== 0
  const complete = recordCount >= expected[0] && (newCount >= expected[1] || missingExtension)
  requireDoc(complete || recover && recordCount >= 34,
    'invalid-fib', 'FIB lengths disagree with effective version')
  const diagnostics: DocReadDiagnostic[] = missingExtension ? [{
    code: 'missing-fib-version-extension',
    message: 'The FIB omits its newer-version extension; its known base version and complete locator count agree.',
  }] : []
  if (!complete || baseVersion === 0xbf) diagnostics.push({ code: 'fib-locator-prefix-recovered',
    message: 'The known effective version is read using its actual complete locator prefix. Unavailable version-tail semantics are omitted during ordinary-text recovery.' })
  if (shortCount > 14 || longCount > 22 || recordCount > expected[0] || newCount > expected[1]) {
    diagnostics.push({ code: 'extended-fib-regions',
      message: 'The FIB contains additional counted fields; only the complete known version prefixes are interpreted.' })
  }
  const headerLength = position + 2 + newCount * 2
  let meaningfulBytes = view.u32(longStart)
  const lengthValid = meaningfulBytes >= headerLength && meaningfulBytes <= bytes.length
  requireDoc(recover || lengthValid,
    'invalid-fib', 'Meaningful WordDocument length is outside the stream')
  if (!lengthValid) {
    meaningfulBytes = bytes.length
    diagnostics.push({ code: 'fib-length-hint-ignored', message: 'The invalid cbMac hint is replaced by the actual WordDocument stream boundary; every locator and text span remains independently bounded.' })
  }
  const records: WordRecordRange[] = []
  // Later versions may append locators. Keep their bytes out of this version's authority.
  for (let index = 0; index < Math.min(expected[0], recordCount); index++) {
    records.push({ offset: view.u32(recordStart + index * 8), length: view.u32(recordStart + index * 8 + 4) })
  }

  // CP is a UTF-16 code-unit coordinate. Story boundaries never use physical bytes.
  const stories: DocStoryRange[] = []
  let end = 0
  let hasSubdocuments = false
  for (let index = 0; index < storyKinds.length; index++) {
    const count = view.u32(longStart + storyFields[index]! * 4)
    requireDoc(count <= 0x7fffffff, 'invalid-fib', 'Negative subdocument character count')
    requireDoc(count <= limits.maxTextCodeUnits - end, 'limit-exceeded', 'Text code-unit limit exceeded')
    stories.push({ kind: storyKinds[index]!, start: end, end: end + count })
    end += count
    if (index > 0 && count > 0) hasSubdocuments = true
  }
  const textLength = end + (hasSubdocuments ? 1 : 0)
  requireDoc(textLength <= limits.maxTextCodeUnits, 'limit-exceeded', 'Text code-unit limit exceeded')
  return { version, tableStream: flags & 0x200 ? '1Table' : '0Table',
    meaningfulBytes, headerLength, records, stories, textLength, diagnostics }
}
