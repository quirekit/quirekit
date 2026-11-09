import { ByteView } from '../binary/bytes'
import { requireDoc } from '../errors'
import { copyNormalStream, walkChain } from './allocation'
import type { CompoundMiniStorage, CompoundStorage, DirectoryMember } from './types'

/**
 * Acquires miniature metadata as one transaction without poisoning normal-stream ownership.
 * @param storage - Verified physical allocation metadata.
 * @param root - Independently identified root directory slot.
 * @returns Complete miniature allocator, or a failure with all new claims rolled back.
 */
export function readMiniStorage(storage: CompoundStorage, root: DirectoryMember): CompoundMiniStorage {
  const { header, fat, claimed } = storage
  let rootChain: number[] = [], miniFatChain: number[] = []
  try {
    requireDoc(Number.isSafeInteger(root.size) && (storage.recover || root.size <= storage.input.bytes.length),
      'invalid-cfb', 'Directory stream size exceeds physical input')
    requireDoc(storage.recover || root.size % 64 === 0, 'invalid-cfb', 'Root mini stream is not mini-sector aligned')
    if (root.size % 64) storage.diagnostics.push({ code: 'cfb-stream-truncated',
      message: 'The unaligned root mini stream supplies only its actual bytes; the final miniature sector may be partial.' })
    rootChain = walkChain(fat, claimed, root.start, Math.ceil(root.size / header.sectorSize), header.sectorCount,
      storage.recover ? storage.diagnostics : undefined)
    const bytes = copyNormalStream(storage, rootChain, root.size)
    miniFatChain = walkChain(fat, claimed, header.miniFatStart, header.miniFatCount, header.sectorCount,
      storage.recover ? storage.diagnostics : undefined)
    const miniFatBytes = new ByteView(copyNormalStream(storage, miniFatChain, header.miniFatCount * header.sectorSize), 'invalid-cfb')
    const actualCount = Math.ceil(bytes.length / 64)
    const miniCount = storage.recover ? Math.min(actualCount, Math.floor(miniFatBytes.bytes.length / 4)) : root.size / 64
    requireDoc(storage.recover || miniCount * 4 <= miniFatBytes.bytes.length, 'invalid-cfb', 'Mini FAT does not cover root storage')
    if (miniCount < actualCount) storage.diagnostics.push({ code: 'cfb-stream-truncated',
      message: 'Only miniature sectors covered by actual MiniFAT entries can supply source bytes.' })
    const miniature = new Uint32Array(miniCount)
    for (let index = 0; index < miniCount; index++) miniature[index] = miniFatBytes.u32(index * 4)
    return { bytes, fat: miniature, claimed: new Uint8Array(miniCount) }
  } catch (error) {
    // Only this initialization owns these new physical chains. Retain all
    // earlier metadata/normal-stream claims when an optional allocator fails.
    for (const sector of [...rootChain, ...miniFatChain]) claimed[sector] = 0
    throw error
  }
}
