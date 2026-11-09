import type { ProjectionContext } from '../xml/types'
import type { DrawingXmlFactory } from './types'

/** Public standard namespace identities used by drawing plans. */
export const drawingNamespaces = {
  wp: 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing', a: 'http://schemas.openxmlformats.org/drawingml/2006/main',
  wps: 'http://schemas.microsoft.com/office/word/2010/wordprocessingShape', pic: 'http://schemas.openxmlformats.org/drawingml/2006/picture',
  wpg: 'http://schemas.microsoft.com/office/word/2010/wordprocessingGroup', r: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
} as const

/** @param context - Shared output work and loss owner. @returns Typed XML factory retaining symbolic relationships until package allocation. */
export function createDrawingXml(context: ProjectionContext): DrawingXmlFactory {
  return (prefix, name, attributes = {}, children = []) => context.xml({ prefix, namespaceUri: drawingNamespaces[prefix], localName: name,
    attributes: Object.entries(attributes).map(([localName, value]) => localName === 'r:embed'
      ? { namespaceUri: drawingNamespaces.r, prefix: 'r', localName: 'embed', value }
      : { namespaceUri: '', localName, value }), children })
}
