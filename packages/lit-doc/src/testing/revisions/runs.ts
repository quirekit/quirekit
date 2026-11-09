import { withCharacterRecords } from '../characters'
import { withStyleDefinitions } from '../formatting'
import { withParagraphRecords } from '../paragraphs'
import { revisionAuthorStreams } from './authors'

/**
 * Builds independently encoded character review operands over text and its paragraph ending.
 * @param text - Raw operations for the single author character.
 * @param marker - Separate raw operations for its paragraph mark.
 * @param authors - Exact author table, with no inferred current user.
 * @returns Complete root streams with independent text and paragraph-mark source authorities.
 */
export function revisionRunStreams(text: readonly number[], marker: readonly number[] = [],
  authors: readonly string[] = ['Unknown', 'Insert author', 'Delete author']): Record<string, Uint8Array> {
  return withStyleDefinitions(withCharacterRecords(withParagraphRecords(revisionAuthorStreams(authors), [
    { cuts: [2048, 2052] },
  ]), [{ cuts: [2048, 2050, 2052], records: [text, marker] }]), [{ index: 0 }, { index: 15, kind: 2 }])
}
