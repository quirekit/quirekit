import { describe, expect, it } from "vitest";
import type { QuireInteractionSelectionTarget } from "@quirekit/view-engine";
import { createEditor } from "@quirekit/core";
import { NodeSelection, TextSelection } from "@quirekit/pm";
import { StarterKit } from "@quirekit/starter-kit";
import { createMountedInteractionTargetSnapshot, readLiveMountedInteractionTarget } from "./interaction-target";

/**
 * Creates one complete retained content-control target for projection tests.
 *
 * @returns Retained target containing canonical content-control facts.
 */
function createContentControlTarget(): QuireInteractionSelectionTarget {
  const region = {
    rootId: { value: "root:body" },
    regionId: { value: "region:control" },
    kind: "content-control"
  } as const;

  return {
    domain: "control",
    commandTarget: "content-control",
    hitKind: "content-control",
    region,
    referenceRect: { x: 20, y: 40, width: 100, height: 24 },
    pointerPolicy: {
      kind: "dispatch",
      shouldFocusEditor: true,
      shouldPreventDefault: true
    },
    interactionHit: {
      kind: "content-control",
      region,
      controlId: "contract-type",
      controlType: "drop-down-list",
      part: "value",
      range: { from: 10, to: 18 }
    }
  };
}

/**
 * Creates one repeated retained object target for projection tests.
 *
 * @returns Retained object target carrying exact source and occurrence identity.
 */
function createObjectTarget(): QuireInteractionSelectionTarget {
  const region = {
    rootId: { value: "root:header" },
    regionId: { value: "region:picture" },
    kind: "floating-object",
    visualInstanceId: "page:2:header-default"
  } as const;

  return {
    domain: "object",
    commandTarget: "media",
    hitKind: "object",
    region,
    referenceRect: { x: 40, y: 60, width: 120, height: 80 },
    interactionHit: {
      kind: "object",
      region,
      objectId: "picture:header-logo"
    }
  };
}

describe("mounted interaction target projection", () => {
  it("returns null without retained interaction ownership", () => {
    expect(createMountedInteractionTargetSnapshot(null)).toBeNull();
  });

  it("publishes frozen semantic content-control facts without retained graph objects", () => {
    const target = createContentControlTarget();
    const snapshot = createMountedInteractionTargetSnapshot(target);

    expect(snapshot).toEqual({
      targetKind: "content-control",
      selectionDomain: "control",
      commandTarget: "content-control",
      owner: { kind: "content-control", id: "contract-type" },
      role: "drop-down-list",
      part: "value",
      range: { from: 10, to: 18 },
      referenceRect: { x: 20, y: 40, width: 100, height: 24 },
      pointerPolicy: {
        kind: "dispatch",
        shouldFocusEditor: true,
        shouldPreventDefault: true
      }
    });
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot?.owner)).toBe(true);
    expect(Object.isFrozen(snapshot?.range)).toBe(true);
    expect(snapshot).not.toHaveProperty("interactionHit");
    expect(snapshot).not.toHaveProperty("region");
  });

  it("keeps generic routing facts when no feature-owned semantic hit exists", () => {
    const snapshot = createMountedInteractionTargetSnapshot({
      domain: "text",
      commandTarget: "editable-text",
      hitKind: "position"
    });

    expect(snapshot).toEqual({
      targetKind: "position",
      selectionDomain: "text",
      commandTarget: "editable-text"
    });
  });

  it("publishes exact object owner and repeated visual occurrence", () => {
    const snapshot = createMountedInteractionTargetSnapshot(createObjectTarget());

    expect(snapshot).toEqual({
      targetKind: "object",
      selectionDomain: "object",
      commandTarget: "media",
      owner: { kind: "object", id: "picture:header-logo" },
      visualInstanceId: "page:2:header-default",
      referenceRect: { x: 40, y: 60, width: 120, height: 80 }
    });
    expect(Object.isFrozen(snapshot?.owner)).toBe(true);
  });

  it("keeps an object hit only while its node selection exists", () => {
    const { schema } = createEditor({ extensions: [StarterKit] }).state;
    const doc = schema.nodes.doc!.create(null, schema.nodes.paragraph!.create(null, schema.text("abc")));
    const object = createObjectTarget();
    const control = createContentControlTarget();

    expect(readLiveMountedInteractionTarget(object, NodeSelection.create(doc, 0))).toBe(object);
    // Arrow keys moved the caret off the object: typing must edit text again.
    expect(readLiveMountedInteractionTarget(object, TextSelection.create(doc, 3))).toBeNull();
    expect(readLiveMountedInteractionTarget(control, TextSelection.create(doc, 3))).toBe(control);
    expect(readLiveMountedInteractionTarget(null, TextSelection.create(doc, 3))).toBeNull();
  });
});
