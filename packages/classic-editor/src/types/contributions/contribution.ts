import type { ClassicEditorInsertItemContribution } from "./insert";
import type {
  ClassicEditorActionContextMenuItemContribution,
  ClassicEditorContextMenuItemContribution,
  ClassicEditorActionSelectionPopupItemContribution,
  ClassicEditorSelectionPopupItemContribution
} from "./behavior-surfaces";
import type {
  ClassicEditorContextualPopupItemContribution
} from "./contextual-popup";
import type { ClassicEditorSelectionPopupWidgetContribution } from "./selection-popup/types";
import type {
  ClassicEditorDocumentServiceMenuContribution,
  ClassicEditorActionRibbonControlContribution,
  ClassicEditorActionToolbarControlContribution,
  ClassicEditorMenuItemContribution,
  ClassicEditorRibbonControlContribution,
  ClassicEditorRibbonGroupContribution,
  ClassicEditorRibbonTabContribution,
  ClassicEditorToolbarControlContribution
} from "./controls";
import type { ClassicEditorPopmenuContribution } from "./popmenu";
import type { ClassicEditorBlockPresentationContribution, ClassicEditorBlockTypeContribution } from "./block-types/types";
import type {
  ClassicEditorDialogContribution,
  ClassicEditorGlobalSettingsSectionContribution,
  ClassicEditorRibbonWidgetContribution,
  ClassicEditorRulerContribution,
  ClassicEditorSidebarPanelContribution,
  ClassicEditorStatusItemContribution,
  ClassicEditorWorkspaceWidgetContribution
} from "./surfaces";

/** Ordered item that can appear inside one Classic ribbon group. */
export type ClassicEditorRibbonItemContribution =
  | ClassicEditorRibbonControlContribution
  | ClassicEditorActionRibbonControlContribution
  | ClassicEditorRibbonWidgetContribution;

/** Every UI contribution supported by the Classic Editor registry. */
export type ClassicEditorContribution =
  | ClassicEditorInsertItemContribution
  | ClassicEditorBlockTypeContribution
  | ClassicEditorBlockPresentationContribution
  | ClassicEditorMenuItemContribution
  | ClassicEditorDocumentServiceMenuContribution
  | ClassicEditorRibbonTabContribution
  | ClassicEditorRibbonGroupContribution
  | ClassicEditorRibbonControlContribution
  | ClassicEditorActionRibbonControlContribution
  | ClassicEditorRibbonWidgetContribution
  | ClassicEditorWorkspaceWidgetContribution
  | ClassicEditorToolbarControlContribution
  | ClassicEditorActionToolbarControlContribution
  | ClassicEditorSidebarPanelContribution
  | ClassicEditorGlobalSettingsSectionContribution
  | ClassicEditorStatusItemContribution
  | ClassicEditorRulerContribution
  | ClassicEditorDialogContribution
  | ClassicEditorPopmenuContribution
  | ClassicEditorContextMenuItemContribution
  | ClassicEditorActionContextMenuItemContribution
  | ClassicEditorSelectionPopupItemContribution
  | ClassicEditorActionSelectionPopupItemContribution
  | ClassicEditorSelectionPopupWidgetContribution
  | ClassicEditorContextualPopupItemContribution;
