import { bindMountedDrawingKeyboard } from "../drawing-interaction/input/keyboard";
import { readMountedDrawingModel } from "../drawing-interaction/model";
import { activateMountedText } from "./text-activation";
import { createMountedHeaderFooterSessionLifecycle } from "./header-footer-session";
import type { QuireInteractionSelectionTarget, QuireSelectionGeometryContext } from "@quirekit/view-engine";
import { createMountedInputBinding } from "../input-binding";
import {
  createMountedDrawingContextualCommandsController,
  registerMountedDrawingInteraction,
  resolveMountedCreatedDrawingTextStory
} from "../drawing-interaction";
import type {
  MountedDrawingCreatedTextBox,
  MountedDrawingTextEditingSession
} from "../drawing-interaction";
import {
  matchesHeaderFooterSession,
  resolveHeaderFooterTarget
} from "../header-footer-editing/session-target";
import { createMountedSelectionGeometryContext } from "../selection";
import { createMountedViewCleanupRegistry } from "./cleanup";
import { createMountedInteractionTargetSnapshot, readLiveMountedInteractionTarget, resolveMountedSelectionContext } from "./interaction-target";
import type {
  CreateMountedViewInteractionLifecycleOptions,
  MountedViewInteractionLifecycle
} from "./types";
import { createMountedWidgetEvents } from "./widget-events";

/**
 * Creates the canonical interaction state and resource lifetime for one mount.
 *
 * Backends still own hit testing and focus policy. This lifecycle owns the
 * renderer-neutral state transitions that connect those adapters to widget,
 * input, selection, and teardown behavior.
 *
 * @param options - Mounted host, editor, input, and backend callbacks.
 * @returns Canonical interaction lifecycle for the mounted view.
 */
export function createMountedViewInteractionLifecycle(
  options: CreateMountedViewInteractionLifecycleOptions
): MountedViewInteractionLifecycle {
  const cleanupRegistry = createMountedViewCleanupRegistry();
  const widgetSetup = createMountedWidgetEvents({
    host: options.host,
    eventHandlers: options.eventHandlers,
    getContext: options.getWidgetContext
  });
  let interactionTarget: QuireInteractionSelectionTarget | null = null;
  /** @returns Retained target that still routes input for the current selection. */
  const liveTarget = () => readLiveMountedInteractionTarget(interactionTarget, options.editor.state.pm.selection);
  let selectionGeometryContext: QuireSelectionGeometryContext | undefined;
  let drawingTextSession: MountedDrawingTextEditingSession | null = null;
  let pendingCreatedTextBox: MountedDrawingCreatedTextBox | null = null;
  let storyInputSuspended = false;
  let inputBinding: ReturnType<typeof createMountedInputBinding>;

  // Register foundations first so backend listeners added by the mount release
  // before the input and widget runtimes on reverse-order teardown.
  cleanupRegistry.add(() => {
    widgetSetup.widgetEvents.destroy();
  });
  cleanupRegistry.add(widgetSetup.cleanup);
  /** Installs one retained drawing-text session into the shared input authority. */
  const activateDrawingTextSession = (session: MountedDrawingTextEditingSession, focus = true): void => {
    drawingTextSession = session;
    interactionTarget = session.interactionTarget;
    selectionGeometryContext = createMountedSelectionGeometryContext(
      session.interactionTarget
    );
    storyInputSuspended = false;
    inputBinding?.resetTransientState();
    if (focus) inputBinding?.focus();
    options.render("selection");
  };

  const drawingInteraction = registerMountedDrawingInteraction({
    scope: widgetSetup.widgetEvents.scope,
    editor: options.editor,
    status: options.status,
    getInteractionSnapshot: options.getInteractionSnapshot,
    ...(options.onDrawingPreviewChange === undefined
      ? {}
      : { onPreviewChange: options.onDrawingPreviewChange }),
    onTextEntry: activateDrawingTextSession,
    onTextBoxCreated: (textBox) => {
      pendingCreatedTextBox = textBox;
    }
  });
  cleanupRegistry.add(drawingInteraction.cleanup);
  cleanupRegistry.add(bindMountedDrawingKeyboard(
    options.overlayHost.ownerDocument, drawingInteraction.runtime
  ));

  let drawingCreationActive = false;

  /** Publishes creation ownership only when the observable state changes. */
  const synchronizeDrawingCreationActiveState = (): void => {
    const active = drawingInteraction.runtime.isCreationActive();
    if (active === drawingCreationActive) {
      return;
    }
    drawingCreationActive = active;
    options.onDrawingCreationActiveChange?.(active);
    drawingContextualCommands.refresh();
  };

  /**
   * Arms one creation tool and synchronizes its mounted presentation state.
   *
   * @param creationOptions - Drawing family, default extent, and identities.
   * @returns Whether the primary view accepted the tool.
   */
  const armDrawingCreation = (
    creationOptions?: Parameters<
      typeof drawingInteraction.runtime.armCreation
    >[0]
  ): boolean => {
    const accepted = drawingInteraction.runtime.armCreation(creationOptions);
    synchronizeDrawingCreationActiveState();
    return accepted;
  };

  /**
   * Cancels creation and synchronizes its mounted presentation state.
   *
   * @returns Whether armed or captured creation state was cleared.
   */
  const cancelDrawingCreation = (): boolean => {
    const cancelled = drawingInteraction.runtime.cancelCreation();
    synchronizeDrawingCreationActiveState();
    return cancelled;
  };

  /**
   * Routes one creation pointer phase and synchronizes presentation ownership.
   *
   * @param event - Shared client/document pointer facts.
   * @returns Whether drawing creation consumed the event.
   */
  const handleDrawingCreationPointer = (
    event: Parameters<
      typeof drawingInteraction.runtime.handleCreationPointer
    >[0]
  ): boolean => {
    const handled = drawingInteraction.runtime.handleCreationPointer(event);
    synchronizeDrawingCreationActiveState();
    return handled;
  };

  const drawingContextualCommands =
    createMountedDrawingContextualCommandsController({
      editor: options.editor,
      status: options.status,
      overlayHost: options.overlayHost,
      getInteractionSnapshot: options.getInteractionSnapshot,
      isSuppressed: () => drawingInteraction.runtime.isCreationActive(),
      onEnterText: () => drawingInteraction.runtime.enterSelectedText(),
      onAttrsChange: (patch, anchorPosition) =>
        readMountedDrawingModel(options.editor).updateAnchor(options.editor, { attrs: patch, position: anchorPosition }),
      onDelete: (anchorPosition) => {
        if (!readMountedDrawingModel(options.editor).deleteAnchor(options.editor, anchorPosition)) {
          return false;
        }
        drawingTextSession = null;
        interactionTarget = null;
        selectionGeometryContext = undefined;
        inputBinding?.resetTransientState();
        inputBinding?.focus();
        return true;
      }
    });
  cleanupRegistry.add(() => {
    drawingContextualCommands.destroy();
  });

  /** Clears retained story routing after editing ownership ends. */
  const clearHeaderFooterRouting = (): void => {
    if (isHeaderFooterTarget(interactionTarget)) {
      interactionTarget = null;
      selectionGeometryContext = undefined;
    }
    storyInputSuspended = true;
  };

  const headerFooterSession = createMountedHeaderFooterSessionLifecycle({
    editor: options.editor,
    root: options.root,
    overlayHost: options.overlayHost,
    inputProxy: options.inputProxy,
    getInteractionSnapshot: options.getInteractionSnapshot,
    render: options.render,
    readInputBinding: () => inputBinding,
    clearRouting: clearHeaderFooterRouting,
    resumeInput: () => { storyInputSuspended = false; }
  });
  const headerFooterEditing = headerFooterSession.controller;
  cleanupRegistry.add(() => headerFooterSession.destroy());

  inputBinding = createMountedInputBinding({
    navigation: options.navigation,
    status: options.status,
    editor: options.editor,
    inputProxy: options.inputProxy,
    readEditable: options.readEditable,
    getInteractionSnapshot: options.getInteractionSnapshot,
    ...(options.clipboardOutputStrategy === undefined
      ? {}
      : { clipboardOutputStrategy: options.clipboardOutputStrategy }),
    getSelectionContext: () => resolveMountedSelectionContext(liveTarget(), options.editor.state.pm.selection),
    getInteractionTarget: liveTarget,
    shouldRouteInput: () =>
      !storyInputSuspended
      && !headerFooterSession.selectionInUnownedStory()
      && (!isHeaderFooterTarget(interactionTarget)
        || headerFooterEditing.matchesTarget(interactionTarget)),
    handleKeyDownBeforeCommand: (event) => {
      if (event.key !== "Escape") {
        return false;
      }

      if (cancelDrawingCreation()) {
        return true;
      }

      if (drawingTextSession !== null) {
        const session = drawingTextSession;
        drawingTextSession = null;
        interactionTarget = null;
        selectionGeometryContext = undefined;
        inputBinding?.resetTransientState();
        if (options.editor.commands.setNodeSelection(session.anchorPosition)) {
          options.render("selection");
        }
        return true;
      }

      return headerFooterSession.handleEscape();
    },
    onInputOwnershipLost: (event) => {
      drawingTextSession = null;
      headerFooterSession.handleOwnershipLost(event);
    },
    render: options.render,
    onFocusChange: options.onFocusChange
  });

  if (inputBinding !== undefined) {
    cleanupRegistry.add(() => {
      inputBinding.destroy();
    });
  }

  return {
    widgetEvents: widgetSetup.widgetEvents,
    getInputBinding: () => inputBinding,
    activateText: (target, activation) => activateMountedText({
      editor: options.editor,
      inputBinding,
      headerFooterEditing,
      readEditable: options.readEditable,
      readSnapshot: options.getInteractionSnapshot,
      resolveDrawingText: (position) => drawingInteraction.runtime.resolveTextStoryAt(position),
      enterDrawingText: activateDrawingTextSession,
      cancelDrawing: () => { cancelDrawingCreation(); drawingTextSession = null; },
      claim: (storyTarget) => {
        interactionTarget = storyTarget;
        selectionGeometryContext = storyTarget === null ? undefined : createMountedSelectionGeometryContext(storyTarget);
        storyInputSuspended = false;
      },
      render: () => options.render("selection")
    }, target, activation),
    getDrawingTextEditingSession: () => drawingTextSession,
    enterSelectedDrawingText: () => drawingInteraction.runtime.enterSelectedText(),
    armDrawingCreation,
    cancelDrawingCreation,
    isDrawingCreationActive: () => drawingInteraction.runtime.isCreationActive(),
    handleDrawingCreationPointer,
    refreshCreatedDrawingTextEntry(): void {
      const pending = pendingCreatedTextBox;
      if (pending === null) {
        return;
      }
      const session = resolveMountedCreatedDrawingTextStory(options, pending);
      if (session === undefined) {
        return;
      }
      pendingCreatedTextBox = null;
      activateDrawingTextSession(session);
    },
    refreshDrawingContextualCommands(): void {
      drawingContextualCommands.refresh();
    },
    getHeaderFooterEditingSession: () => headerFooterEditing.getSession(),
    refreshHeaderFooterEditingChrome(): void {
      headerFooterEditing.refreshChrome();
    },
    prepareHeaderFooterPointerSelection(target, clickCount) {
      const previousSession = headerFooterEditing.getSession();
      const hadSession = previousSession !== null;
      const allowed = headerFooterEditing.preparePointerSelection(
        target,
        clickCount
      );
      const nextSession = headerFooterEditing.getSession();
      const domainChanged = previousSession === null
        ? nextSession !== null
        : nextSession === null
          || !matchesHeaderFooterSession(previousSession, nextSession);

      if (isHeaderFooterTarget(target)) {
        storyInputSuspended = !allowed;
        if (!allowed) {
          interactionTarget = null;
          selectionGeometryContext = undefined;
          inputBinding?.resetTransientState();
          inputBinding?.blur();
        }
      } else if (target !== null) {
        storyInputSuspended = false;
      } else if (hadSession) {
        clearHeaderFooterRouting();
      }
      if (hadSession && nextSession === null) {
        // A body double click places the caret itself; other exits return to the body.
        headerFooterSession.settleAfterPointerExit(target?.region?.kind === "body");
      }

      return !allowed
        ? "block"
        : domainChanged
          ? "transition"
          : "allow";
    },
    exitHeaderFooterEditing: () => headerFooterSession.exit(),
    focusInput(): void {
      inputBinding?.focus();
    },
    addCleanup(cleanup): void {
      cleanupRegistry.add(cleanup);
    },
    getInteractionTarget: () => interactionTarget,
    getInteractionTargetSnapshot: () => createMountedInteractionTargetSnapshot(interactionTarget),
    setInteractionTarget(target): void {
      if (isHeaderFooterTarget(target) && !headerFooterEditing.matchesTarget(target)) {
        interactionTarget = null;
        selectionGeometryContext = undefined;
        storyInputSuspended = true;
        return;
      }

      if (target !== null && !isHeaderFooterTarget(target)) {
        storyInputSuspended = false;
      }
      if (target?.region?.kind !== "drawing-text") {
        drawingTextSession = null;
      }
      interactionTarget = target;
      selectionGeometryContext = createMountedSelectionGeometryContext(target);
    },
    getSelectionGeometryContext: () => selectionGeometryContext,
    setSelectionGeometryContext(context): void {
      selectionGeometryContext = context;
    },
    getSelectionContext: () => resolveMountedSelectionContext(liveTarget(), options.editor.state.pm.selection),
    destroy(): void {
      cancelDrawingCreation();
      pendingCreatedTextBox = null;
      cleanupRegistry.destroy();
    }
  };
}

/**
 * Checks whether a retained target belongs to a header/footer story band.
 *
 * @param target - Retained interaction target to classify.
 * @returns Whether explicit story editing must own the target.
 */
function isHeaderFooterTarget(
  target: QuireInteractionSelectionTarget | null
): boolean {
  return resolveHeaderFooterTarget(target) !== null;
}
