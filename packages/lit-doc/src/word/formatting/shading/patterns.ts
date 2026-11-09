/** Public MS-DOC Ipat to standard OOXML shading tokens; unmapped values remain absent. */
const patterns: Readonly<Record<number, string>> = {
  0: 'clear', 1: 'solid', 2: 'pct5', 3: 'pct10', 4: 'pct20', 5: 'pct25', 6: 'pct30', 7: 'pct40',
  8: 'pct50', 9: 'pct60', 10: 'pct70', 11: 'pct75', 12: 'pct80', 13: 'pct90',
  14: 'horzStripe', 15: 'vertStripe', 16: 'reverseDiagStripe', 17: 'diagStripe', 18: 'horzCross', 19: 'diagCross',
  20: 'thinHorzStripe', 21: 'thinVertStripe', 22: 'thinReverseDiagStripe', 23: 'thinDiagStripe', 24: 'thinHorzCross', 25: 'thinDiagCross',
  37: 'pct12', 38: 'pct15', 43: 'pct35', 44: 'pct37', 46: 'pct45', 49: 'pct55', 51: 'pct62', 52: 'pct65', 57: 'pct85', 58: 'pct87', 60: 'pct95', 65535: 'nil',
}

/** @param pattern - Exact source Ipat. @returns Standard token, or undefined when no exact OOXML value exists. */
export function shadingPattern(pattern: number): string | undefined { return patterns[pattern] }
