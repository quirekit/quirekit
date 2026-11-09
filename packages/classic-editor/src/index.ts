export { defineClassicEditorPlugin } from "./plugin";
export {
  ClassicEditorBold,
  ClassicEditorTextCase,
  classicEditorTextCaseActions,
  classicEditorTextCaseLabel,
  classicEditorTextCaseModes,
  ClassicEditorClipboard,
  classicEditorClipboardActions,
  classicEditorClipboardContextMenuItems,
  runClassicEditorClipboardOperation,
  ClassicEditorFormatting,
  ClassicEditorFormattingTools,
  ClassicEditorBackgroundColor,
  ClassicEditorColor,
  ClassicEditorFontFamily,
  ClassicEditorFontSize,
  ClassicEditorHorizontalRule,
  ClassicEditorHistoryControls,
  ClassicEditorItalic,
  ClassicEditorKit,
  ClassicEditorSearch,
  ClassicEditorStrike,
  ClassicEditorTextStyle,
  ClassicEditorUnderline,
  ClassicEditorSuperscript,
  ClassicEditorSubscript,
  ClassicTextSettingsPanel,
  ClassicEditorUndoRedo,
  getClassicSearchSession
} from "./extensions";
export type {
  ClassicEditorClipboardOperation,
  ClassicEditorClipboardOptions,
  ClassicEditorFormattingOptions,
  ClassicEditorKitOptions,
  ClassicSearchMode,
  ClassicSearchSession
} from "./extensions";
export {
  classicEditorOperationFeedbackEvent,
  emitClassicEditorOperationFeedback,
  classicEditorDocumentServiceReportEvent,
  classicEditorDocumentServiceStartEvent,
  classicEditorDocumentServiceSuccessEvent,
  classicEditorDocumentServiceErrorEvent,
  type ClassicEditorDocumentServiceDiagnostic,
  type ClassicEditorDocumentServiceErrorDetail,
  type ClassicEditorDocumentServiceReportDetail,
  type ClassicEditorDocumentServiceStartDetail,
  type ClassicEditorDocumentServiceSuccessDetail,
  type ClassicEditorDocumentServiceWarning,
  type ClassicEditorOperationFeedbackDetail,
  type ClassicEditorOperationFeedbackItem,
  type ClassicEditorOperationFeedbackTone
} from "./service";
export { createClassicEditorRegistry } from "./plugin";
export {
  defaultClassicEditorLocale,
  defineClassicEditorText,
  resolveClassicEditorText
} from "./localization";
export {
  classicEditorPreset,
  createClassicEditorDefaultDocument,
  defaultClassicEditorFeatures,
  defaultClassicEditorShell
} from "./preset";
export {
  createClassicEditor,
  updateClassicEditorPresetPresentation,
  createDefaultClassicEditorWebFontOptions,
  createDefaultClassicEditorMediaServices,
  createDefaultClassicEditorHostServices,
  ClassicEditorHostResourceCoordinator,
  ClassicEditorHostResourceTaskRuntime,
  ClassicEditorTargetFreshnessRegistry
} from "./runtime";
export {
  createActionContext,
  executeClassicEditorAction,
  resolveClassicEditorActionState
} from "./runtime/ui";
export {
  classicEditorSuggestionOverlayOwnerAttribute,
  createClassicEditorSuggestionOverlayPort
} from "./runtime/suggestion";
export type { ClassicEditorSuggestionOverlayPort } from "./runtime/suggestion";
export {
  ClassicEditorWorkspacePanelHostRuntime,
  projectClassicEditorWorkspacePanelHost,
  projectClassicEditorWorkspacePanelProduct
} from "./runtime/workspace-panel";
export {
  ClassicEditorInsertCatalog,
  classicEditorInsertGroups,
  createClassicEditorInsertItemFromSuggestion,
  getClassicEditorInsertTextVariants,
  getClassicEditorInsertGroup,
  localizeClassicEditorInsertText
} from "./runtime/insert";
export {
  classicEditorInsertContributionIds,
  createClassicEditorInsertCatalogContributions
} from "./shell/contribution/insert";
export {
  ClassicEditorObjectWorkspaceHostRegistry,
  ClassicEditorObjectWorkspaceRuntime,
  classicEditorObjectWorkspaceHosts,
  resolveClassicEditorObjectBarPlacement
} from "./runtime/object-workspace";
export {
  classicEditorObjectWorkspaceContribution,
  createClassicEditorObjectInspectorPanel
} from "./shell/contribution/object-workspace";
export {
  ClassicEditorObjectColorSurface,
  ClassicEditorObjectMenuSurface,
  mountClassicEditorObjectWorkspace
} from "./shell/components/object-workspace";
export { default as ClassicEditorSvgIcon } from "./shell/components/svg-icon.vue";
export { SuggestionController } from "@quirekit/editor-ui";
export type {
  ResolvedSuggestionResult,
  SuggestionAcceptIntent,
  SuggestionCancelReason,
  SuggestionControllerOptions,
  SuggestionKeyboardResult,
  SuggestionOverlayPort,
  SuggestionPhase,
  SuggestionProvider,
  SuggestionProviderPhase,
  SuggestionProviderRequest,
  SuggestionProviderState,
  SuggestionResult,
  SuggestionSessionInput,
  SuggestionState,
  SuggestionStateListener,
  SuggestionTarget,
  SuggestionTrigger,
  SuggestionTriggerKind
} from "@quirekit/editor-ui";
export {
  createClassicEditorLocalFontLibraryPersistence,
  createClassicEditorMemoryFontLibraryPersistence,
  createClassicChineseWebFontsSource,
  createClassicFontsourceSource,
  createClassicGoogleFontsSource,
  createEmptyClassicEditorFontLibraryState
} from "./runtime/web-fonts";
export type {
  CreateClassicChineseWebFontsSourceOptions,
  CreateClassicFontsourceSourceOptions,
  CreateClassicGoogleFontsSourceOptions
} from "./runtime/web-fonts";
export type {
  ClassicEditorAudience,
  ClassicEditorActionContext,
  ClassicEditorActionContextMenuItemContribution,
  ClassicEditorActionDefinition,
  ClassicEditorActionRibbonControlContribution,
  ClassicEditorActionToolbarControlContribution,
  ClassicEditorBehavior,
  ClassicEditorBehaviorContext,
  ClassicEditorBehaviorSurfaceItemContribution,
  ClassicEditorBehaviorSurfaceTrigger,
  ClassicEditorBehaviorTrigger,
  ClassicEditorBlockInsertionTarget,
  ClassicEditorInsertItemContribution,
  ClassicEditorBlockPresentation,
  ClassicEditorBlockPresentationContribution,
  ClassicEditorBlockTypeContribution,
  ClassicEditorContribution,
  ClassicEditorContributionBase,
  ClassicEditorBilingualText,
  ClassicEditorControlContribution,
  ClassicEditorContextMenuItemContribution,
  ClassicEditorContextMenuItemPresentation,
  ClassicEditorContextMenuItemRole,
  ClassicEditorContextMenuSelection,
  ClassicEditorContextMenuTrigger,
  ClassicEditorContextualPopupItemContribution,
  ClassicEditorContextualPopupTrigger,
  ClassicEditorDocumentFormat,
  ClassicEditorDocumentFontStatus,
  ClassicEditorDocumentFontStatusKind,
  ClassicEditorDocumentServiceMenuContribution,
  ClassicEditorDialogContribution,
  ClassicEditorExportArtifact,
  ClassicEditorFeatureOptions,
  ClassicEditorFontLibrary,
  ClassicEditorFontHubMessageKey,
  ClassicEditorFontHubMessages,
  ClassicEditorFontHubProps,
  ClassicEditorGlobalSettingsSectionContribution,
  ClassicEditorCustomWebFontSourceRecord,
  ClassicEditorFontLibraryPersistedState,
  ClassicEditorFontLibraryPersistence,
  ClassicEditorHookContext,
  ClassicEditorHostAcquireIntent,
  ClassicEditorHostAcquireResult,
  ClassicEditorHostAdapterRequest,
  ClassicEditorHostCancelledResult,
  ClassicEditorHostDiagnostic,
  ClassicEditorHostJobProgress,
  ClassicEditorHostJobSnapshot,
  ClassicEditorHostOpenIntent,
  ClassicEditorHostOpenResult,
  ClassicEditorHostOpenSuccessResult,
  ClassicEditorHostPreparedResource,
  ClassicEditorHostPreparedSuccessResult,
  ClassicEditorHostProgressReporter,
  ClassicEditorHostRejectedResult,
  ClassicEditorHostResolveIntent,
  ClassicEditorHostResolveResult,
  ClassicEditorHostResourceController,
  ClassicEditorHostResourceTaskAttempt,
  ClassicEditorHostResourceTaskCancelled,
  ClassicEditorHostResourceTaskController,
  ClassicEditorHostResourceTaskFailed,
  ClassicEditorHostResourceTaskInput,
  ClassicEditorHostResourceTaskPhase,
  ClassicEditorHostResourceTaskResult,
  ClassicEditorHostResourceTaskSuccess,
  ClassicEditorHostResourceTaskUpdate,
  ClassicEditorHostResourceIntent,
  ClassicEditorHostResourceIntentBase,
  ClassicEditorHostResourcePurpose,
  ClassicEditorHostResourceReference,
  ClassicEditorHostResourceResult,
  ClassicEditorHostResultBase,
  ClassicEditorHostServices,
  ClassicEditorHostSourceReference,
  ClassicEditorHostUploadIntent,
  ClassicEditorHostUploadResult,
  ClassicEditorResourceTaskFeedbackInput,
  ClassicEditorImportExportService,
  ClassicEditorImportArtifact,
  ClassicEditorImportContext,
  ClassicEditorImportOptions,
  ClassicEditorIngestionTarget,
  ClassicEditorInsertionBookmarkTarget,
  ClassicEditorInstance,
  ClassicEditorKeyboardShortcut,
  ClassicEditorLocale,
  ClassicEditorMediaServices,
  ClassicEditorActionMenuItemContribution,
  ClassicEditorLegacyMenuItemContribution,
  ClassicEditorMenuItemContribution,
  ClassicEditorMenuItemPlacement,
  ClassicEditorMountedRenderable,
  ClassicEditorNodeTarget,
  ClassicEditorOptions,
  ClassicEditorPlugin,
  ClassicEditorPopmenuContribution,
  ClassicEditorPopmenuItem,
  ClassicEditorPreset,
  ClassicEditorPresetContext,
  ClassicEditorPresetPresentationContext,
  ClassicEditorRegistrySnapshot,
  ClassicEditorRenderContext,
  ClassicEditorResolvedFeatures,
  ClassicEditorRulerContribution,
  ClassicEditorRulerController,
  ClassicEditorRulerMountContext,
  ClassicEditorRibbonControlContribution,
  ClassicEditorRibbonGroupContribution,
  ClassicEditorRibbonItemContribution,
  ClassicEditorRibbonTabContribution,
  ClassicEditorRibbonWidgetContribution,
  ClassicEditorDomRibbonWidgetContribution,
  ClassicEditorVueRibbonWidgetContribution,
  ClassicEditorConfiguredRibbonWidgetContribution,
  ClassicEditorRibbonWidgetController,
  ClassicEditorToolbarContributionState,
  ClassicEditorToolbarContribution,
  ClassicEditorToolbarContributionFactory,
  ClassicEditorWorkspaceWidgetContribution,
  ClassicEditorServiceContext,
  ClassicEditorSelectionPopupItemContribution,
  ClassicEditorAnySelectionPopupItemContribution,
  ClassicEditorSelectionPopupActionContribution,
  ClassicEditorSelectionPopupWidgetContribution,
  ClassicEditorSelectionPopupPlacement,
  ClassicEditorSelectionPopupTrigger,
  ClassicEditorShellOptions,
  ClassicEditorSidebarOpenOptions,
  ClassicEditorSidebarPanelContribution,
  ClassicEditorSidebarPanelScrollOwner,
  ClassicEditorSidebarState,
  ClassicEditorStatusItemContribution,
  ClassicEditorSurfaceMode,
  QuireKitTheme,
  ClassicEditorText,
  ClassicEditorTargetBookmark,
  ClassicEditorTargetFreshnessInput,
  ClassicEditorTargetFreshnessResult,
  ClassicEditorToolbarControlContribution,
  ClassicEditorUiController,
  ClassicEditorUiProfileOptions,
  ClassicEditorUiState,
  ClassicEditorUiSurfaceProfile,
  ClassicEditorUpdateOptions,
  ClassicEditorViewBackend,
  ClassicEditorViewOptions,
  ClassicEditorZoomMode,
  ClassicEditorDocumentTarget,
  ClassicEditorWebFontFamily,
  ClassicEditorWebFontBrowseRequest,
  ClassicEditorWebFontCatalogPage,
  ClassicEditorWebFontOptions,
  ClassicEditorWebFontResolutionRequest,
  ClassicEditorWebFontSearchRequest,
  ClassicEditorWebFontSource,
  ClassicEditorWebFontSourceSettingField,
  ClassicEditorWebFontSourceSettings,
  ClassicEditorImportedWebFontFamily
} from "./types";
export {
  createClassicEditorRibbonAction,
  createClassicEditorSelectionPopupAction,
  createClassicEditorToolbarAction
} from "./extensions/surfaces";
export { resolveClassicEditorIcon } from "./icons";
export type { ClassicEditorIconName } from "./icons";
export {
  classicEditorOverlayOwnerAttribute,
  useClassicEditorOverlay
} from "./shell/overlays/registry";
export {
  readClassicEditorTheme,
  readClassicEditorThemeVariables
} from "./shell/theme";
export {
  applyClassicEditorLocale,
  readClassicEditorAppearance,
  readClassicEditorLocale
} from "./shell/appearance";
export {
  createClassicEditorUiApp
} from "./shell/vue-app";
export type { ClassicEditorUiAppearance, ClassicEditorUiAppOptions } from "./shell/types";
export {
  ClassicEditorConfirmDialog
} from "./ui/confirm-dialog";
export type {
  ClassicEditorConfirmDialogProps
} from "./ui/confirm-dialog";
export {
  ClassicEditorCommandPopover
} from "./ui/command-popover";
export type {
  ClassicEditorCommandPopoverPadding,
  ClassicEditorCommandPopoverPlacement,
  ClassicEditorCommandPopoverProps,
  ClassicEditorCommandPopoverRole,
  ClassicEditorCommandPopoverSlots
} from "./ui/command-popover";
export {
  ClassicEditorCommandMenu
} from "./ui/command-menu";
export type {
  ClassicEditorCommandMenuItem,
  ClassicEditorCommandMenuProps,
  ClassicEditorCommandMenuSlots
} from "./ui/command-menu";

export {
  ClassicEditorTaskDialog
} from "./ui/task-dialog";
export type {
  ClassicEditorTaskDialogProps,
  ClassicEditorTaskDialogSize,
  ClassicEditorTaskDialogSlots,
  ClassicEditorTaskDialogTone
} from "./ui/task-dialog";
export {
  ClassicEditorWorkspaceDialog
} from "./ui/workspace-dialog";
export type {
  ClassicEditorWorkspaceDialogProps,
  ClassicEditorWorkspaceDialogSize,
  ClassicEditorWorkspaceDialogSlots
} from "./ui/workspace-dialog";
export {
  ClassicEditorPopupMenu,
  ClassicEditorPopupMenuItem
} from "./ui/popup-menu";
export {
  ClassicEditorAnchoredOverlay,
  classicEditorDocumentOverlaySelector,
  projectClassicEditorAnchoredOverlayAnchor,
  resolveClassicEditorDocumentOverlayHost
} from "./ui/anchored-overlay";
export type {
  ClassicEditorAnchoredOverlayAnchor,
  ClassicEditorAnchoredOverlayPlacement,
  ClassicEditorAnchoredOverlayProps,
  ClassicEditorAnchoredOverlayScope,
  ClassicEditorAnchoredOverlaySlots,
  ClassicEditorOverlayRect
} from "./ui/anchored-overlay";
export type {
  ClassicEditorOverlayController,
  ClassicEditorOverlayOptions,
  ClassicEditorOverlayScope
} from "./shell/overlays/registry";
export type {
  ClassicEditorPopupMenuAnchor,
  ClassicEditorPopupMenuDropdownItem,
  ClassicEditorPopupMenuItemProps,
  ClassicEditorPopupMenuPlacement,
  ClassicEditorPopupMenuProps,
  ClassicEditorPopupMenuSlots
} from "./ui/popup-menu";
export * from "./types/tasks";
export * from "./types/insert";
export * from "./types/object-workspace";
export * from "./types/workspace-panel";
export { composeClassicEditorToolbar } from "./extensions/toolbar/composition";
export { createClassicEditorTextFormattingToolbar } from "./extensions/toolbar/text-formatting";
export { runClassicEditorInsertion } from "./runtime/insert/block-target";
export { classicEditorSelectionPopupSuppressMeta } from "./shell/components/selection-popup/suppression";
export { ClassicDataView } from "./data-view/extension";
