import { EditorView } from "@quirekit/cm-view";
import { syntaxTree } from "@quirekit/cm-language";
import { componentView, type ComponentViewRenderer, type MsfeEditor, type MsfeExtension } from "@quirekit/msfe-core";
import { toggleHeading } from "./actions";
import { nativeHeadingFoldControl } from "./controls";
import { headingBodyStart, headingNode, hasHeadingBody } from "./query";
import { headingFoldSnapshot, headingFoldSupport } from "./state";
import type { HeadingFoldControlProps, HeadingOptions } from "../types";

/** Control inputs that change what is displayed; the action is bound by the renderer. */
type HeadingFoldDisplay = Omit<HeadingFoldControlProps, "toggle">;

/**
 * @param control - Host or native disclosure control.
 * @param editor - Late canonical editor accessor.
 * @returns Renderer whose action resolves the heading from the control's current source position.
 */
function liveHeadingFoldControl(control: ComponentViewRenderer<HeadingFoldControlProps>, editor: () => MsfeEditor): ComponentViewRenderer<HeadingFoldDisplay> {
  return mount => {
    /** Toggles the heading this control sits on now, after any edits since it was built. */
    const toggle = (): void => {
      const view = EditorView.findFromDOM(mount.dom), current = editor();
      if (view) toggleHeading(current, headingFoldSnapshot.read(current.state), view.posAtDOM(mount.dom));
    };
    const handle = control({ ...mount, props: { ...mount.props, toggle } });
    return {
      ...(handle.ignoreEvent ? { ignoreEvent: (event: Event) => handle.ignoreEvent!(event) } : {}),
      update: props => handle.update({ ...props, toggle }),
      destroy: () => handle.destroy(),
    };
  };
}

/** @param options - Host controls and labels. @param name - Installed heading owner. @param editor - Late canonical editor accessor. @returns Native folding shared by source and rendered modes. */
export function headingFolding(options: HeadingOptions, name: string, editor: () => MsfeEditor): MsfeExtension {
  const renderer = liveHeadingFoldControl(options.controls ?? nativeHeadingFoldControl, editor);
  // Reusing unchanged props keeps each widget equal across edits, so typing elsewhere never redraws a heading line.
  let retained = new Map<string, HeadingFoldDisplay>();
  return { id: `${name}Folding`, states: [headingFoldSnapshot], extensions: [headingFoldSupport, EditorView.baseTheme({
    // A zero-width source decoration anchors disclosure without shifting text.
    // The host reserves the outer rail for dragging; the near 24 px belong here.
    // A line-height box shares the first-row center even in wrapped headings.
    ".msfe-heading-toggle": { display: "inline-block", position: "relative", width: "0", height: "1lh", verticalAlign: "top" },
    ".msfe-heading-toggle > button": { position: "absolute", left: "-24px", top: "50%", transform: "translateY(-50%)", opacity: "0" },
    // Rendered headings have an outer disclosure; source mode keeps CM's marker.
    ".msfe-heading .cm-foldPlaceholder": { display: "none" },
    ".msfe-heading-toggle > button[aria-expanded=false], .cm-line:hover .msfe-heading-toggle > button, .msfe-heading-toggle > button:hover, .msfe-heading-toggle > button:focus-visible": { opacity: "1" },
    "@media (hover: none)": { ".msfe-heading-toggle > button": { opacity: "1" } },
    ".msfe-heading-toggle-native": { display: "inline-flex", alignItems: "center", justifyContent: "center", width: "24px", height: "24px", padding: "0", border: "none",
      borderRadius: "4px", background: "transparent", color: "inherit", cursor: "pointer" },
    ".msfe-heading-toggle-native:hover": { background: "rgba(128,128,128,.12)" },
  })], layers: [{ key: "heading-fold-controls", placement: "inline", states: [headingFoldSnapshot],
    // The snapshot changes with every edit, so builds stay complete; incremental identities keep each control mounted as edits shift its heading.
    incremental: true,
    /** @param input - Viewport-bounded headings and native fold dependency. @returns Controls without scanning each heading's entire section. */
    build(input) {
      const snapshot = input.getState(headingFoldSnapshot), state = snapshot.state, current = new Map<string, HeadingFoldDisplay>();
      const items = input.query(name).matches.flatMap(match => {
        if (match.from < input.from || match.from > input.to) return [];
        const node = headingNode(syntaxTree(state), match.from);
        if (!node || !hasHeadingBody(node)) return [];
        const start = headingBodyStart(state, node);
        let expanded = true;
        snapshot.folds.between(start, start, from => { if (from === start) expanded = false; });
        const title = state.sliceDoc(match.from, start).replace(/^#{1,6}\s*|\s+#+\s*$/gu, "").trim();
        const label = options.toggleLabel(expanded, title), identity = `${expanded}\n${label}`;
        const display = retained.get(identity) ?? current.get(identity) ?? { expanded, label };
        current.set(identity, display);
        return [{ type: "widget" as const, key: `heading-${match.from}`, from: match.from, side: -1 as const, view: componentView(renderer, display) }];
      });
      retained = current;
      return items;
    },
  }] };
}
