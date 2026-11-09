import type {
  ClassicEditorContribution,
  ClassicEditorImportExportService,
  ClassicEditorKeyboardShortcut,
  ClassicEditorPlugin,
  ClassicEditorResolvedFeatures,
  ClassicEditorSurfaceMode,
  ClassicEditorUiProfileOptions
} from "../../types";
import {
  collectQuireExtensionContributions,
  type QuireAnyExtension
} from "@quirekit/core";
import {
  isClassicEditorAudienceVisible,
  resolveClassicEditorAudience,
  resolveClassicEditorChildAudience,
  type ClassicEditorAudienceDeclaration
} from "./audience";
import { isClassicEditorFeatureEnabled } from "./features";
import { applyClassicEditorUiProfile } from "./profile";
import {
  assertClassicEditorUniqueId,
  assertClassicEditorUniqueMapEntry,
  normalizeClassicEditorShortcut
} from "./validation";

/** Extension hooks that declare product UI without a catch-all registry channel. */
const extensionSurfaceHooks = Object.freeze([
  "addBlockTypes",
  "addBlockPresentations",
  "addInsertItems",
  "addRibbonTabs",
  "addRibbonGroups",
  "addRibbonItems",
  "addRibbonWidgets",
  "addWorkspaceWidgets",
  "addRulers",
  "addPopmenus",
  "addToolbarItems",
  "addContextMenuItems",
  "addSelectionPopupItems",
  "addContextualPopupItems",
  "addSidebarPanels",
  "addGlobalSettingsSections"
]);

/**
 * Collects globally named import/export services.
 *
 * @param plugins - Validated plugins.
 * @returns Readonly service map.
 */
export function collectClassicEditorServices(
  plugins: readonly ClassicEditorPlugin[]
): ReadonlyMap<string, ClassicEditorImportExportService> {
  const services = new Map<string, ClassicEditorImportExportService>();

  for (const plugin of plugins) {
    for (const service of plugin.services ?? []) {
      if (service.import === undefined && service.export === undefined) {
        throw new RangeError(
          `Classic Editor service "${service.id}" must define import or export.`
        );
      }
      assertClassicEditorUniqueMapEntry(services, service.id, service, "service");
    }
  }

  return services;
}

/**
 * Collects and validates every contribution before audience or feature filtering.
 *
 * @param plugins - Fully validated plugin declarations.
 * @param extensions - Resolved ordinary editor extensions.
 * @returns Frozen declarations with their inherited audience.
 */
export function collectClassicEditorContributionDeclarations(
  plugins: readonly ClassicEditorPlugin[],
  extensions: readonly QuireAnyExtension[]
): readonly ClassicEditorAudienceDeclaration<ClassicEditorContribution>[] {
  const declared: ClassicEditorAudienceDeclaration<ClassicEditorContribution>[] = [];
  const ids = new Set<string>();

  for (const plugin of plugins) {
    const contributions = [
      ...(plugin.contributions ?? []),
      ...(plugin.toolbarItems ?? []),
      ...(plugin.contextMenuItems ?? []),
      ...(plugin.selectionPopupItems ?? []),
      ...(plugin.contextualPopupItems ?? []),
      ...(plugin.sidebarPanels ?? []),
      ...(plugin.globalSettingsSections ?? [])
    ];
    for (const contribution of contributions) {
      assertClassicEditorUniqueId(ids, contribution.id, "contribution");
      declared.push(Object.freeze({
        value: contribution,
        audience: resolveClassicEditorChildAudience(
          plugin.audience,
          contribution.audience
        )
      }));
    }
  }

  for (const field of extensionSurfaceHooks) {
    collectExtensionSurfaceDeclarations(extensions, field, ids, declared);
  }
  return Object.freeze(declared);
}

/**
 * Selects visible contributions while preserving deterministic order.
 *
 * @param declarations - Validated declarations with inherited audiences.
 * @param features - Resolved feature switches.
 * @param surfaceMode - Create-time product surface mode.
 * @param ui - Final product-surface composition.
 * @returns Visible contributions ordered by `order` and declaration position.
 */
export function collectClassicEditorContributions(
  declarations: readonly ClassicEditorAudienceDeclaration<ClassicEditorContribution>[],
  features: ClassicEditorResolvedFeatures,
  surfaceMode: ClassicEditorSurfaceMode,
  ui: ClassicEditorUiProfileOptions | undefined
): readonly ClassicEditorContribution[] {
  const ordered = declarations
    .filter(({ audience, value }) => (
      isClassicEditorAudienceVisible(audience, surfaceMode)
      && isClassicEditorFeatureEnabled(value.feature, features)
    ))
    .map(({ value: contribution }, index) => ({ contribution, index }))
    .sort((left, right) => (
      (left.contribution.order ?? 0) - (right.contribution.order ?? 0)
      || left.index - right.index
    ))
    .map(({ contribution }) => contribution);
  return Object.freeze(applyClassicEditorUiProfile(ordered, ui));
}

/**
 * Collects one separately named extension surface as validated declarations.
 *
 * @param extensions - Resolved editor extensions.
 * @param field - Exact Classic surface hook name.
 * @param ids - Global contribution-id authority.
 * @param target - Declaration accumulator.
 */
function collectExtensionSurfaceDeclarations(
  extensions: readonly QuireAnyExtension[],
  field: string,
  ids: Set<string>,
  target: ClassicEditorAudienceDeclaration<ClassicEditorContribution>[]
): void {
  const owned = collectQuireExtensionContributions<ClassicEditorContribution>(
    extensions,
    field
  );
  for (const entry of owned) {
    assertClassicEditorUniqueId(ids, entry.contribution.id, "contribution");
    target.push(Object.freeze({
      value: entry.contribution,
      audience: resolveClassicEditorChildAudience(
        undefined,
        entry.contribution.audience
      )
    }));
  }
}

/**
 * Normalizes and validates every shortcut before audience or feature filtering.
 *
 * @param plugins - Validated plugins.
 * @returns Frozen shortcuts with their inherited plugin audience.
 */
export function collectClassicEditorShortcutDeclarations(
  plugins: readonly ClassicEditorPlugin[]
): readonly ClassicEditorAudienceDeclaration<ClassicEditorKeyboardShortcut>[] {
  const declarations: ClassicEditorAudienceDeclaration<ClassicEditorKeyboardShortcut>[] = [];
  const signatures = new Set<string>();

  for (const plugin of plugins) {
    for (const shortcut of plugin.keyboardShortcuts ?? []) {
      const signature = normalizeClassicEditorShortcut(shortcut.shortcut);
      assertClassicEditorUniqueId(signatures, signature, "keyboard shortcut");
      declarations.push(Object.freeze({
        value: Object.freeze({ ...shortcut, shortcut: signature }),
        audience: resolveClassicEditorAudience(plugin.audience)
      }));
    }
  }

  return Object.freeze(declarations);
}

/**
 * Selects active shortcuts from the fully validated declaration set.
 *
 * @param declarations - Normalized shortcut declarations.
 * @param features - Resolved feature switches.
 * @param surfaceMode - Create-time product surface mode.
 * @returns Active normalized keyboard shortcuts.
 */
export function collectClassicEditorShortcuts(
  declarations: readonly ClassicEditorAudienceDeclaration<ClassicEditorKeyboardShortcut>[],
  features: ClassicEditorResolvedFeatures,
  surfaceMode: ClassicEditorSurfaceMode
): readonly ClassicEditorKeyboardShortcut[] {
  return Object.freeze(declarations
    .filter(({ audience, value }) => (
      isClassicEditorAudienceVisible(audience, surfaceMode)
      && isClassicEditorFeatureEnabled(value.feature, features)
    ))
    .map(({ value }) => value));
}
