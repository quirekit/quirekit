import type { DocxXmlElementPlan } from '@quirekit/lit-docx-contract'
import type { FloatingPictureAxis } from '../../word/drawings/pictures/types'
import type { ProjectionContext } from '../xml/types'
import type { FloatingDrawingAnchorPlan } from './types'
import { createDrawingXml } from './xml'

/** @param plan - Complete physical placement and already prepared graphic. @param context - Bounded XML owner. @returns One standard anchored drawing without family-specific geometry decisions. */
export function floatingDrawingAnchor(plan: FloatingDrawingAnchorPlan, context: ProjectionContext): DocxXmlElementPlan {
  const e = createDrawingXml(context), placement = plan.placement
  /** @param name - Independent axis. @param source - Original full axis tuple. @returns Exact reference and alignment or offset. */
  function position(name: 'positionH' | 'positionV', source: FloatingPictureAxis): DocxXmlElementPlan {
    return e('wp', name, { relativeFrom: source.reference }, [source.alignment === null
      ? e('wp', 'posOffset', {}, [String(source.offset)]) : e('wp', 'align', {}, [source.alignment])])
  }
  const wrap = placement.wrap === 'none' ? 'wrapNone' : placement.wrap === 'top-and-bottom' ? 'wrapTopAndBottom' : 'wrapSquare'
  return context.element('drawing', {}, [e('wp', 'anchor', {
    distL: placement.distances[0], distT: placement.distances[1], distR: placement.distances[2], distB: placement.distances[3],
    simplePos: '0', relativeHeight: placement.rank, behindDoc: placement.behind ? '1' : '0', locked: placement.locked ? '1' : '0',
    layoutInCell: placement.layoutInCell ? '1' : '0', allowOverlap: placement.allowOverlap ? '1' : '0',
  }, [e('wp', 'simplePos', { x: 0, y: 0 }), position('positionH', placement.horizontal), position('positionV', placement.vertical),
    e('wp', 'extent', { cx: Math.round(plan.extent[0]), cy: Math.round(plan.extent[1]) }), e('wp', 'effectExtent', { l: 0, t: 0, r: 0, b: 0 }),
    e('wp', wrap, wrap === 'wrapSquare' ? { wrapText: placement.side } : {}),
    e('wp', 'docPr', { id: plan.id, name: plan.name, ...(plan.description == null ? {} : { descr: plan.description }) }),
    e('wp', 'cNvGraphicFramePr', {}, [e('a', 'graphicFrameLocks', { noChangeAspect: plan.lockAspect ? '1' : '0' })]),
    e('a', 'graphic', {}, [e('a', 'graphicData', { uri: plan.graphicNamespace }, plan.children)])])])
}
