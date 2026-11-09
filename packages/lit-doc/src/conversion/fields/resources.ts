/**
 * Identifies fields whose binary data belongs to a separate resource owner.
 * @param text - Immutable complete source storage.
 * @param start - Absolute begin-control position.
 * @param end - Validated instruction or Story endpoint.
 * @returns Known resource family, without interpreting parameters or field expressions.
 */
export function resourceFieldType(text: string, start: number, end: number): string | undefined {
  let position = start + 1
  // Leading whitespace belongs to this field only, so skipping it remains
  // linear in the bounded source text even when fields are deeply nested.
  while (position < end && /\s/u.test(text[position]!)) position++
  const prefix = text.slice(position, Math.min(end, position + 13))
  const type = /^([A-Za-z]+)(?=[\s\u0001\u0013-\u0015]|$)/u.exec(prefix)?.[1]?.toUpperCase()
  return type && ['FORMTEXT', 'FORMCHECKBOX', 'FORMDROPDOWN', 'EMBED', 'LINK', 'SHAPE'].includes(type) ? type : undefined
}
