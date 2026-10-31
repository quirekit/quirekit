import type { QuireEditor } from "@quirekit/core";
import { describe, expect, it, vi } from "vitest";
import { createQuireAiDocumentRevision } from "./revision";
import { createQuireAiToolHost } from "./host";
import { QuireAiToolWriteError, type QuireAiToolHostOptions } from "./types";

describe("createQuireAiToolHost", () => {
  it("requires an explicit approved value even from an untyped review integration", async () => {
    const fixture = createEditorFixture();
    const source = fixture.editor.state.doc.toJSON();
    const requestPreview = (async () => undefined) as unknown as NonNullable<QuireAiToolHostOptions["requestPreview"]>;
    const host = createQuireAiToolHost({ editor: fixture.editor, requestPreview,
      authorizeWrite: () => ({ allowed: true, mode: "direct", preview: "required" }) });
    await expect(host.executeWrite({ toolCallId: "invalid-review", capabilityId: "document.text.edit",
      target: { kind: "selection", id: "captured" }, signal: new AbortController().signal,
      supportedModes: ["direct"], canApply: () => true, apply: () => { fixture.changeDocument(); return true; }
    })).rejects.toMatchObject({ code: "preview-unavailable" });
    expect(fixture.editor.state.doc.toJSON()).toEqual(source);
  });

  it("offers a change the revision system refused for approval as a direct write", async () => {
    const fixture = createEditorFixture();
    const requestPreview = vi.fn(async () => "approved" as const);
    const host = createQuireAiToolHost({ editor: fixture.editor, requestPreview, trackedReviewer: { id: "ai", name: "AI" },
      authorizeWrite: () => ({ allowed: true, mode: "tracked", untrackedFallback: "preview" }) });
    const result = await host.executeWrite({ toolCallId: "refused-revision", capabilityId: "document.text.edit",
      target: { kind: "selection", id: "captured" }, signal: new AbortController().signal, supportedModes: ["direct", "tracked"],
      canApply: () => true,
      // A tracked apply that the revision system filters out changes nothing; the direct apply after approval does.
      apply: (_editor, context) => { if (context.mode === "direct") fixture.changeDocument(); return true; } });
    expect(requestPreview).toHaveBeenCalledOnce();
    expect(result).toMatchObject({ applied: true, receipt: { mode: "direct" } });
  });

  it("asks before writing directly a change revisions cannot record, when the policy offers approval", async () => {
    const fixture = createEditorFixture();
    const requestPreview = vi.fn(async () => "rejected" as const);
    const host = createQuireAiToolHost({ editor: fixture.editor, requestPreview, trackedReviewer: { id: "ai", name: "AI" },
      authorizeWrite: () => ({ allowed: true, mode: "tracked", untrackedFallback: "preview" }) });
    const before = fixture.editor.state.doc.toJSON();
    const result = await host.executeWrite({ toolCallId: "untracked-removal", capabilityId: "document.text.edit",
      target: { kind: "selection", id: "captured" }, signal: new AbortController().signal, supportedModes: ["direct", "tracked"],
      canApply: () => true, apply: (_editor, context) => { if (context.mode === "direct") fixture.changeDocument(); return true; } });
    expect(requestPreview).toHaveBeenCalledOnce();
    expect(result).toMatchObject({ applied: false, reason: "rejected" });
    expect(fixture.editor.state.doc.toJSON()).toEqual(before);
  });

  it("honors review newly required by the final policy check", async () => {
    const fixture = createEditorFixture();
    let checks = 0;
    const requestPreview = vi.fn(async () => "rejected" as const);
    const host = createQuireAiToolHost({ editor: fixture.editor,
      authorizeWrite: () => ({ allowed: true, mode: "direct", ...(++checks > 1 ? { preview: "required" as const } : {}) }),
      requestPreview });
    const before = fixture.editor.state.doc.toJSON();
    const result = await host.executeWrite({ toolCallId: "policy-review", capabilityId: "document.text.edit",
      target: { kind: "selection", id: "captured" }, signal: new AbortController().signal,
      supportedModes: ["direct"], canApply: () => true, apply: () => { fixture.changeDocument(); return true; } });
    expect(requestPreview).toHaveBeenCalledOnce();
    expect(result).toMatchObject({ applied: false, reason: "rejected" });
    expect(fixture.editor.state.doc.toJSON()).toEqual(before);
  });

  it("emits a commit receipt even when the canonical command throws after applying", async () => {
    const fixture = createEditorFixture();
    const onReceipt = vi.fn();
    const host = createQuireAiToolHost({ editor: fixture.editor, onReceipt,
      authorizeWrite: () => ({ allowed: true, mode: "direct" }) });
    await expect(host.executeWrite({ toolCallId: "throw-after-commit", capabilityId: "document.text.edit",
      target: { kind: "selection", id: "captured" }, signal: new AbortController().signal,
      supportedModes: ["direct"], canApply: () => true,
      apply: () => { fixture.changeDocument(); throw new Error("after commit"); } })).rejects.toThrow("after commit");
    expect(onReceipt).toHaveBeenCalledOnce();
    expect(onReceipt.mock.calls[0]?.[0]).toMatchObject({ toolCallId: "throw-after-commit" });
  });

  it("applies one guarded command and records an exact Receipt", async () => {
    const fixture = createEditorFixture();
    const authorizeWrite = vi.fn(() => ({
      allowed: true as const,
      mode: "direct" as const
    }));
    const canApply = vi.fn(() => true);
    const apply = vi.fn(() => {
      fixture.changeDocument();
      return true;
    });
    const host = createQuireAiToolHost({
      editor: fixture.editor,
      authorizeWrite
    });
    const result = await host.executeWrite({
      toolCallId: "tool-1",
      capabilityId: "document.inline-format.bold",
      target: { kind: "selection", id: "current" },
      signal: new AbortController().signal,
      supportedModes: ["direct"],
      canApply,
      apply
    });

    expect(result.applied).toBe(true);
    expect(result.receipt).toMatchObject({
      toolCallId: "tool-1",
      capabilityId: "document.inline-format.bold",
      mode: "direct",
      target: { kind: "selection", id: "current" }
    });
    expect(result.receipt?.sourceDocumentRevision)
      .not.toBe(result.receipt?.documentRevision);
    expect(authorizeWrite).toHaveBeenCalledTimes(2);
    expect(canApply).toHaveBeenCalledTimes(2);
    expect(apply).toHaveBeenCalledTimes(1);
  });

  it("rejects a transcript write after the editor becomes read-only", async () => {
    const fixture = createEditorFixture();
    fixture.setEditable(false);
    const apply = vi.fn(() => true);
    const host = createQuireAiToolHost({
      editor: fixture.editor,
      authorizeWrite: () => ({ allowed: true, mode: "direct" })
    });

    await expect(host.executeWrite({
      toolCallId: "tool-read-only",
      capabilityId: "document.inline-format.bold",
      target: { kind: "selection", id: "current" },
      signal: new AbortController().signal,
      supportedModes: ["direct"],
      canApply: () => true,
      apply
    })).rejects.toThrowError(expect.objectContaining({
      code: "editor-read-only"
    } satisfies Partial<QuireAiToolWriteError>));
    expect(apply).not.toHaveBeenCalled();
  });

  it("rechecks product authorization next to the command boundary", async () => {
    const fixture = createEditorFixture();
    const authorizeWrite = vi.fn()
      .mockReturnValueOnce({ allowed: true, mode: "direct" })
      .mockReturnValueOnce({
        allowed: false,
        code: "permission-denied",
        message: "Permission changed."
      });
    const apply = vi.fn(() => true);
    const host = createQuireAiToolHost({
      editor: fixture.editor,
      authorizeWrite
    });

    await expect(host.executeWrite({
      toolCallId: "tool-revoked",
      capabilityId: "document.inline-format.bold",
      target: { kind: "selection", id: "current" },
      signal: new AbortController().signal,
      supportedModes: ["direct"],
      canApply: () => true,
      apply
    })).rejects.toThrow("Permission changed.");
    expect(authorizeWrite).toHaveBeenCalledTimes(2);
    expect(apply).not.toHaveBeenCalled();
  });

  it("reports a real mutation even when a command returns false afterward", async () => {
    const fixture = createEditorFixture();
    const host = createQuireAiToolHost({
      editor: fixture.editor,
      authorizeWrite: () => ({ allowed: true, mode: "direct" })
    });
    const result = await host.executeWrite({
      toolCallId: "tool-postcondition",
      capabilityId: "document.inline-format.bold",
      target: { kind: "selection", id: "current" },
      signal: new AbortController().signal,
      supportedModes: ["direct"],
      canApply: () => true,
      apply: () => {
        fixture.changeDocument();
        return false;
      }
    });

    expect(result.applied).toBe(true);
    expect(result.receipt).not.toBeNull();
  });

  it("rejects a stale optimistic revision before command availability checks", async () => {
    const fixture = createEditorFixture();
    const staleRevision = createQuireAiDocumentRevision(fixture.editor.state.doc);
    fixture.changeDocument();
    const canApply = vi.fn(() => true);
    const host = createQuireAiToolHost({
      editor: fixture.editor,
      authorizeWrite: () => ({ allowed: true, mode: "direct" })
    });

    await expect(host.executeWrite({
      toolCallId: "tool-stale",
      capabilityId: "document.inline-format.bold",
      target: { kind: "selection", id: "current" },
      signal: new AbortController().signal,
      expectedDocumentRevision: staleRevision,
      supportedModes: ["direct"],
      canApply,
      apply: () => true
    })).rejects.toThrowError(expect.objectContaining({
      code: "stale-target"
    } satisfies Partial<QuireAiToolWriteError>));
    expect(canApply).not.toHaveBeenCalled();
  });

  it("captures a detached candidate and commits only after approval", async () => {
    const fixture = createEditorFixture();
    const requestPreview = vi.fn(async () => "approved" as const);
    const apply = vi.fn(() => {
      fixture.changeDocument();
      return true;
    });
    const host = createQuireAiToolHost({
      editor: fixture.editor,
      authorizeWrite: () => ({
        allowed: true,
        mode: "direct",
        preview: "required"
      }),
      requestPreview
    });

    const result = await host.executeWrite({
      toolCallId: "tool-preview-approved",
      capabilityId: "document.text.edit",
      target: { kind: "text-ranges", id: "current" },
      signal: new AbortController().signal,
      supportedModes: ["direct"],
      canApply: () => true,
      apply
    });

    expect(requestPreview).toHaveBeenCalledWith(
      expect.objectContaining({
        toolCallId: "tool-preview-approved",
        capabilityId: "document.text.edit",
        formatOnly: false
      }),
      expect.any(AbortSignal)
    );
    expect(apply).toHaveBeenCalledTimes(2);
    expect(result.applied).toBe(true);
  });

  it("leaves canonical state untouched when a detached Preview is rejected", async () => {
    const fixture = createEditorFixture();
    const apply = vi.fn(() => {
      fixture.changeDocument();
      return true;
    });
    const host = createQuireAiToolHost({
      editor: fixture.editor,
      authorizeWrite: () => ({
        allowed: true,
        mode: "direct",
        preview: "required"
      }),
      requestPreview: async () => "rejected"
    });
    const sourceRevision = createQuireAiDocumentRevision(fixture.editor.state.doc);

    const result = await host.executeWrite({
      toolCallId: "tool-preview-rejected",
      capabilityId: "document.text.edit",
      target: { kind: "text-ranges", id: "current" },
      signal: new AbortController().signal,
      supportedModes: ["direct"],
      canApply: () => true,
      apply
    });

    expect(result).toEqual({
      applied: false,
      receipt: null,
      reason: "rejected"
    });
    expect(apply).toHaveBeenCalledTimes(1);
    expect(createQuireAiDocumentRevision(fixture.editor.state.doc)).toBe(sourceRevision);
  });

  it("fails closed when the document changes while Preview awaits approval", async () => {
    const fixture = createEditorFixture();
    const apply = vi.fn(() => {
      fixture.changeDocument();
      return true;
    });
    const host = createQuireAiToolHost({
      editor: fixture.editor,
      authorizeWrite: () => ({
        allowed: true,
        mode: "direct",
        preview: "required"
      }),
      requestPreview: async () => {
        fixture.changeDocument();
        return "approved";
      }
    });

    await expect(host.executeWrite({
      toolCallId: "tool-preview-stale",
      capabilityId: "document.text.edit",
      target: { kind: "text-ranges", id: "current" },
      signal: new AbortController().signal,
      supportedModes: ["direct"],
      canApply: () => true,
      apply
    })).rejects.toThrowError(expect.objectContaining({
      code: "stale-target"
    } satisfies Partial<QuireAiToolWriteError>));
    expect(apply).toHaveBeenCalledTimes(1);
  });
});

/**
 * Creates a minimal mutable editor authority for Host boundary tests.
 *
 * @returns Editor facade and explicit state controls.
 */
function createEditorFixture(): {
  readonly editor: QuireEditor;
  readonly changeDocument: () => void;
  readonly setEditable: (value: boolean) => void;
} {
  let version = 0;
  let editable = true;
  let capturing = false;
  let capturedVersion: number | null = null;
  const createDocument = (documentVersion: number) => ({
    content: { size: 1 },
    textContent: `document-${documentVersion}`,
    textBetween: () => `document-${documentVersion}`,
    toJSON: () => ({ type: "doc", version: documentVersion }),
    eq: (other: { readonly toJSON: () => unknown }) => (
      JSON.stringify(other.toJSON()) === JSON.stringify({ type: "doc", version: documentVersion })
    )
  });
  const editor = {
    get state() {
      return {
        doc: createDocument(version)
      };
    },
    get isEditable() {
      return editable;
    },
    captureTransaction(callback: () => void) {
      capturing = true;
      capturedVersion = null;
      try {
        callback();
      } finally {
        capturing = false;
      }
      return capturedVersion === null
        ? null
        : { doc: createDocument(capturedVersion) };
    }
  } as unknown as QuireEditor;
  return {
    editor,
    changeDocument: () => {
      if (capturing) capturedVersion = version + 1;
      else version += 1;
    },
    setEditable: (value) => {
      editable = value;
    }
  };
}
