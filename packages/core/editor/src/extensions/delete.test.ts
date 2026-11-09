import { describe, expect, it, vi } from "vitest";
import { createEditor, Mark, type CommandProps, type QuireEditorDeleteEvent } from "../index";

describe("delete observer after compound mark removal and ancestor deletion", () => {
  for (const asynchronous of [false, true]) {
    it(`emits a complete mark deletion collapsed to the document start without an out-of-range lookup (async=${asynchronous})`, () => {
      vi.useFakeTimers();
      const events: QuireEditorDeleteEvent[] = [];
      const editor = createEditor({
        extensions: [Mark.create({ name: "bold" })],
        coreExtensionOptions: { delete: { async: asynchronous } },
        content: { type: "doc", content: [
          { type: "paragraph", content: [{ type: "text", text: "abc", marks: [{ type: "bold" }] }] },
          { type: "paragraph", content: [{ type: "text", text: "outside" }] }
        ] },
        onDelete: event => { events.push(event); }
      });
      try {
        expect(editor.commands.command(({ tr }: CommandProps) => {
          tr.removeMark(1, 4, editor.state.schema.marks.bold!.create());
          tr.delete(0, 5);
          return true;
        })).toBe(true);
        vi.runAllTimers();
        expect(editor.state.doc.textContent).toBe("outside");
        const marks = events.filter(event => event.type === "mark");
        expect(marks).toHaveLength(1);
        expect(marks[0]).toMatchObject({ from: 1, to: 4, newRange: { from: 0, to: 0 }, partial: false });
        expect(events.some(event => event.type === "node" && event.node.type.name === "paragraph")).toBe(true);
      } finally { editor.destroy(); vi.useRealTimers(); }
    });
  }

  it("still reports a partial deletion when the same mark survives beside an ordinary interior range", () => {
    const events: QuireEditorDeleteEvent[] = [];
    const editor = createEditor({
      extensions: [Mark.create({ name: "bold" })], coreExtensionOptions: { delete: { async: false } },
      content: { type: "doc", content: [{ type: "paragraph", content: [
        { type: "text", text: "abc", marks: [{ type: "bold" }] }
      ] }] }, onDelete: event => { events.push(event); }
    });
    try {
      expect(editor.commands.command(({ tr }: CommandProps) => { tr.removeMark(2, 3, editor.state.schema.marks.bold!.create()); return true; })).toBe(true);
      const marks = events.filter(event => event.type === "mark");
      expect(marks).toHaveLength(1);
      expect(marks[0]).toMatchObject({ newRange: { from: 2, to: 3 }, partial: true });
    } finally { editor.destroy(); }
  });

  it("schedules nothing for an edit that removes nothing, and still reports a deletion", () => {
    vi.useFakeTimers();
    const events: QuireEditorDeleteEvent[] = [];
    const editor = createEditor({ content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "abc" }] }] }, onDelete: event => { events.push(event); } });
    try {
      editor.view.dispatch(editor.state.pm.tr.insertText("x", 2));
      expect(vi.getTimerCount()).toBe(0);
      editor.view.dispatch(editor.state.pm.tr.delete(1, 3));
      vi.runAllTimers();
      expect(events.some(event => event.type === "node")).toBe(true);
    } finally { editor.destroy(); vi.useRealTimers(); }
  });
});

