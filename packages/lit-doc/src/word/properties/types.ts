/** One bounded source property modifier; operand retains any variable-length prefix. */
export interface PropertyOperation {
  /** Complete 16-bit MS-DOC opcode, including group and operand size. */
  opcode: number
  /** Borrowed operand bytes after the opcode. */
  operand: Uint8Array
}

/** Property family and containing style owner, before resolving effective formatting. */
export type PropertyStyleContext = 'paragraph' | 'character' | 'paragraph-character'

/** Per-inspection reader shared by styles, PAPX and piece properties. */
export interface PropertyReader {
  /**
   * Reads and expands one property list with bounded Data-stream references.
   * @param bytes - Exact property-list bytes.
   * @param style - Optional UPX family and containing style owner, preserving their distinct restrictions.
   * @returns Ordered operations with indirect chains expanded.
   */
  read(bytes: Uint8Array, style?: PropertyStyleContext): readonly PropertyOperation[]
  /**
   * Charges repeated application as well as initial parsing to the common budget.
   * @param count - Number of property operations about to be processed.
   */
  consume(count: number): void
}
import type { DocReadErrorCode } from '../../types'

/** A physical formatting run, before projecting it through logical text pieces. */
export interface PhysicalPropertyRecord {
  /** Inclusive WordDocument FC. */
  byteStart: number
  /** Exclusive WordDocument FC. */
  byteEnd: number
  /** Exact property-list bytes. */
  properties: Uint8Array
}

/** A formatting record and the separate BTE range that selected its page. */
export interface PhysicalPropertyMatch<Record extends PhysicalPropertyRecord> {
  /** Source record with its original physical extent. */
  record: Record
  /** Exclusive BTE endpoint; a record cannot authorize using its page past this point. */
  rangeEnd: number
}

/** Typed configuration for one physical paragraph or character property index. */
export interface FormattingIndexOptions<Record extends PhysicalPropertyRecord> {
  /** FIB locator index for this property family. */
  field: number
  /** Human-readable property family used in bounded failure messages. */
  label: 'Paragraph' | 'Character'
  /** Stable malformed-input category for this family. */
  code: DocReadErrorCode
  /**
   * Parses one fixed-size formatting page.
   * @param bytes - Exactly 512 source bytes.
   * @returns Typed physical runs in ascending order.
   */
  readPage(bytes: Uint8Array): readonly Record[]
}

/** Bounded physical property lookup shared by paragraph and character readers. */
export interface PhysicalPropertyIndex<Record extends PhysicalPropertyRecord> {
  /**
   * Finds an actual covering record, distinguishing absence from a malformed page or partial character.
   * @param byteOffset - WordDocument FC.
   * @param width - Complete source character width.
   * @returns Actual source record and BTE extent, or undefined when a required covering interval is wholly absent.
   */
  find(byteOffset: number, width: number): PhysicalPropertyMatch<Record> | undefined
  /**
   * Checks the final index and fully validated final page without extending either extent.
   * @param byteOffset - Exact expected exclusive physical endpoint.
   * @returns Whether both original authorities end at this byte.
   */
  endsAt(byteOffset: number): boolean
  /**
   * Locates the record and BTE extent covering one complete encoded character.
   * @param byteOffset - WordDocument FC.
   * @param width - Complete source character width.
   * @returns Source record with its page-selection endpoint.
   */
  locate(byteOffset: number, width: number): PhysicalPropertyMatch<Record>
}
