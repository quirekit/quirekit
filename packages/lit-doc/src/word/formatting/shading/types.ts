/** Source shading colors and Ipat, distinct from an inherited absence. */
export interface DocShading {
  /** Raw unsigned Ipat; 65535 is an explicit nil value. */
  readonly pattern: number
  /** Uppercase RGB or the automatic-color identity. */
  readonly foreground: string
  /** Uppercase RGB or the automatic-color identity. */
  readonly background: string
}
