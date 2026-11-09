import { resolveLimits } from '../../binary/limits'
import { openCompoundFile } from '../../compound/reader'
import { requireDoc } from '../../errors'
import type { DocReadOptions } from '../../types'
import { readWordHeader } from '../fib'
import { readTextStorage } from '../pieces'
import type { WordDocumentSource } from './types'

/**
 * Acquires one private source snapshot without reading optional format/object streams.
 * @param input - Complete caller-owned bytes.
 * @param options - Shared source inspection and resource policy.
 * @param mode - Complete source inspection or required-stream conversion acquisition.
 * @returns Container and validated text authorities for later requested passes.
 */
export function readDocumentSource(input: Uint8Array, options: DocReadOptions, mode: 'all' | 'requested' = 'all'): WordDocumentSource {
  requireDoc(input instanceof Uint8Array && options && typeof options === 'object', 'invalid-input', 'Expected DOC bytes and reader options')
  const limits = resolveLimits(options)
  requireDoc(input.byteLength <= limits.maxInputBytes, 'limit-exceeded', 'Input byte limit exceeded')
  const container = openCompoundFile(new Uint8Array(input), limits, mode)
  const encryptedInfo = container.readRootStream('EncryptionInfo')
  const encryptedPackage = container.readRootStream('EncryptedPackage')
  requireDoc(!encryptedInfo || !encryptedPackage, 'encrypted-document', 'Encrypted OOXML is not an unencrypted DOC file')
  const word = container.readRootStream('WordDocument')
  requireDoc(word, 'not-word-document', 'CFB container has no root WordDocument stream')
  const header = readWordHeader(word, limits, mode === 'requested')
  const table = container.readRootStream(header.tableStream)
  requireDoc(table, 'invalid-fib', `Selected ${header.tableStream} stream is absent`)
  return { container, word, table, header, storage: readTextStorage(word, table, header, limits, mode === 'requested'), limits }
}
