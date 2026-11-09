import type { QuireExtensionThisContext } from "@quirekit/core";
import type {
  ClassicEditorInsertItemContribution,
  ClassicEditorBlockPresentationContribution,
  ClassicEditorBlockTypeContribution,
  ClassicEditorActionContextMenuItemContribution,
  ClassicEditorContextMenuItemContribution,
  ClassicEditorContextualPopupItemContribution,
  ClassicEditorGlobalSettingsSectionContribution,
  ClassicEditorPopmenuContribution,
  ClassicEditorRibbonControlContribution,
  ClassicEditorActionRibbonControlContribution,
  ClassicEditorRibbonGroupContribution,
  ClassicEditorRibbonTabContribution,
  ClassicEditorRibbonWidgetContribution,
  ClassicEditorRulerContribution,
  ClassicEditorSelectionPopupItemContribution,
  ClassicEditorActionSelectionPopupItemContribution,
  ClassicEditorSelectionPopupWidgetContribution,
  ClassicEditorSidebarPanelContribution,
  ClassicEditorToolbarControlContribution,
  ClassicEditorActionToolbarControlContribution,
  ClassicEditorWorkspaceWidgetContribution
} from "../types";

/** Factory installed on ordinary QuireKit extension config through augmentation. */
type ClassicEditorContributionFactory<Options extends object, Storage extends object, Value> = (
  this: QuireExtensionThisContext<Options, Storage>,
  context: QuireExtensionThisContext<Options, Storage>
) => readonly Value[];

declare module "@quirekit/core" {
  /** Classic product fields available to behavior extensions. */
  interface QuireExtensionConfig<Options extends object = object, Storage extends object = object> {
    /** Creates feature-owned insertion actions with explicit block-target support. */
    readonly addInsertItems?: ClassicEditorContributionFactory<Options, Storage, ClassicEditorInsertItemContribution>;
    /** Creates feature-owned block conversion and insertion presets. */
    readonly addBlockTypes?: ClassicEditorContributionFactory<Options, Storage, ClassicEditorBlockTypeContribution>;
    /** Creates feature-owned block handle identity. */
    readonly addBlockPresentations?: ClassicEditorContributionFactory<Options, Storage, ClassicEditorBlockPresentationContribution>;
    /** Creates compact-toolbar items owned by this extension. */
    readonly addToolbarItems?: ClassicEditorContributionFactory<Options, Storage, ClassicEditorToolbarControlContribution | ClassicEditorActionToolbarControlContribution>;
    /** Creates ribbon tabs owned by this extension. */
    readonly addRibbonTabs?: ClassicEditorContributionFactory<Options, Storage, ClassicEditorRibbonTabContribution>;
    /** Creates ribbon groups owned by this extension. */
    readonly addRibbonGroups?: ClassicEditorContributionFactory<Options, Storage, ClassicEditorRibbonGroupContribution>;
    /** Creates ribbon controls owned by this extension. */
    readonly addRibbonItems?: ClassicEditorContributionFactory<Options, Storage, ClassicEditorRibbonControlContribution | ClassicEditorActionRibbonControlContribution>;
    /** Creates compound mounted ribbon widgets owned by this extension. */
    readonly addRibbonWidgets?: ClassicEditorContributionFactory<Options, Storage, ClassicEditorRibbonWidgetContribution>;
    /** Creates always-mounted workspace widgets owned by this extension. */
    readonly addWorkspaceWidgets?: ClassicEditorContributionFactory<Options, Storage, ClassicEditorWorkspaceWidgetContribution>;
    /** Creates interactive rulers owned by this extension. */
    readonly addRulers?: ClassicEditorContributionFactory<Options, Storage, ClassicEditorRulerContribution>;
    /** Creates semantic event popmenus owned by this extension. */
    readonly addPopmenus?: ClassicEditorContributionFactory<Options, Storage, ClassicEditorPopmenuContribution>;
    /** Creates right-click menu items owned by this extension. */
    readonly addContextMenuItems?: ClassicEditorContributionFactory<Options, Storage, ClassicEditorContextMenuItemContribution | ClassicEditorActionContextMenuItemContribution>;
    /** Creates text-selection popup items owned by this extension. */
    readonly addSelectionPopupItems?: ClassicEditorContributionFactory<Options, Storage, ClassicEditorSelectionPopupItemContribution | ClassicEditorActionSelectionPopupItemContribution | ClassicEditorSelectionPopupWidgetContribution>;
    /** Creates target-keyed contextual Popup Menu items owned by this extension. */
    readonly addContextualPopupItems?: ClassicEditorContributionFactory<Options, Storage, ClassicEditorContextualPopupItemContribution>;
    /** Creates product sidebar panels owned by this extension. */
    readonly addSidebarPanels?: ClassicEditorContributionFactory<Options, Storage, ClassicEditorSidebarPanelContribution>;
    /** Creates sections composed inside the product global-settings panel. */
    readonly addGlobalSettingsSections?: ClassicEditorContributionFactory<Options, Storage, ClassicEditorGlobalSettingsSectionContribution>;
  }

  /** Classic product fields available to node extensions. */
  interface QuireNodeConfig<Options extends object = object, Storage extends object = object> {
    /** Creates feature-owned insertion actions with explicit block-target support. */
    readonly addInsertItems?: ClassicEditorContributionFactory<Options, Storage, ClassicEditorInsertItemContribution>;
    /** Creates feature-owned block conversion and insertion presets. */
    readonly addBlockTypes?: ClassicEditorContributionFactory<Options, Storage, ClassicEditorBlockTypeContribution>;
    /** Creates feature-owned block handle identity. */
    readonly addBlockPresentations?: ClassicEditorContributionFactory<Options, Storage, ClassicEditorBlockPresentationContribution>;
    /** Creates compact-toolbar items owned by this extension. */
    readonly addToolbarItems?: ClassicEditorContributionFactory<Options, Storage, ClassicEditorToolbarControlContribution | ClassicEditorActionToolbarControlContribution>;
    /** Creates ribbon tabs owned by this extension. */
    readonly addRibbonTabs?: ClassicEditorContributionFactory<Options, Storage, ClassicEditorRibbonTabContribution>;
    /** Creates ribbon groups owned by this extension. */
    readonly addRibbonGroups?: ClassicEditorContributionFactory<Options, Storage, ClassicEditorRibbonGroupContribution>;
    /** Creates ribbon controls owned by this extension. */
    readonly addRibbonItems?: ClassicEditorContributionFactory<Options, Storage, ClassicEditorRibbonControlContribution | ClassicEditorActionRibbonControlContribution>;
    /** Creates compound mounted ribbon widgets owned by this extension. */
    readonly addRibbonWidgets?: ClassicEditorContributionFactory<Options, Storage, ClassicEditorRibbonWidgetContribution>;
    /** Creates always-mounted workspace widgets owned by this extension. */
    readonly addWorkspaceWidgets?: ClassicEditorContributionFactory<Options, Storage, ClassicEditorWorkspaceWidgetContribution>;
    /** Creates interactive rulers owned by this extension. */
    readonly addRulers?: ClassicEditorContributionFactory<Options, Storage, ClassicEditorRulerContribution>;
    /** Creates semantic event popmenus owned by this extension. */
    readonly addPopmenus?: ClassicEditorContributionFactory<Options, Storage, ClassicEditorPopmenuContribution>;
    /** Creates right-click menu items owned by this extension. */
    readonly addContextMenuItems?: ClassicEditorContributionFactory<Options, Storage, ClassicEditorContextMenuItemContribution | ClassicEditorActionContextMenuItemContribution>;
    /** Creates text-selection popup items owned by this extension. */
    readonly addSelectionPopupItems?: ClassicEditorContributionFactory<Options, Storage, ClassicEditorSelectionPopupItemContribution | ClassicEditorActionSelectionPopupItemContribution | ClassicEditorSelectionPopupWidgetContribution>;
    /** Creates target-keyed contextual Popup Menu items owned by this extension. */
    readonly addContextualPopupItems?: ClassicEditorContributionFactory<Options, Storage, ClassicEditorContextualPopupItemContribution>;
    /** Creates product sidebar panels owned by this extension. */
    readonly addSidebarPanels?: ClassicEditorContributionFactory<Options, Storage, ClassicEditorSidebarPanelContribution>;
    /** Creates sections composed inside the product global-settings panel. */
    readonly addGlobalSettingsSections?: ClassicEditorContributionFactory<Options, Storage, ClassicEditorGlobalSettingsSectionContribution>;
  }

  /** Classic product fields available to mark extensions. */
  interface QuireMarkConfig<Options extends object = object, Storage extends object = object> {
    /** Creates feature-owned insertion actions with explicit block-target support. */
    readonly addInsertItems?: ClassicEditorContributionFactory<Options, Storage, ClassicEditorInsertItemContribution>;
    /** Creates feature-owned block conversion and insertion presets. */
    readonly addBlockTypes?: ClassicEditorContributionFactory<Options, Storage, ClassicEditorBlockTypeContribution>;
    /** Creates feature-owned block handle identity. */
    readonly addBlockPresentations?: ClassicEditorContributionFactory<Options, Storage, ClassicEditorBlockPresentationContribution>;
    /** Creates compact-toolbar items owned by this extension. */
    readonly addToolbarItems?: ClassicEditorContributionFactory<Options, Storage, ClassicEditorToolbarControlContribution | ClassicEditorActionToolbarControlContribution>;
    /** Creates ribbon tabs owned by this extension. */
    readonly addRibbonTabs?: ClassicEditorContributionFactory<Options, Storage, ClassicEditorRibbonTabContribution>;
    /** Creates ribbon groups owned by this extension. */
    readonly addRibbonGroups?: ClassicEditorContributionFactory<Options, Storage, ClassicEditorRibbonGroupContribution>;
    /** Creates ribbon controls owned by this extension. */
    readonly addRibbonItems?: ClassicEditorContributionFactory<Options, Storage, ClassicEditorRibbonControlContribution | ClassicEditorActionRibbonControlContribution>;
    /** Creates compound mounted ribbon widgets owned by this extension. */
    readonly addRibbonWidgets?: ClassicEditorContributionFactory<Options, Storage, ClassicEditorRibbonWidgetContribution>;
    /** Creates always-mounted workspace widgets owned by this extension. */
    readonly addWorkspaceWidgets?: ClassicEditorContributionFactory<Options, Storage, ClassicEditorWorkspaceWidgetContribution>;
    /** Creates interactive rulers owned by this extension. */
    readonly addRulers?: ClassicEditorContributionFactory<Options, Storage, ClassicEditorRulerContribution>;
    /** Creates semantic event popmenus owned by this extension. */
    readonly addPopmenus?: ClassicEditorContributionFactory<Options, Storage, ClassicEditorPopmenuContribution>;
    /** Creates right-click menu items owned by this extension. */
    readonly addContextMenuItems?: ClassicEditorContributionFactory<Options, Storage, ClassicEditorContextMenuItemContribution | ClassicEditorActionContextMenuItemContribution>;
    /** Creates text-selection popup items owned by this extension. */
    readonly addSelectionPopupItems?: ClassicEditorContributionFactory<Options, Storage, ClassicEditorSelectionPopupItemContribution | ClassicEditorActionSelectionPopupItemContribution | ClassicEditorSelectionPopupWidgetContribution>;
    /** Creates target-keyed contextual Popup Menu items owned by this extension. */
    readonly addContextualPopupItems?: ClassicEditorContributionFactory<Options, Storage, ClassicEditorContextualPopupItemContribution>;
    /** Creates product sidebar panels owned by this extension. */
    readonly addSidebarPanels?: ClassicEditorContributionFactory<Options, Storage, ClassicEditorSidebarPanelContribution>;
    /** Creates sections composed inside the product global-settings panel. */
    readonly addGlobalSettingsSections?: ClassicEditorContributionFactory<Options, Storage, ClassicEditorGlobalSettingsSectionContribution>;
  }
}

export {};
