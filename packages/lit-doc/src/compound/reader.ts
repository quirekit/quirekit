import { ByteView } from '../binary/bytes'
import { requireDoc } from '../errors'
import type { DocReadDiagnostic, DocReadLimits } from '../types'
import { copyNormalStream, readAllocation, walkChain } from './allocation'
import { directoryNameKey, readDirectory } from './directory'
import { readHeader } from './header'
import { createStreamReader } from './streams'
import type { CompoundFile } from './types'

/**
 * Opens bounded CFB streams with complete or content-first allocation validation.
 * @param bytes - Container snapshot.
 * @param limits - Validated resource policy.
 * @param mode - Eager source inspection or requested streams followed by a loss audit.
 * @returns Root stream reader with independent byte copies.
 */
export function openCompoundFile(bytes: Uint8Array, limits: DocReadLimits, mode: 'all' | 'requested' = 'all'): CompoundFile {
  const input = new ByteView(bytes, 'invalid-cfb')
  const diagnostics: DocReadDiagnostic[] = []
  const recover = mode === 'requested'
  const header = readHeader(input, limits, diagnostics, recover)
  const storage = readAllocation(input, header, recover)
  const directoryChain = walkChain(storage.fat, storage.claimed, header.directoryStart,
    header.version === 4 ? header.directoryCount : undefined,
    Math.floor(limits.maxDirectoryEntries * 128 / header.sectorSize), recover ? storage.diagnostics : undefined)
  requireDoc(directoryChain.length > 0, 'invalid-cfb', 'Directory stream is empty')
  const members = readDirectory(copyNormalStream(storage, directoryChain, directoryChain.length * header.sectorSize),
    header.version, bytes.length, mode, storage.diagnostics)
  const root = members[0]!, streams = members.filter(member => member.type === 2)
  const reader = createStreamReader(storage, members)
  if (mode === 'all') {
    reader.prepareMini()
    for (const stream of streams) reader.validate(stream)
  }
  const rootStreams = new Map(streams.filter(stream => stream.parent === 0)
    .map(stream => [directoryNameKey(stream.name), stream]))

  return { version: header.version,
    /** @param name - Case-insensitive root name. @returns Independent complete stream bytes, or absence. */
    readRootStream(name) {
      const stream = rootStreams.get(directoryNameKey(name))
      return stream ? reader.read(stream) : undefined
    },
    /** @returns Explicit losses discovered after required stream ownership has been committed. */
    auditUnrequestedStreams() { return reader.audit() },
    /** @returns Current source deviations, including requested stream acquisition. */
    get diagnostics() { return [...diagnostics, ...storage.diagnostics, ...(root.rootLabelIgnored ? [{
      code: 'root-label-ignored' as const,
      message: 'A nonstandard root label is ignored; the bounded root slot, type and directory topology identify its storage.',
    }] : root.name === 'Root Entry' ? [] : [{
      code: 'root-name-case-variant' as const,
      message: 'The root storage label differs from Root Entry only in case; its slot and type identify the root.',
    }])] } }
}
