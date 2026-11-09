import type { DocxXmlAttributeValue, DocxXmlElementPlan } from '@quirekit/lit-docx-contract'
import type { FloatingPicturePlacement } from '../../word/drawings/pictures/types'

/** Drawing namespaces shared by ordinary shapes, pictures and standard groups. */
export type DrawingXmlPrefix = 'wp' | 'a' | 'wps' | 'pic' | 'wpg'

/** @param prefix - Exact drawing namespace. @param name - Local XML name. @param attributes - Ordinary attributes and symbolic r:embed. @param children - Complete bounded children. @returns Namespace-aware typed drawing element. */
export type DrawingXmlFactory = (prefix: DrawingXmlPrefix, name: string, attributes?: Record<string, DocxXmlAttributeValue>, children?: (DocxXmlElementPlan | string)[]) => DocxXmlElementPlan

/** Complete outer anchor independent of its graphic's shape or media family. */
export interface FloatingDrawingAnchorPlan {
  /** Unique generated drawing id. */
  id: number
  /** Stable source or author-facing drawing name. */
  name: string
  /** Optional original alternative description. */
  description?: string | null
  /** Physical creation width and height in EMU. */
  extent: readonly [number, number]
  /** Original outer placement authority. */
  placement: FloatingPicturePlacement
  /** Original aspect protection. */
  lockAspect: boolean
  /** Exact standard graphicData namespace. */
  graphicNamespace: string
  /** Whole prepared graphic, with no temporary outer anchor. */
  children: DocxXmlElementPlan[]
}
