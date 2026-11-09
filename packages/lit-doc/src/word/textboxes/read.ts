import { ByteView } from '../../binary/bytes'
import { requireDoc } from '../../errors'
import type { WordDocumentSource } from '../document/types'
import type { PropertyReader } from '../properties/types'
import type { WordRecordRange } from '../types'
import type { DocTextboxBreak, DocTextboxEntry, DocTextboxesSource, TextboxPlc } from './types'

/**
 * Reads original chain and display PLCs without following spare links or copying textbox text.
 * @param source - One validated immutable storage snapshot.
 * @param reader - Work authority shared with other requested source inspections.
 * @returns Complete body/header metadata with original relative coordinates and unused values.
 */
export function readTextboxRecords(source: WordDocumentSource, reader: PropertyReader): DocTextboxesSource {
  const table = new ByteView(source.table, 'invalid-story-data')
  let remaining = source.limits.maxTextboxEntries

  /** @param range - Original FIB locator. @param width - Original fixed payload size. @returns Extent checked and budgeted PLC storage, before output allocation. */
  function plc(range: WordRecordRange, width: number): TextboxPlc {
    if (!range.length) return { view: null, count: 0, terminalCp: null }
    const count = (range.length - 4) / (width + 4)
    requireDoc(Number.isInteger(count) && count >= 0, 'invalid-story-data', 'Invalid textbox PLC record extent')
    requireDoc(count <= remaining, 'limit-exceeded', 'Combined textbox metadata entry limit exceeded')
    remaining -= count; reader.consume(count)
    const view = new ByteView(table.slice(range.offset, range.length), 'invalid-story-data')
    return { view, count, terminalCp: view.u32(count * 4) }
  }

  const parts = ([['textbox', 5, 56, 75], ['headerTextbox', 6, 58, 76]] as const).map(([kind, storyIndex, textIndex, breakIndex]) => {
    const story = source.header.stories[storyIndex]!, length = story.end - story.start
    const text = plc(source.header.records[textIndex]!, 22), display = plc(source.header.records[breakIndex]!, 6)
    requireDoc(!length || text.count > 0, 'invalid-story-data', 'Textbox subdocument has no descriptor table')
    const entries: DocTextboxEntry[] = [], breaks: DocTextboxBreak[] = []
    for (let index = 0; index < text.count; index++) {
      const view = text.view!, at = (text.count + 1) * 4 + index * 22
      const reuseFlags = view.u16(at + 8), start = view.u32(index * 4), end = view.u32((index + 1) * 4)
      const reusable = index === text.count - 1 || reuseFlags !== 0
      if (length) {
        requireDoc(index !== 0 || start === 0, 'invalid-story-data', 'Textbox descriptor coverage does not start at zero')
        if (index === text.count - 1) requireDoc(start === length - 1, 'invalid-story-data', 'Textbox final spare does not follow its source content')
        else requireDoc(end > start && end < length && (reusable ? end - start === 1 : end - start > 1)
          && source.storage.text.charCodeAt(story.start + end - 1) === 13,
        'invalid-story-data', 'Invalid textbox content interval or missing source separator')
      } else requireDoc(reusable, 'invalid-story-data', 'Empty textbox subdocument has an active descriptor')
      entries.push({ index, start, end, reuseFlags, reusable, data: [view.u32(at), view.u32(at + 4)],
        destination: view.u32(at + 10), shapeId: view.u32(at + 14), undoTextId: view.u32(at + 18) })
    }
    // Display PLC endpoints can be cached or unknown. Preserve every field, but
    // never use those operands to slice or duplicate author content here.
    for (let index = 0; index < display.count; index++) {
      const view = display.view!, at = (display.count + 1) * 4 + index * 6
      breaks.push({ index, start: view.u32(index * 4), end: view.u32((index + 1) * 4),
        textboxIndex: view.u16(at), dependency: view.u16(at + 2) << 16 >> 16, flags: view.u16(at + 4) })
    }
    return { kind, entries, breaks, textTerminalCp: text.terminalCp, breakTerminalCp: display.terminalCp }
  })
  return { scope: 'textbox-source', parts }
}
