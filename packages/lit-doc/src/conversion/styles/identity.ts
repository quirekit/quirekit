/**
 * Keeps source slots stable without using display names as package identities.
 * @param index - Validated source style slot.
 * @returns Deterministic OOXML style identifier.
 */
export function styleId(index: number): string {
  return index === 0 ? 'Normal' : index === 10 ? 'DefaultParagraphFont' : `LegacyStyle${index}`
}
