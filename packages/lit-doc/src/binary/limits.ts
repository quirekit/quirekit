import { requireDoc } from '../errors'
import type { DocReadLimits, DocReadOptions } from '../types'

const defaults: DocReadLimits = {
  maxTextboxEntries: 10000,
  maxDrawings: 10000, maxDrawingDepth: 64, maxDrawingPropertyBytes: 8 * 1024 * 1024,
  maxRevisionAuthors: 10000, maxRevisionAuthorCodeUnits: 1024 * 1024,
  maxComments: 10000, maxCommentAuthors: 10000, maxCommentDepth: 64,
  maxBookmarks: 10000,
  maxFields: 10000, maxFieldDepth: 64,
  maxNotes: 10000,
  maxHeaderFooterStories: 10000,
  maxPictures: 10000, maxPictureBytes: 16 * 1024 * 1024, maxTotalPictureBytes: 64 * 1024 * 1024,
  maxInputBytes: 64 * 1024 * 1024, maxDirectoryEntries: 65536,
  maxTextCodeUnits: 8 * 1024 * 1024, maxPieces: 200000,
  maxParagraphs: 200000, maxFormattingPages: 16384,
  maxPropertyOperations: 1000000, maxFormattingDepth: 64,
  maxCharacterRuns: 200000, maxTableDepth: 32, maxTables: 10000,
  maxNumberingDefinitions: 4096, maxNumberingInstances: 4096,
  maxNumberingLevels: 65536, maxNumberingTextCodeUnits: 1024 * 1024,
}
const hardLimits: DocReadLimits = {
  maxTextboxEntries: 100000,
  maxDrawings: 100000, maxDrawingDepth: 256, maxDrawingPropertyBytes: 64 * 1024 * 1024,
  maxRevisionAuthors: 0xfffe, maxRevisionAuthorCodeUnits: 8 * 1024 * 1024,
  maxComments: 100000, maxCommentAuthors: 0x7fff, maxCommentDepth: 256,
  maxBookmarks: 0x3ffc,
  maxFields: 100000, maxFieldDepth: 256,
  maxNotes: 100000,
  maxHeaderFooterStories: 100000,
  maxPictures: 100000, maxPictureBytes: 64 * 1024 * 1024, maxTotalPictureBytes: 256 * 1024 * 1024,
  maxInputBytes: 256 * 1024 * 1024, maxDirectoryEntries: 262144,
  maxTextCodeUnits: 32 * 1024 * 1024, maxPieces: 1000000,
  maxParagraphs: 1000000, maxFormattingPages: 65536,
  maxPropertyOperations: 4000000, maxFormattingDepth: 256,
  maxCharacterRuns: 1000000, maxTableDepth: 64, maxTables: 100000,
  maxNumberingDefinitions: 32767, maxNumberingInstances: 65536,
  maxNumberingLevels: 262144, maxNumberingTextCodeUnits: 8 * 1024 * 1024,
}

/**
 * Resolves per-call ceilings while rejecting unsafe or unknown values.
 * @param options - Caller policy.
 * @returns Validated finite limits.
 */
export function resolveLimits(options: DocReadOptions): DocReadLimits {
  requireDoc(options.includeTextboxes === undefined || typeof options.includeTextboxes === 'boolean',
    'invalid-input', 'includeTextboxes must be a boolean')
  requireDoc(options.includeDrawings === undefined || typeof options.includeDrawings === 'boolean',
    'invalid-input', 'includeDrawings must be a boolean')
  requireDoc(options.includeRevisions === undefined || typeof options.includeRevisions === 'boolean',
    'invalid-input', 'includeRevisions must be a boolean')
  requireDoc(options.includeRevisionAuthors === undefined || typeof options.includeRevisionAuthors === 'boolean',
    'invalid-input', 'includeRevisionAuthors must be a boolean')
  requireDoc(options.includeComments === undefined || typeof options.includeComments === 'boolean',
    'invalid-input', 'includeComments must be a boolean')
  requireDoc(options.includeBookmarks === undefined || typeof options.includeBookmarks === 'boolean',
    'invalid-input', 'includeBookmarks must be a boolean')
  requireDoc(options.includeFields === undefined || typeof options.includeFields === 'boolean',
    'invalid-input', 'includeFields must be a boolean')
  requireDoc(options.includeNoteSettings === undefined || typeof options.includeNoteSettings === 'boolean',
    'invalid-input', 'includeNoteSettings must be a boolean')
  requireDoc(options.includeNotes === undefined || typeof options.includeNotes === 'boolean',
    'invalid-input', 'includeNotes must be a boolean')
  requireDoc(options.includeHeaderFooters === undefined || typeof options.includeHeaderFooters === 'boolean',
    'invalid-input', 'includeHeaderFooters must be a boolean')
  requireDoc(options.includeParagraphs === undefined || typeof options.includeParagraphs === 'boolean',
    'invalid-input', 'includeParagraphs must be a boolean')
  requireDoc(options.includeParagraphFormatting === undefined || typeof options.includeParagraphFormatting === 'boolean',
    'invalid-input', 'includeParagraphFormatting must be a boolean')
  requireDoc(options.includeCharacterFormatting === undefined || typeof options.includeCharacterFormatting === 'boolean',
    'invalid-input', 'includeCharacterFormatting must be a boolean')
  requireDoc(options.includeTables === undefined || typeof options.includeTables === 'boolean',
    'invalid-input', 'includeTables must be a boolean')
  requireDoc(options.includeNumbering === undefined || typeof options.includeNumbering === 'boolean',
    'invalid-input', 'includeNumbering must be a boolean')
  const limits = { ...defaults }
  for (const key of Object.keys(options.limits ?? {})) {
    requireDoc(Object.hasOwn(defaults, key), 'invalid-input', `Unknown resource limit: ${key}`)
    const name = key as keyof DocReadLimits
    const value = options.limits?.[name]
    requireDoc(typeof value === 'number' && Number.isSafeInteger(value) && value > 0
      && value <= hardLimits[name], 'invalid-input', `Invalid resource limit: ${name}`)
    limits[name] = value
  }
  return limits
}
