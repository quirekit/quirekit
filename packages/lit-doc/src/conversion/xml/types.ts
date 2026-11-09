import type { DocxXmlChildPlan, DocxXmlElementPlan } from '@quirekit/lit-docx-contract'
import type { DocConversionDiagnostic, DocConversionReport } from '../types'

/** Bounded XML construction and located diagnostic ownership. */
export interface ProjectionContext {
  /** Mutable counters and decisions, finalized only after complete source projection. */
  report: DocConversionReport
  /**
   * Builds one WordprocessingML element, validating text and attributes before allocation.
   * @param name - Local element name.
   * @param attributes - WordprocessingML attributes in declaration order.
   * @param children - Already constructed child elements or exact text.
   * @returns Namespace-aware typed XML element.
   */
  element(name: string, attributes?: Readonly<Record<string, string | number | boolean>>, children?: readonly DocxXmlChildPlan[]): DocxXmlElementPlan
  /**
   * Applies the same text and node budgets to a namespace-aware element.
   * @param element - Immediate attributes and already constructed children, including symbolic relationships.
   * @returns Validated typed XML without losing attribute namespace or relationship identity.
   */
  xml(element: DocxXmlElementPlan): DocxXmlElementPlan
  /**
   * Adds one complete located decision without silently truncating the report.
   * @param diagnostic - Explicit policy and source location.
   */
  diagnose(diagnostic: DocConversionDiagnostic): void
}
