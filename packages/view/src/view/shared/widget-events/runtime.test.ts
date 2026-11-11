import { describe, expect, it, vi } from "vitest";
import type { QuireEditor, QuireMountedEditorView } from "@quirekit/core";
import type { QuireViewTarget } from "@quirekit/renderer";
import { registerMountedWidgetViewEventHandlers } from ".";
import { createMountedWidgetEventRuntime } from ".";

interface TestContext {
  /** Runtime label used by event assertions. */
  readonly label: string;
}

describe("mounted widget event runtime", () => {
  it("hit-tests renderer coordinates and dispatches through the mounted scope", () => {
    const handler = vi.fn();
    const runtime = createMountedWidgetEventRuntime<TestContext>({
      context: { label: "canvas" },
      eventHandlers: {
        "button.open": (event) => {
          event.preventDefault();
          handler(event.context.label, event.host?.kind, event.point);
        }
      },
      host: {
        kind: "canvas",
        surface: { tagName: "canvas" }
      }
    });

    runtime.setTargets([createTarget()]);

    expect(runtime.dispatchPointerEvent({
      type: "click",
      pointerId: 1,
      clientPoint: { clientX: 14, clientY: 25 },
      surfaceClientRect: { left: 10, top: 20, width: 100, height: 50 },
      surfaceBounds: { x: 0, y: 0, width: 100, height: 50 }
    })).toEqual({
      handled: true,
      defaultPrevented: true,
      pointerCaptureRequested: false
    });
    expect(handler).toHaveBeenCalledWith("canvas", "canvas", { x: 4, y: 5 });
  });

  it("maps client points through an offset document-space surface", () => {
    const handler = vi.fn();
    const runtime = createMountedWidgetEventRuntime({
      eventHandlers: {
        "button.open": (event) => {
          handler(event.point);
        }
      }
    });

    runtime.setTargets([createTarget({
      rect: { x: 102, y: 203, width: 10, height: 10 }
    })]);

    expect(runtime.dispatchPointerEvent({
      type: "click",
      pointerId: 1,
      clientPoint: { clientX: 14, clientY: 25 },
      surfaceClientRect: { left: 10, top: 20, width: 100, height: 50 },
      surfaceBounds: { x: 100, y: 200, width: 100, height: 50 }
    })).toEqual({
      handled: true,
      defaultPrevented: false,
      pointerCaptureRequested: false
    });
    expect(handler).toHaveBeenCalledWith({ x: 104, y: 205 });
  });

  it("returns an empty result when no target is hit", () => {
    const runtime = createMountedWidgetEventRuntime();

    runtime.setTargets([createTarget()]);

    expect(runtime.dispatchPointerEvent({
      type: "click",
      pointerId: 1,
      clientPoint: { clientX: 90, clientY: 90 },
      surfaceClientRect: { left: 0, top: 0, width: 100, height: 100 },
      surfaceBounds: { x: 0, y: 0, width: 100, height: 100 }
    })).toEqual({
      handled: false,
      defaultPrevented: false,
      pointerCaptureRequested: false
    });
  });

  it("exposes semantic target queries for the latest render result", () => {
    const runtime = createMountedWidgetEventRuntime();

    runtime.setTargets([
      createTarget({
        id: "callout",
        nodePath: "0",
        role: "callout",
        range: { from: 10, to: 40 }
      }),
      createTarget({
        id: "action",
        nodePath: "0.1",
        role: "button",
        part: "action",
        rect: { x: 20, y: 20, width: 20, height: 20 },
        range: { from: 20, to: 30 }
      })
    ]);

    expect(runtime.getTargets().map((target) => target.id)).toEqual([
      "callout",
      "action"
    ]);
    expect(runtime.getTargetById("action")?.part).toBe("action");
    expect(runtime.getTargetsByRole("button").map((target) => target.id)).toEqual([
      "action"
    ]);
    expect(runtime.getTargetsByPart("action").map((target) => target.id)).toEqual([
      "action"
    ]);
    expect(runtime.getTargetsByPosition(24).map((target) => target.id)).toEqual([
      "callout",
      "action"
    ]);
    expect(runtime.getTargetsByRange({ from: 35, to: 45 }).map((target) => target.id)).toEqual([
      "callout"
    ]);
    expect(runtime.hitTestPoint({ x: 22, y: 22 })?.target.id).toBe("action");
    expect(runtime.hitTestPoint({ x: 200, y: 200 })).toBeNull();

    runtime.setHost({
      kind: "canvas",
      surface: { tagName: "canvas" }
    });

    expect(runtime.getWidgets().map((widget) => widget.id)).toEqual([
      "callout",
      "action"
    ]);
    expect(runtime.getWidgetById("action")?.parent?.id).toBe("callout");
    expect(runtime.getWidgetsByRole("button").map((widget) => widget.id)).toEqual([
      "action"
    ]);
    expect(runtime.getWidgetsByPart("action").map((widget) => widget.id)).toEqual([
      "action"
    ]);
    expect(runtime.getWidgetsByPosition(24).map((widget) => widget.id)).toEqual([
      "callout",
      "action"
    ]);
    expect(runtime.getWidgetsByRange({ from: 35, to: 45 }).map((widget) => widget.id)).toEqual([
      "callout"
    ]);
    expect(runtime.widgetAtPoint({ x: 22, y: 22 })?.widget.host?.kind).toBe("canvas");
  });

  it("registers extension view event handlers on the mounted scope", () => {
    const editor = { name: "editor" } as unknown as QuireEditor;
    const view = { id: "mounted-view" } as unknown as QuireMountedEditorView;
    const handler = vi.fn();
    const runtime = createMountedWidgetEventRuntime();
    const unregister = registerMountedWidgetViewEventHandlers({
      scope: runtime.scope,
      eventHandlers: {
        "button.open": handler
      },
      getContext: () => ({
        editor,
        view,
        mode: "canvas",
        status: "sync"
      })
    });

    runtime.setTargets([createTarget()]);

    expect(runtime.dispatchPointerEvent({
      type: "click",
      pointerId: 1,
      clientPoint: { clientX: 4, clientY: 5 },
      surfaceClientRect: { left: 0, top: 0, width: 100, height: 100 },
      surfaceBounds: { x: 0, y: 0, width: 100, height: 100 }
    })).toEqual({
      handled: true,
      defaultPrevented: false,
      pointerCaptureRequested: false
    });
    expect(handler).toHaveBeenCalledWith(
      { editor, view, mode: "canvas", status: "sync" },
      expect.objectContaining({
        type: "click",
        payload: undefined
      })
    );

    unregister();
    handler.mockClear();

    expect(runtime.dispatchPointerEvent({
      type: "click",
      pointerId: 1,
      clientPoint: { clientX: 4, clientY: 5 },
      surfaceClientRect: { left: 0, top: 0, width: 100, height: 100 },
      surfaceBounds: { x: 0, y: 0, width: 100, height: 100 }
    })).toEqual({
      handled: false,
      defaultPrevented: false,
      pointerCaptureRequested: false
    });
    expect(handler).not.toHaveBeenCalled();
  });

  it("keeps captured pointer events on the original target until release", () => {
    const events: Array<{
      readonly type: string;
      readonly targetId: string | undefined;
      readonly currentTargetId: string | undefined;
      readonly phase: string | undefined;
      readonly delta: { readonly x: number; readonly y: number } | undefined;
    }> = [];
    const runtime = createMountedWidgetEventRuntime({
      eventHandlers: {
        "object.capture": (event) => {
          event.capturePointer();
          events.push(readPointerEvent(event));
        },
        "object.drag": (event) => {
          events.push(readPointerEvent(event));
        }
      }
    });

    runtime.setTargets([
      createTarget({
        id: "object-a",
        events: {
          pointerDown: { handler: "object.capture" },
          pointerMove: { handler: "object.drag" },
          pointerUp: { handler: "object.drag" },
          pointerCancel: { handler: "object.drag" }
        }
      }),
      createTarget({
        id: "object-b",
        nodePath: "1",
        rect: { x: 40, y: 40, width: 10, height: 10 },
        events: {
          pointerMove: { handler: "object.drag" },
          pointerUp: { handler: "object.drag" }
        }
      })
    ]);

    expect(runtime.dispatchPointerEvent({
      type: "pointerDown",
      pointerId: 7,
      clientPoint: { clientX: 4, clientY: 5 },
      surfaceClientRect: { left: 0, top: 0, width: 100, height: 100 },
      surfaceBounds: { x: 0, y: 0, width: 100, height: 100 }
    })).toEqual({
      handled: true,
      defaultPrevented: false,
      pointerCaptureRequested: true
    });
    expect(runtime.hasPointerCapture(7)).toBe(true);

    runtime.dispatchPointerEvent({
      type: "pointerMove",
      pointerId: 7,
      clientPoint: { clientX: 45, clientY: 46 },
      surfaceClientRect: { left: 0, top: 0, width: 100, height: 100 },
      surfaceBounds: { x: 0, y: 0, width: 100, height: 100 }
    });
    runtime.dispatchPointerEvent({
      type: "pointerUp",
      pointerId: 7,
      clientPoint: { clientX: 48, clientY: 50 },
      surfaceClientRect: { left: 0, top: 0, width: 100, height: 100 },
      surfaceBounds: { x: 0, y: 0, width: 100, height: 100 }
    });

    expect(events).toEqual([
      {
        type: "pointerDown",
        targetId: "object-a",
        currentTargetId: "object-a",
        phase: "start",
        delta: { x: 0, y: 0 }
      },
      {
        type: "pointerMove",
        targetId: "object-a",
        currentTargetId: "object-a",
        phase: "update",
        delta: { x: 41, y: 41 }
      },
      {
        type: "pointerUp",
        targetId: "object-a",
        currentTargetId: "object-a",
        phase: "end",
        delta: { x: 44, y: 45 }
      }
    ]);
    expect(runtime.hasPointerCapture(7)).toBe(false);
  });
});

/**
 * Reads the stable pointer facts asserted by captured-session tests.
 *
 * @param event - Runtime event emitted by the mounted widget scope.
 * @returns Serializable event facts.
 */
function readPointerEvent(event: {
  readonly type: string;
  readonly target: QuireViewTarget | undefined;
  readonly currentTarget: QuireViewTarget | undefined;
  readonly pointerSession: {
    readonly phase: string;
    readonly delta: { readonly x: number; readonly y: number };
  } | undefined;
}): {
  readonly type: string;
  readonly targetId: string | undefined;
  readonly currentTargetId: string | undefined;
  readonly phase: string | undefined;
  readonly delta: { readonly x: number; readonly y: number } | undefined;
} {
  return {
    type: event.type,
    targetId: event.target?.id,
    currentTargetId: event.currentTarget?.id,
    phase: event.pointerSession?.phase,
    delta: event.pointerSession?.delta
  };
}

/**
 * Creates a small target with one named event handler.
 *
 * @param target - Target fields to override.
 * @returns qkView target descriptor.
 */
function createTarget(
  target: Partial<QuireViewTarget> = {}
): QuireViewTarget {
  return {
    id: "button",
    nodePath: "0",
    rect: { x: 2, y: 3, width: 10, height: 10 },
    role: "button",
    pointerEvents: "auto",
    events: {
      click: { handler: "button.open" }
    },
    ...target
  };
}
