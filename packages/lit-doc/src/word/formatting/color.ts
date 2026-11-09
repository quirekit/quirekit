/** Word's public ColorIndex palette; index thirteen is dark red. */
export const palette = ['auto', '000000', '0000FF', '00FFFF', '00FF00', 'FF00FF', 'FF0000', 'FFFF00', 'FFFFFF',
  '000080', '008080', '008000', '800080', '800000', '808000', '808080', 'C0C0C0'] as const

/** @param value - Validated little-endian COLORREF. @returns Automatic or six-digit RGB identity. */
export function colorRefValue(value: number): string {
  if (value >>> 24 === 255) return 'auto'
  return [value & 255, value >>> 8 & 255, value >>> 16 & 255].map(byte => byte.toString(16).padStart(2, '0')).join('').toUpperCase()
}
