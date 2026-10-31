import { componentView, type ProjectionDecoration, type ProjectionLayer } from "@quirekit/msfe-core";
import type { CommentsController } from "../controller/controller";
import type { CommentsOptions } from "../controller/types";
import { commentsState } from "../state/slot";
import { nativeCommentMarker } from "./marker";

/**
 * Highlights unresolved threads in every presentation mode. Ranges come from the comment state only,
 * so the layer rebuilds when comments change and otherwise follows the visible source.
 * @param options - Host marker configuration.
 * @param controller - Late controller access for marker activation.
 * @returns Inline projection layer.
 */
export function commentsLayer(options: CommentsOptions, controller: () => CommentsController | undefined): ProjectionLayer {
  return { key: "comments", placement: "inline", modes: ["source", "live", "locked"], states: [commentsState],
    /** @param input - Visible source bounds and comment state. @returns Highlights and markers. */
    build(input) {
      const state = input.getState(commentsState);
      return state.ranges.between(input.from, input.to).flatMap((range): ProjectionDecoration[] => {
        if (state.threads.get(range.id)?.resolved) return [];
        const active = state.active === range.id;
        // A point comment, or a quote whose text was deleted, has no text to highlight.
        if (range.from === range.to) return [{ type: "widget", from: range.from, key: `comment-${range.id}`, side: 1,
          view: componentView(options.marker ?? nativeCommentMarker, { threadId: range.id, active, label: options.markerLabel ?? "Comment",
            activate: () => { controller()?.activate(range.id); } }) }];
        return [{ type: "mark", from: range.from, to: range.to, class: active ? "msfe-comment msfe-comment-active" : "msfe-comment" }];
      });
    },
  };
}
