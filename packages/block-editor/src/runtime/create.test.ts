import { afterEach, describe, expect, it, vi } from "vitest";
import { Extension, type QuireJSONContent } from "@quirekit/core";
import type { CharacterCountStorage } from "@quirekit/extensions";
import { StarterKit } from "@quirekit/starter-kit";
import { createBlockEditor, createBlockEditorPreset, type BlockEditorInstance } from "../index";

const instances: BlockEditorInstance[] = [];
const content: QuireJSONContent = {
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text: "Hello 中文" }] }]
};

afterEach(() => {
  for (const instance of instances.splice(0)) instance.destroy();
});

describe("Block Editor product foundation", () => {
  it("creates an unmounted generic profile with the existing editing commands", () => {
    const instance = createBlockEditor({ content });
    instances.push(instance);
    const { editor } = instance;
    expect(editor.mountedView).toBeUndefined();
    expect(editor.extensions.map((extension) => extension.name)).toEqual(expect.arrayContaining([
      "doc", "paragraph", "text", "heading", "bulletList", "orderedList",
      "blockquote", "codeBlock", "horizontalRule", "undoRedo", "link", "textStyle", "characterCount", "html-view"
    ]));
    expect(editor.extensions.map((extension) => extension.name)).not.toContain("canvas-view");
    expect(editor.commands.setTextSelection({ from: 1, to: 6 })).toBe(true);
    expect(editor.can().toggleBold()).toBe(true);
    expect(editor.chain().toggleBold().setFontSize("20pt")
      .setLatinFontFamily("Arial").setEastAsiaFontFamily("SimSun").run()).toBe(true);
    expect(editor.getAttributes("textStyle")).toMatchObject({
      fontFamilyLatin: "Arial", fontFamilyEastAsia: "SimSun", fontSize: "20pt"
    });
    expect(editor.isActive("bold")).toBe(true);
    expect(editor.commands.undo()).toBe(true);
    expect(editor.getText()).toBe("Hello 中文");
    expect(editor.isActive("bold")).toBe(false);
    expect(editor.commands.redo()).toBe(true);
    expect(editor.isActive("bold")).toBe(true);
  });

  it("round-trips the selected generic profile and link through Core JSON", () => {
    const first = createBlockEditor({ content });
    instances.push(first);
    first.editor.commands.setTextSelection({ from: 1, to: 6 });
    expect(first.editor.commands.setLink({ href: "https://example.com" })).toBe(true);
    const second = createBlockEditor({ content: first.editor.getJSON() });
    instances.push(second);
    expect(second.editor.getJSON()).toEqual(first.editor.getJSON());
    expect(second.editor.state.doc.firstChild?.firstChild?.marks.some((mark) => mark.type.name === "link")).toBe(true);
    expect(second.editor.commands.undo()).toBe(false);
  });

  it("lets consumers configure or disable each existing bundle", () => {
    const instance = createBlockEditor({
      content,
      preset: {
        starterKit: { bold: false, heading: { levels: [1, 2] } },
        textStyle: false,
        link: false,
        characterCount: false,
        whiteboard: false, flowchart: false, mindMap: false, textDiagram: false
      }
    });
    instances.push(instance);
    expect(instance.editor.state.schema.marks.bold).toBeUndefined();
    expect(instance.editor.state.schema.marks.textStyle).toBeUndefined();
    expect(instance.editor.state.schema.marks.link).toBeUndefined();
    expect(instance.editor.storage.characterCount).toBeUndefined();
    expect(instance.editor.state.schema.nodes.whiteboard).toBeUndefined();
    expect(instance.editor.state.schema.nodes.flowchart).toBeUndefined();
    expect(instance.editor.state.schema.nodes.mindMap).toBeUndefined();
    expect(instance.editor.state.schema.nodes.textDiagram).toBeUndefined();
    expect(instance.editor.commands.setHeading({ level: 3 })).toBe(false);
    expect(instance.editor.commands.setHeading({ level: 2 })).toBe(true);
  });

  it("accepts a replacement semantic profile without installing duplicate defaults", () => {
    const instance = createBlockEditor({ content, preset: false, extensions: [StarterKit] });
    instances.push(instance);
    expect(instance.editor.extensions.filter((extension) => extension.name === "starterKit")).toHaveLength(1);
    expect(instance.editor.state.schema.marks.link).toBeUndefined();
    expect(instance.editor.commands.insertContent("custom ")).toBe(true);
    expect(instance.editor.getText()).toContain("custom");
  });

  it("keeps additional extension storage, callbacks and destruction instance-owned", () => {
    const onCreate = vi.fn();
    const onDestroy = vi.fn();
    const feature = Extension.create({
      name: "fixtureFeature",
      /** @returns Fresh instance-owned test storage. */
      addStorage() { return { value: 0 }; }
    });
    const first = createBlockEditor({ content, extensions: [feature], onCreate, onDestroy });
    const second = createBlockEditor({ content, extensions: [feature] });
    instances.push(first, second);
    (first.editor.storage.fixtureFeature as { value: number }).value = 1;
    expect(second.editor.storage.fixtureFeature).toEqual({ value: 0 });
    expect(onCreate).toHaveBeenCalledTimes(1);
    first.destroy();
    first.destroy();
    expect(onDestroy).toHaveBeenCalledTimes(1);
    expect(second.editor.isDestroyed).toBe(false);
    expect(() => first.mount({} as HTMLElement)).toThrow("destroyed Block Editor");
  });

  it("does no product serialization or statistics work on input and selection", () => {
    const textCounter = vi.fn((text: string) => text.length);
    const instance = createBlockEditor({ content, preset: { characterCount: { textCounter } } });
    instances.push(instance);
    const serialize = vi.spyOn(instance.editor, "getJSON");
    instance.editor.commands.insertContent("a");
    instance.editor.commands.insertContent("b");
    instance.editor.commands.setTextSelection({ from: 1, to: 4 });
    expect(textCounter).not.toHaveBeenCalled();
    expect(serialize).not.toHaveBeenCalled();
    const statistics = instance.editor.storage.characterCount as CharacterCountStorage;
    expect(statistics.characters()).toBe(10);
    expect(textCounter).toHaveBeenCalledTimes(1);
  });

  it("creates fresh presets without registering a concrete view", () => {
    const first = createBlockEditorPreset();
    const second = createBlockEditorPreset();
    expect(first.map((extension) => extension.name)).toEqual([
      "blockCollaboration", "blockRichContent", "blockColumns", "blockColumn", "blockAsset", "inlineAttachment", "imageGallery", "webCard", "blockFootnotes", "blockDefinitions", "blockInlineContent", "blockMath", "blockContainer", "image", "blockWritingHint", "dataView", "textDiagram", "mindMap", "flowchart", "whiteboard", "starterKit", "horizontalRule", "codeBlock", "wordParagraph", "blockParagraph", "textStyleKit", "blockScriptFonts", "link", "characterCount", "search", "formatting", "blockSections", "blockContextMenus", "blockInteraction"
    ]);
    expect(first[0]).not.toBe(second[0]);
    expect(createBlockEditorPreset({ richContent: false, bodyContent: false, math: false, containers: false, image: false, dataView: false, starterKit: false, paragraphFormat: false, textStyle: false, link: false, characterCount: false, whiteboard: false, flowchart: false, mindMap: false, textDiagram: false, search: false, formatting: false, blockInteraction: false }).map((extension) => extension.name)).toEqual(["blockCollaboration"]);
  });
});
