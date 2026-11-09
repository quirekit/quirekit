import { requireDoc } from '../../errors'
import type { WordTextStorage } from '../types'
import type { PropertyOperation, PropertyReader } from './types'

const paragraphModifiers = new Map([
  [0x04, 0x2602], [0x05, 0x2461], [0x07, 0x2405], [0x08, 0x2406], [0x09, 0x2407],
  [0x0c, 0x260a], [0x0d, 0x2470], [0x0e, 0x240c], [0x0f, 0x2471], [0x18, 0x2416],
  [0x19, 0x2417], [0x1d, 0x261b], [0x25, 0x2423], [0x2c, 0x242a], [0x32, 0x2430],
  [0x33, 0x2431], [0x35, 0x2433], [0x36, 0x2434], [0x37, 0x2435], [0x38, 0x2436],
  [0x39, 0x2437], [0x3a, 0x2438], [0x78, 0x2640], [0x7e, 0x2443],
])
const characterModifiers = new Map([[0, 0x2879], [0x41, 0x0800], [0x42, 0x0801], [0x43, 0x0802],
  [0x47, 0x0806], [0x4b, 0x080a], [0x4d, 0x2a0c], [0x4e, 0x0858], [0x4f, 0x2859],
  [0x50, 0x0811], [0x51, 0x0818], [0x53, 0x2a33], [0x55, 0x0835], [0x56, 0x0836],
  [0x57, 0x0837], [0x58, 0x0838], [0x59, 0x0839], [0x5a, 0x083a], [0x5b, 0x083b],
  [0x5c, 0x083c], [0x5e, 0x2a3e], [0x62, 0x2a42], [0x68, 0x2a48], [0x73, 0x2a53],
  [0x74, 0x0854], [0x75, 0x0855], [0x76, 0x0856], [0x7b, 0x2a90], [0x7c, 0x2a86]])

/**
 * Resolves only paragraph operations from the ending piece's source modifier.
 * @param modifier - Original Prm word.
 * @param storage - Validated CLX groups.
 * @param reader - Shared property reader and budget.
 * @returns Ordered paragraph changes, excluding character changes on the same piece.
 */
export function readPieceParagraphProperties(modifier: number, storage: WordTextStorage,
  reader: PropertyReader): readonly PropertyOperation[] {
  if (modifier & 1) return reader.read(storage.propertyGroups[modifier >>> 1]!)
    .filter(operation => ((operation.opcode >>> 10) & 7) === 1)
  const index = (modifier >>> 1) & 0x7f
  const opcode = paragraphModifiers.get(index)
  requireDoc(opcode !== undefined || characterModifiers.has(index), 'unsupported-formatting', 'Unknown compact piece modifier')
  return opcode === undefined ? [] : [{ opcode, operand: Uint8Array.of(modifier >>> 8) }]
}

/**
 * Resolves character operations from the current piece without applying paragraph modifiers.
 * @param modifier - Original Prm word.
 * @param storage - Validated CLX groups.
 * @param reader - Shared property budget and parser.
 * @returns Character changes in source order.
 */
export function readPieceCharacterProperties(modifier: number, storage: WordTextStorage, reader: PropertyReader): readonly PropertyOperation[] {
  if (modifier & 1) return reader.read(storage.propertyGroups[modifier >>> 1]!)
    .filter(operation => ((operation.opcode >>> 10) & 7) === 2)
  if (!modifier) return []
  const index = (modifier >>> 1) & 0x7f
  const opcode = characterModifiers.get(index)
  requireDoc(opcode !== undefined || paragraphModifiers.has(index), 'unsupported-formatting', 'Unknown compact piece modifier')
  return opcode === undefined ? [] : [{ opcode, operand: Uint8Array.of(modifier >>> 8) }]
}
