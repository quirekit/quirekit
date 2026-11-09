import type { ByteView } from '../binary/bytes'
import type { DocReadDiagnostic } from '../types'

/** Header fields needed to locate and bound CFB storage. */
export interface CompoundHeader {
  /** CFB major version. */
  version: number
  /** Bytes per normal sector. */
  sectorSize: number
  /** Physical sectors containing at least one actual byte after the header. */
  sectorCount: number
  /** Number of FAT sectors. */
  fatCount: number
  /** First directory sector. */
  directoryStart: number
  /** Declared directory sector count, meaningful only in v4. */
  directoryCount: number
  /** First mini FAT sector. */
  miniFatStart: number
  /** Number of mini FAT sectors. */
  miniFatCount: number
  /** First extended DIFAT sector. */
  difatStart: number
  /** Number of extended DIFAT sectors. */
  difatCount: number
}

/** Shared normal-sector allocation state. */
export interface CompoundStorage {
  /** Content-first acquisition may retain bounded real prefixes with explicit diagnostics. */
  recover?: boolean
  /** Original private input bytes. */
  input: ByteView
  /** Admitted file header. */
  header: CompoundHeader
  /** Next-sector entries covering the physical file. */
  fat: Uint32Array
  /** Occupied sectors; one owner per sector. */
  claimed: Uint8Array
  /** Explicit source metadata deviations admitted after location and ownership checks. */
  diagnostics: DocReadDiagnostic[]
}

/** One reachable directory identity, without interpreting object contents. */
export interface DirectoryMember {
  /** Directory slot identity. */
  id: number
  /** Original UTF-16 name. */
  name: string
  /** Root label was nonstandard and is not used as a stream lookup identity. */
  rootLabelIgnored?: boolean
  /** Storage, stream, or root tag. */
  type: number
  /** Parent storage identity; root has -1. */
  parent: number
  /** Initial FAT or mini FAT sector. */
  start: number
  /** Meaningful bytes; zero for storage objects. */
  size: number
}

/** A verified container exposing only root stream lookup. */
export interface CompoundFile {
  /** CFB major version. */
  version: number
  /** Explicitly admitted source deviations, without weakening stream identity checks. */
  diagnostics: readonly DocReadDiagnostic[]
  /**
   * Copies a root stream, excluding same-named embedded objects.
   * @param name - Stream name, using CFB case-insensitive comparison.
   * @returns Stream bytes, or undefined when absent.
   */
  readRootStream(name: string): Uint8Array | undefined
  /** @returns Located losses from unneeded streams after required streams have been acquired. */
  auditUnrequestedStreams(): readonly DocReadDiagnostic[]
}

/** Once-initialized miniature allocator with physical metadata already owned. */
export interface CompoundMiniStorage {
  /** Original root miniature bytes. */
  bytes: Uint8Array
  /** Next miniature-sector entries covering the root storage. */
  fat: Uint32Array
  /** Successfully acquired miniature sectors. */
  claimed: Uint8Array
}

/** Bounded stream cache shared by eager inspection and content-first conversion. */
export interface CompoundStreamReader {
  /** Initializes complete miniature metadata once, retaining failure atomically. */
  prepareMini(): void
  /** @param member - Exact directory identity. Validates allocation without copying unused normal payloads. */
  validate(member: DirectoryMember): void
  /** @param member - Exact directory identity. @returns Independent bytes of the complete requested stream. */
  read(member: DirectoryMember): Uint8Array
  /** @returns One aggregate loss after every unrequested stream has been checked once. */
  audit(): readonly DocReadDiagnostic[]
}
