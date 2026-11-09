import { createWordTableMapDiagnostic } from '../diagnostics'
import { resolveSemanticCell } from './semantic'
import type { MutableSemanticCellRef } from './internal'
import type { ExplicitRowCell, RowSemanticResolutionOptions } from './types'

/**
 * Resolves legacy horizontal groups before their full interval enters vertical ownership.
 * @param cells - All physical cells in source order, with immutable source positions.
 * @param options - Shared row/header, chain, owner and diagnostic state.
 */
export function resolveHorizontalMergeGroups(cells: readonly ExplicitRowCell[], options: RowSemanticResolutionOptions): void {
  for (let first = 0; first < cells.length;) {
    const origin = cells[first]!
    let end = first + 1
    let span = origin.explicit.range.columnSpan
    if (origin.node.attrs.hMerge === 'restart') {
      while (end < cells.length && cells[end]!.node.attrs.hMerge === 'continue') {
        span += cells[end]!.explicit.range.columnSpan
        end++
      }
    }
    // Only the semantic candidate uses the group's full interval. Each stored
    // explicit cell retains its own range, source id and PM position for export.
    const candidate = end === first + 1 ? origin.explicit : { ...origin.explicit,
      range: { ...origin.explicit.range, columnSpan: span }, gridSpan: span }
    const semantic = resolveSemanticCell({ ...options, explicitCell: candidate })
    origin.explicit.semanticCellId = semantic.id
    origin.explicit.role = candidate.role
    if (origin.node.attrs.hMerge === 'continue') diagnose('hmerge-orphan-continue',
      'Horizontal merge continuation has no adjacent restart owner.', origin, semantic, options)

    for (let index = first + 1; index < end; index++) {
      const entry = cells[index]!
      entry.explicit.semanticCellId = semantic.id
      entry.explicit.role = 'horizontalContinuation'
      semantic.continuationExplicitCellIds.push(entry.explicit.id)
      if (hasContinuationPayload(entry)) diagnose('hmerge-continuation-content',
        'Horizontal merge continuation contains stored text, atomic content or an unsupported block.', entry, semantic, options)
      if (entry.explicit.vMerge !== origin.explicit.vMerge) diagnose('hmerge-vertical-role-mismatch',
        'Horizontal merge members have different vertical merge roles.', entry, semantic, options)
    }
    first = end
  }
}

/**
 * Treats whitespace and atomic content as payload rather than silently discarding it during split.
 * @param entry - Physical continuation node and source identity.
 * @returns Whether an explicit structural edit requires a content disposition.
 */
function hasContinuationPayload(entry: ExplicitRowCell): boolean {
  let found = false
  entry.node.descendants(node => {
    if (node.isText && node.text!.length > 0 || node.isAtom || !node.isText && node.type.name !== 'paragraph') found = true
    return !found
  })
  return found
}

/**
 * Records an unsafe group while leaving all physical source data intact.
 * @param code - Stable horizontal-group diagnostic.
 * @param message - Independent reason the group cannot support lossless structural commands.
 * @param entry - Located physical member.
 * @param semantic - Derived owner marked unsafe for commands.
 * @param options - Shared diagnostic owner.
 */
function diagnose(code: 'hmerge-orphan-continue' | 'hmerge-continuation-content' | 'hmerge-vertical-role-mismatch', message: string,
  entry: ExplicitRowCell, semantic: MutableSemanticCellRef, options: RowSemanticResolutionOptions): void {
  semantic.wellFormed = false
  options.diagnostics.push(createWordTableMapDiagnostic({ code, message, rowIndex: entry.explicit.rowIndex,
    cellIndex: entry.explicit.cellIndex, range: entry.explicit.range, explicitCellIds: [entry.explicit.id], semanticCellIds: [semantic.id] }))
}
