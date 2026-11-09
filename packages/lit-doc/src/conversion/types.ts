import type { DocxCompiledPackagePlan, DocxPackageSourcePlan, ParseOptions, ParseResult } from '@quirekit/lit-docx-contract'
import type { DocReadErrorCode, DocReadLimits, DocStoryRange } from '../types'

/** Independent output-work ceilings, in addition to source-reader budgets. */
export interface DocConversionLimits {
  /** Maximum allocated XML elements and attributes; defaults to 500000. */
  maxXmlNodes: number
  /** Maximum cumulative XML text/attribute UTF-16 units; defaults to 16 Mi. */
  maxXmlCodeUnits: number
  /** Maximum report entries; defaults to 1000, overflow rejects rather than truncating. */
  maxDiagnostics: number
}

/** Explicit source-to-OOXML conversion policy. */
export interface DocConversionOptions {
  /** Defaults to best-effort with diagnosed content recovery. Explicit strict rejects semantic loss and source failures. */
  lossPolicy?: 'strict' | 'best-effort'
  /** Source-reader resource ceilings. */
  limits?: Partial<DocReadLimits>
  /** Output allocation ceilings within hard library limits. */
  outputLimits?: Partial<DocConversionLimits>
}

/** Existing DOCX parser options applied after the single legacy source projection. */
export interface DocParseOptions extends DocConversionOptions {
  /** Existing codec parsing policy, without platform or acquisition callbacks. */
  parseOptions?: ParseOptions
}

/** One located conversion decision, never retaining original file bytes. */
export interface DocConversionDiagnostic {
  /** Stable machine-readable condition. */
  code: string
  /** Loss and approximation reject strict conversion; host limits concern downstream editing. */
  kind: 'loss' | 'approximation' | 'host-limit' | 'compatibility'
  /** Human-readable handling and boundary. */
  message: string
  /** Source authority, such as style slot, section, or story. */
  source: string
  /** Number of equivalent decisions aggregated at this source authority. */
  occurrences?: number
  /** Optional inclusive source CP. */
  start?: number
  /** Optional exclusive source CP. */
  end?: number
}

/** Explicit recovery level and source measurements unavailable after a local failure. */
export interface DocConversionRecovery {
  /** Original contiguous main-story CP interval retained after core map damage, with missing characters omitted. */
  mainStoryRange?: DocStoryRange
  /** Product retains validated main-story text as editable ordinary paragraphs. */
  level: 'text'
  /** Located source failure that triggered the single recovery attempt. */
  cause: DocReadErrorCode
  /** Text display semantics unavailable when recovery has only validated piece storage. */
  unresolvedTextSemantics: readonly ('hidden-formatting' | 'tracked-changes')[]
  /** Unavailable source denominators whose numeric report slots contain zero. */
  unmeasuredSourceCounts: readonly ('paragraphs' | 'characterRuns' | 'tables' | 'styles' | 'fonts' | 'sections')[]
}

/** Evidence scoped to the source-to-OOXML projection, independent of layout fidelity. */
export interface DocConversionReport {
  /** Selected stable conversion route. */
  route: 'doc-ooxml-docx'
  /** Requested semantic-loss policy. */
  lossPolicy: 'strict' | 'best-effort'
  /** Whether any explicitly diagnosed semantic loss or approximation occurred. */
  lossy: boolean
  /** Present after content recovery, including which source counters could not be measured. */
  recovery?: DocConversionRecovery
  /** Complete bounded diagnostics. */
  diagnostics: readonly DocConversionDiagnostic[]
  /** Original denominators. Recovery explicitly lists unavailable counters whose numeric slots contain zero. */
  source: { codeUnits: number, paragraphs: number, characterRuns: number, tables: number, styles: number, fonts: number, sections: number }
  /** Work consumed by the typed XML projection. */
  output: { xmlNodes: number, xmlCodeUnits: number }
}

/** Advanced caller-owned typed package graph, before ZIP materialization. */
export interface DocSourcePlanResult {
  /** Graph submitted to the existing central DOCX compiler. */
  plan: DocxPackageSourcePlan
  /** Located source projection decisions and original denominators. */
  report: DocConversionReport
}

/** Injected DOCX implementation; the DOC reader has no runtime dependency on it. */
export interface DocxConversionRuntime {
  /**
   * Allocates package identities through the central DOCX compiler.
   * @param source - Complete typed source graph.
   * @returns Resolved package graph.
   */
  resolveDocxPackageSourcePlan(source: DocxPackageSourcePlan): DocxCompiledPackagePlan
  /**
   * Materializes the resolved graph using the existing ZIP writer.
   * @param plan - Centrally allocated package graph.
   * @returns Complete browser-safe DOCX bytes.
   */
  materializeNewDocxPackagePlan(plan: DocxCompiledPackagePlan): Promise<Uint8Array>
}

/** Optional parse capability supplied by the same host-owned DOCX runtime. */
export interface DocxParseRuntime extends DocxConversionRuntime {
  /**
   * Parses projected OOXML through the existing LitAST codec.
   * @param bytes - Complete generated DOCX package.
   * @param options - Existing parser behavior.
   * @returns LitAST and codec warnings.
   */
  parseDocx(bytes: Uint8Array, options?: ParseOptions): Promise<ParseResult>
}

/** Complete DOC-to-DOCX conversion result. */
export interface DocToDocxResult {
  /** Complete generated OOXML package. */
  docx: Uint8Array
  /** Projection evidence; no claim about rendered layout is implied. */
  report: DocConversionReport
}

/** DOC-to-LitAST result through the single OOXML route. */
export interface DocParseResult extends ParseResult {
  /** Source conversion decisions, separate from the DOCX parser's warnings. */
  report: DocConversionReport
}
