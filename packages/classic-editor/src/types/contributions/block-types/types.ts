import type { QuireJSONContent } from "@quirekit/core";
import type { Node as PMNode } from "@quirekit/pm";
import type { QuireBlockTone } from "@quirekit/ui/vue";
import type { ClassicEditorText } from "../../base";
import type { ClassicEditorActionDefinition } from "../action-catalog";
import type { ClassicEditorRenderContext } from "../../context";
import type { ClassicEditorContributionBase } from "../base";

/** Type mark shown on a block's handle. */
export interface ClassicEditorBlockPresentation {
  /** Public UI icon identifier, used when no badge is given. */
  readonly icon?: string | undefined;
  /** Short text mark such as H1, preferred over the icon. */
  readonly badge?: string | undefined;
  /** Color family of the mark. */
  readonly tone: QuireBlockTone;
}

/** Feature-owned identity of blocks the shell cannot read from their node type. */
export interface ClassicEditorBlockPresentationContribution extends ClassicEditorContributionBase {
  /** Block presentation discriminator. */
  readonly kind: "block-presentation";
  /**
   * Describes one hovered block.
   * @param node - Current block.
   * @param context - Current document registries.
   * @returns Handle mark, or null to leave the block to later owners.
   */
  readonly resolve: (node: PMNode, context: ClassicEditorRenderContext) => ClassicEditorBlockPresentation | null;
}

/** Feature-owned block preset shared by conversion and insertion menus. */
export interface ClassicEditorBlockTypeContribution extends ClassicEditorContributionBase {
  /** Block preset discriminator. */
  readonly kind: "block-type";
  /** Localized type name. */
  readonly label: ClassicEditorText;
  /** Public UI icon identifier. */
  readonly icon: string;
  /** Converts the complete selected blocks through their semantic owner. */
  readonly action: ClassicEditorActionDefinition;
  /**
   * Creates an empty block with the same semantics as conversion.
   * @param context - Current document registry and product capabilities.
   * @returns Insertion content, or null when the preset is unavailable.
   */
  readonly createContent: (context: ClassicEditorRenderContext) => QuireJSONContent | null;
}
