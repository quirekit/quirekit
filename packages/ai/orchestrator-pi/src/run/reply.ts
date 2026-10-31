import type { QuireDocumentSdk } from "@quirekit/ai-runtime";

/** Text at the end of a streamed part that may still grow into a block or comment reference, such as "b", "[b1", "b3 到" or "c". */
const openReference = /\[?\b[bc]\d*\]?(?:\s*(?:-|–|—|~|～|到|至)\s*\[?[bc]?\d*)?$/u;

/** Streams assistant text through the document's reply presentation. */
export interface QuireAiPiReplyPresenter {
  /** @param delta - Next streamed part. */
  push(delta: string): void;
  /** Delivers text held back at the end of a message. */
  flush(): void;
}

/**
 * Presents streamed assistant text without internal block ids.
 *
 * A reference can arrive split across parts ("b" then "12"), so text that may still grow
 * into one is held until the next part or the end of the message. The reply language is
 * fixed by the first part with Chinese text, so one reply never mixes wordings.
 *
 * @param document - Document whose identities the reply refers to.
 * @param deliver - Receives presentable text.
 * @returns Presenter for one run.
 */
export function createQuireAiPiReplyPresenter(document: QuireDocumentSdk, deliver: ((text: string) => void) | undefined): QuireAiPiReplyPresenter {
  let held = "";
  let chinese = false;
  /** @param text - Text ready to show. */
  const send = (text: string) => {
    if (text.length === 0) return;
    chinese ||= /[㐀-鿿]/u.test(text);
    deliver?.(document.presentReply(text, chinese ? "zh" : "en"));
  };
  return {
    push(delta) {
      const text = held + delta;
      const open = openReference.exec(text);
      held = open === null ? "" : open[0];
      send(text.slice(0, text.length - held.length));
    },
    flush() {
      const text = held;
      held = "";
      send(text);
    }
  };
}
