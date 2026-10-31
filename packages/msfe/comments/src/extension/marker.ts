import type { ComponentViewRenderer } from "@quirekit/msfe-core";
import type { CommentMarkerProps } from "../controller/types";

/** @param mount - Framework-neutral component boundary. @returns Accessible native marker; products supply their own icon button. */
export const nativeCommentMarker: ComponentViewRenderer<CommentMarkerProps> = mount => {
  const button = mount.dom.ownerDocument.createElement("button");
  button.type = "button"; button.className = "msfe-comment-marker";
  let current = mount.props;
  /** Focuses the thread with the newest props. */
  function activate(): void { current.activate(); }
  /** @param props - Current marker inputs. */
  function update(props: CommentMarkerProps): void {
    current = props;
    button.setAttribute("aria-label", props.label);
    button.classList.toggle("msfe-comment-marker-active", props.active);
  }
  button.addEventListener("click", activate); update(current); mount.dom.append(button);
  return { update,
    /** Releases only this marker's DOM and listener. */
    destroy() { button.removeEventListener("click", activate); button.remove(); },
  };
};
