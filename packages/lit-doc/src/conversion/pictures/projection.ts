import { DocReadError } from '../../errors'
import { createFloatingPictureReader } from '../../word/drawings/pictures/document'
import { readInlinePicture } from '../../word/pictures/read'
import type { PictureReadContext, SourcePicture } from '../../word/pictures/types'
import type { ConversionSource } from '../source/types'
import type { ProjectionContext } from '../xml/types'
import { createPictureScope } from './scope'
import type { PictureDocumentProjection, PictureProjectionOwner } from './types'
import type { DocReadDiagnostic } from '../../types'
import type { TextboxProjection } from '../textboxes/types'

/** @param source - Single original document snapshot. @param context - Complete output and loss policy. @param textboxes - Optional native rich text owner sharing the drawing source. @returns Shared readers/counters with isolated Story resource scopes. */
export function createPictureProjection(source: ConversionSource, context: ProjectionContext, textboxes?: TextboxProjection): PictureDocumentProjection {
  const reader: PictureReadContext = { data: source.data, word: source.word, reader: source.context.reader,
    limits: source.limits, decodedBytes: 0, errorCode: 'invalid-picture-data', propertyBytes: { remaining: source.limits.maxDrawingPropertyBytes } }
  const pictures = new Map<number, SourcePicture | DocReadError>()
  const compatibility: DocReadDiagnostic[] = []
  const owner: PictureProjectionOwner = { context, reader, count: 0, textboxCount: 0, textboxAttempts: 0, pictureAttempts: 0, groupCount: 0,
    ...(textboxes ? { textboxes } : {}), referencedBytes: 0, compatibility, emittedCompatibility: 0,
    inline: read, floating: createFloatingPictureReader(source, reader, compatibility) }

  /** @param offset - Original Data-stream byte identity. @returns Cached original picture or its explicit source refusal. */
  function read(offset: number): SourcePicture {
    let picture = pictures.get(offset)
    if (!picture) {
      try { picture = readInlinePicture(offset, reader) }
      catch (error) {
        if (!(error instanceof DocReadError) || !['invalid-picture-data', 'unsupported-picture'].includes(error.code)) throw error
        picture = error
      }
      pictures.set(offset, picture)
    }
    if (picture instanceof DocReadError) throw picture
    return picture
  }
  return { ...createPictureScope(owner, source, '/word/document.xml'),
    forStory: (story, part) => createPictureScope(owner, story, part) }
}
