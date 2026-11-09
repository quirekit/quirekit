import { DocReadError, requireDoc } from '../errors'
import { chainEnd, copyNormalStream, walkChain } from './allocation'
import { readMiniStorage } from './mini'
import type { CompoundMiniStorage, CompoundStorage, CompoundStreamReader, DirectoryMember } from './types'

/**
 * Shares successful chain ownership and stable failures across repeated stream reads.
 * @param storage - Verified FAT/DIFAT/directory allocation snapshot.
 * @param members - Complete bounded directory identities, including root first.
 * @returns Demand reader with independent copies and a final unused-stream audit.
 */
export function createStreamReader(storage: CompoundStorage, members: readonly DirectoryMember[]): CompoundStreamReader {
  const { header } = storage
  const chains = new Map<number, number[]>()
  const failures = new Map<number, unknown>()
  let mini: CompoundMiniStorage | undefined, miniFailed = false, miniFailure: unknown

  /** Initializes miniature metadata exactly once; failed work cannot leave partial claims. */
  function prepareMini(): void {
    if (miniFailed) throw miniFailure
    if (mini) return
    try { mini = readMiniStorage(storage, members[0]!) }
    catch (error) { miniFailed = true; miniFailure = error; throw error }
  }

  /** @param member - Exact source stream identity. @param copy - Whether payload bytes are requested after preflight. @returns Fresh full bytes, or an empty preflight result. */
  function read(member: DirectoryMember, copy = true): Uint8Array {
    if (failures.has(member.id)) throw failures.get(member.id)
    let acquired: number[] | undefined
    let claimed: Uint8Array | undefined
    try {
      requireDoc(Number.isSafeInteger(member.size) && (storage.recover || member.size <= storage.input.bytes.length),
        'invalid-cfb', 'Directory stream size exceeds physical input')
      if (member.size === 0) {
        requireDoc(member.start === chainEnd, 'invalid-cfb', 'Empty stream has an allocation chain')
        chains.set(member.id, [])
        return new Uint8Array()
      }
      const small = member.size < 4096
      if (small) prepareMini()
      claimed = small ? mini!.claimed : storage.claimed
      let chain = chains.get(member.id)
      if (!chain) {
        chain = walkChain(small ? mini!.fat : storage.fat, claimed, member.start,
          Math.ceil(member.size / (small ? 64 : header.sectorSize)), claimed.length, storage.recover ? storage.diagnostics : undefined)
        acquired = chain
      }
      requireDoc(chain.length > 0, 'invalid-cfb', 'Allocation chain is cyclic, shared, or out of bounds')
      if (!copy) { chains.set(member.id, chain); return new Uint8Array() }
      let output: Uint8Array
      if (!small) output = copyNormalStream(storage, chain, member.size)
      else {
        let available = 0
        for (const sector of chain) {
          const count = Math.min(64, Math.max(0, mini!.bytes.length - sector * 64))
          available += count
          if (count < 64) break
        }
        const length = Math.min(member.size, available)
        if (length < member.size) storage.diagnostics.push({ code: 'cfb-stream-truncated',
          message: 'Only actual contiguous miniature stream bytes are retained.' })
        output = new Uint8Array(length)
        let offset = 0
        for (const sector of chain) {
          if (offset === output.length) break
          const count = Math.min(64, output.length - offset)
          output.set(mini!.bytes.subarray(sector * 64, sector * 64 + count), offset)
          offset += count
        }
      }
      chains.set(member.id, chain)
      return output
    } catch (error) {
      if (acquired && claimed) for (const sector of acquired) claimed[sector] = 0
      failures.set(member.id, error)
      throw error
    }
  }

  return { prepareMini, read,
    /** @param member - Stream identity whose allocation must pass eager source preflight. */
    validate(member) { read(member, false) },
    /** @returns Aggregated omitted-stream loss; budget and unexpected failures remain fatal. */
    audit() {
      try { prepareMini() }
      catch (error) { if (!(error instanceof DocReadError) || error.code !== 'invalid-cfb') throw error }
      for (const member of members) if (member.type === 2 && !chains.has(member.id) && !failures.has(member.id)) {
        try { read(member) }
        catch (error) { if (!(error instanceof DocReadError) || error.code !== 'invalid-cfb') throw error }
      }
      const count = failures.size
      return count || miniFailed ? [{ code: 'cfb-unreadable-streams-omitted',
        message: `${count} unreadable source streams${miniFailed ? ' and unavailable miniature storage' : ''} are omitted after required Word streams were validated.` }] : []
    },
  }
}
