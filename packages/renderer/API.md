# @quirekit/renderer API

English | [简体中文](./API.zh-CN.md)

This document describes the public API exported from `@quirekit/renderer`.
Import from the package root unless a later release explicitly documents stable
subpath exports.

```ts
import {
  compileQuireViewNode,
  createCanvasClusterGlyphRunPainter,
  createCanvasPathGlyphRunPainter,
  createQkView,
  createQuireViewContextKey,
  createQuireViewScope,
  createQuireViewTargetIndex,
  createQuireViewWidgetIndex,
  qkView,
  renderCanvasDisplayList,
  serializeSvgDisplayListToSvg,
  type QuireDisplayList
} from "@quirekit/renderer";
```

## Package Shape

```text
@quirekit/renderer
  core    geometry/range/paint algorithms and neutral contract re-exports
  browser shared text metrics with an explicitly injected Document
  canvas  Canvas 2D backend
  svg     SVG serialization and live-DOM backend
  widget  qkView factories and compiler
```

The package transforms plain renderer data into Canvas 2D calls, SVG output, or
new display-list output. It does not create editor state, inspect ProseMirror
documents, or handle browser input.

## Browser text measurement

`layoutQuireText` defaults to `wrapMode: "word"`; `anywhere` allows breaks between graphemes,
while `none` retains only explicit breaks and empty lines. The latter supports text fitted to a frame
without adding width-driven lines, while retaining the shared shaping, alignment and cluster geometry.
The caller owns scaling to the target frame.

Optional `tabs` uses CSS pixels at one logical origin: sorted `stops`, a positive
finite `defaultInterval` continuing the grid after the last explicit stop, and
`offset` from that origin to the current region's leading edge. A hanging first
line reaches that edge before the grid. Default stops
have no leader; each Tab retains one source position. Absence keeps ordinary layout.

`tryCreateQuireBrowserTextMeasurer({ ownerDocument, cacheSize? })` returns a clearable reader,
or `undefined` when Canvas 2D is unavailable. Hosts own explicit fallback/error policy and font-loading
invalidation. The reader uses no global document or mounted View. `measureText(text, font)` returns
CSS-pixel width, available font-box ascent/descent and script-aware normal line height, never current-string
ink height. Call `clear()` after font changes or at teardown; each cache defaults to 2048 entries.

The optional `trailingSpacing` on text/glyph-run commands is layout-only advance included in `rect.width`,
not authored tracking or glyph scaling. Native-text fitting subtracts it from occupied width; next-run origins,
selection and hit testing continue to use the full occupied geometry.

Text runs and text/glyph-run commands accept a positive finite `horizontalScale` ratio, defaulting to 1.
Layout scales natural advances and horizontal glyph positions; tracking, line height, and baselines stay
independent. Command rectangles and glyph positions already use final geometry. Canvas/SVG project
positions back into paint-local coordinates, then apply an origin-preserving horizontal affine. Custom
glyph painters receive the projected command. Canvas applies the transform to the drawing context;
SVG wraps returned nodes in a transformed group. Neither painter should apply the ratio again.
Document profiles convert semantic units such as Word percentages; this package does not parse them.
See the [character scaling contract](../../docs/research/word-text-scale.zh-CN.md).

The optional `autoSpacing: QuireTextAutoSpacing` input to `layoutQuireText` adds spacing between adjacent
Han and Latin letters (`ideographAlpha`) or ASCII digits (`ideographNumeric`) within one line slot.
Values are finite, non-negative fractions of the Han-side font's em; omitted values or zero disable spacing.
Document profiles such as Word choose their own ratios. Spacing contributes to wrapping, cluster advances,
and independent paint placement without changing source text or offsets. Existing whitespace, replacement
nodes, line breaks, and slot boundaries interrupt it. Complex RTL boundaries, vertical writing, and complete
East Asian grid compression are outside this basic policy.

## Core Data

Neutral types are defined once in the MIT `@quirekit/render-contract` package and
re-exported here for compatibility. Algorithms, component compilation, and painting
live in this package.

Core data types are the shared language between the widget compiler, Canvas
backend, SVG backend, and editor view packages.

### Geometry

Geometry describes coordinates and rectangles in renderer coordinate space.
Use these types for command bounds, widget layout, overlay placement, and dirty
region calculations.

| API | What it means | Notes |
| --- | --- | --- |
| `QuirePoint` | `{ x, y }` point. | Coordinates are plain numbers. The caller decides whether they are CSS pixels, document units, or transformed units. |
| `QuireSize` | `{ width, height }` size. | Width and height should be non-negative. |
| `QuireRect` | `{ x, y, width, height }` rectangle. | Used by display-list commands, widget output, overlays, and SVG viewboxes. |
| `isQuireRectFinite(rect)` | Tests whether coordinates and extents are finite and extents are non-negative. | Non-finite values and negative extents fail closed instead of being flipped implicitly. |
| `isQuireRectEmpty(rect)` | Returns `true` when a rect is invalid or lacks positive area. | Zero-area geometry can still participate in distance queries, but not paint or positive-area intersection. |
| `containsQuirePoint(rect, point)` | Tests whether a point is inside a rectangle, including edges. | Useful for lightweight hit tests. |
| `intersectQuireRects(first, second)` | Returns the positive-area intersection or `null`. | Use to clip invalidation or visibility regions. |
| `doQuireRectsIntersect(first, second)` | Tests whether two valid rects have a positive-area intersection. | Edge-only and corner-only contact returns `false`. |
| `doesQuireRectIntersectAny(rect, candidates)` | Tests whether a rect has positive-area intersection with any candidate. | An empty array returns `false`; callers retain any `undefined`-means-unbounded policy. |
| `measureQuireRectDistanceSquaredToPoint(rect, point)` | Returns squared Euclidean distance from a point to a rect. | Interior and boundary points return `0`; invalid geometry returns `Infinity`. |

### Document Coordinates

Document coordinates are plain metadata that can travel with render output. The
renderer stores them but does not interpret or mutate ProseMirror documents.

| API | What it means | Notes |
| --- | --- | --- |
| `QuireDocumentPositionBias` | `-1 | 0 | 1` directional bias for ambiguous positions. | Used by editor layers to resolve caret affinity. |
| `QuireDocumentPosition` | Document position plus optional bias. | Renderer output can keep this metadata for later mapping. |
| `QuireDocumentRange` | `{ from, to }` document range. | Used by text fragments, overlays, and selection geometry. |
| `isQuireDocumentRangeEmpty(range)` | Returns `true` when `to <= from`. | Useful before emitting selection or overlay metadata. |

### Display Lists

A display list is the renderer's resolved paint format. It is serializable,
backend-neutral, and consumed by both Canvas and SVG.

| API | What it means | Notes |
| --- | --- | --- |
| `QuireDisplayCommand` | Union of `fill-rect`, `text`, `glyph-run`, `caret`, `line`, `path`, `image`, and `clip` commands. | Commands carry exact geometry and paint fields. `glyph-run` also carries shaped glyph placement metadata, `glyphCoverage`, and fallback text paint data. |
| `QuireDisplayCommandLayer` | `"content" | "overlay"`. | Overlay commands can be separated from persistent content. |
| `QuireDisplayList` | `{ bounds, commands }`. | `bounds` is the viewport/clear area for this command batch. |
| `QuireDisplayListLayers` | `{ content, overlay }` split output. | Both lists keep the same bounds. |
| `splitQuireDisplayListLayers(displayList)` | Splits overlay commands from content commands. | Useful when the view wants to repaint content and selection/caret overlays separately. |
| `createQuireRoundedRectPathSegments(rect, radius)` | Creates clockwise rounded-rectangle path segments with stable topology. | Radius is zeroed or clamped to half the short side; invalid or zero-area rects return an empty array. |
| `readQuireDisplayCommandPaintBounds(command)` | Reads renderer-neutral approximate paint bounds for a command. | Invalid or missing runtime geometry returns `null`; callers must apply a conservative unknown-bounds policy. |

### DOM Overlays

`QuireLayoutDomOverlay` describes a real DOM island that should be mounted
above Canvas or SVG output. It stores a stable id, geometry, optional document
range, HTML, and accessibility metadata.

The renderer only emits descriptors. The caller owns actual DOM mounting, event
routing, focus, IME, and editor transactions.

### Draw Surface

`QuireDrawSurface` is the imperative drawing protocol shared by render
backends. Implement it when you want a custom target that can consume standard
display-list commands.

| API | What it does | Parameters |
| --- | --- | --- |
| `paintQuireDisplayCommand(surface, command)` | Dispatches one display-list command to a `QuireDrawSurface`. | `surface` is your backend implementation; `command` is one `QuireDisplayCommand`. |

## Canvas 2D Output

Use the Canvas API when your final target is a browser
`CanvasRenderingContext2D` or a compatible test/mock context.

| API | What it does | Parameters and effects |
| --- | --- | --- |
| `createCanvas2DDrawSurface(target)` | Adapts a Canvas 2D-like target into `QuireDrawSurface`. | `target` must implement the methods used by display commands, such as `fillRect`, `fillText`, path methods, clipping, and image drawing. |
| `renderCanvasDisplayList({ displayList, target })` | Clears `displayList.bounds`, then paints every command to `target`. | The caller owns canvas element sizing, device-pixel-ratio scaling, scheduling, and retained-state strategy. |
| `createCanvasClusterGlyphRunPainter()` | Creates an opt-in glyph-run painter that draws source text clusters at shaped offsets through native `fillText`. | Useful for diagnostics and early shaped-placement validation. It is not a real glyph-id/path backend and may lose cross-cluster kerning. Pass it as `glyphRunPainter` to Canvas render options when you explicitly want this behavior. |
| `createCanvasPathGlyphRunPainter(source)` | Creates an opt-in glyph-run painter that fills renderer-provided glyph outlines. | `source.getGlyphPath({ glyphId, font, fontId?, fontFamily? })` must return glyph-local CSS-pixel path segments. `font` is the fallback CSS font shorthand from the run, so outline registries can parse the paint size. It only attempts runs with `glyphCoverage: "complete"`; partial coverage, missing outlines, or missing Canvas path APIs fall back to native whole-run `fillText`. |
| `CanvasGlyphPathSource` | Resolves one glyph id plus optional font identity into a path outline. | This abstraction keeps font parsing, atlas/path caches, and fontkit/HarfBuzz-specific state outside the display-list contract. |
| `Canvas2DRenderTarget` | Minimal Canvas 2D-like target type. | Browser `CanvasRenderingContext2D` is compatible. |
| `CanvasGlyphRunPainter` | Adapter hook that can fully handle a `glyph-run` command and return `true`. | Return `false` to let the Canvas adapter fall back to native whole-run `fillText`. |
| `Canvas2DRenderOptions` | `{ displayList, target, glyphRunPainter? }`. | Passed to `renderCanvasDisplayList`. |

Default editor Canvas text paint remains native whole-run `fillText`.
`CanvasClusterGlyphRunPainter` is a shaped-placement diagnostic that still
paints text slices through `fillText`. `createCanvasPathGlyphRunPainter(source)`
is suitable for exact-paint experiments only when the command has complete glyph
coverage and the source can resolve every outline. The HTML editor runtime does
not participate in Canvas text paint diffs because it validates DOM-mode
compatibility and browser layout, not the Canvas display-list adapter.

## SVG Output

Use the SVG API when you need deterministic markup, snapshots, export, or a
mounted SVG runtime.

| API | What it does | Parameters and effects |
| --- | --- | --- |
| `serializeSvgDisplayListToSvg(options)` | Converts a display list to an SVG string. | `options.displayList` is required. Optional overlays and viewport values shape the generated groups and viewbox. |
| `syncSvgDisplayListToSvg(options)` | Replaces a live SVG host with content, overlay, and DOM-overlay groups. | Use for mounted browser views. The host element is updated to match the current display list. |
| `createSvgSvgDrawSurface(options)` | Creates a `QuireDrawSurface` that appends SVG elements. | Useful if a custom serializer wants to reuse the standard command dispatcher. |
| `SvgSerializeOptions` | Display list plus optional overlays and viewport. | Passed to SVG serialization. |
| `SvgSyncOptions` | SVG host plus display list, overlays, and viewport. | Passed to live DOM sync. |
| `SvgDrawSurfaceOptions` | SVG parent plus optional `defs`. | Passed to SVG draw-surface creation. |

## qkView Widgets

`qkView` is a declarative authoring layer. You create a tree of
`QuireViewNode` values, then compile it to a `QuireDisplayList` and DOM overlay
descriptors.

```ts
const output = compileQuireViewNode({
  id: "badge",
  origin: { x: 0, y: 0 },
  constraints: { minWidth: 0, maxWidth: 200, minHeight: 0, maxHeight: 48 },
  node: qkView.surface({
    padding: qkView.insets({ top: 4, right: 8, bottom: 4, left: 8 }),
    style: { fill: "#ecfeff", stroke: { color: "#67e8f9" } },
    child: qkView.text({
      text: "Ready",
      style: { font: "600 12px system-ui", color: "#155e75" }
    })
  })
});
```

### Layout And Container Factories

| API | What it does | Important options |
| --- | --- | --- |
| `qkView.surface(options)` | Semantic container that can draw fill/stroke chrome and lay out one child inside optional padding. | `width`, `height`, `padding`, `style.fill`, `style.stroke`, `child`. Use this instead of combining a background box with an overlay for common cards and callouts. |
| `qkView.flex(options)` | Lays children along an explicit `direction`: `"row"` or `"column"`. | `direction`, `children`, `gap`, `padding`, optional fixed `width`/`height`. |
| `qkView.row(options)` | Convenience wrapper for `qkView.flex({ direction: "row" })`. | Good for toolbar-like horizontal content. |
| `qkView.column(options)` | Convenience wrapper for `qkView.flex({ direction: "column" })`. | Good for title/body vertical content. |
| `qkView.overlay(options)` | Paints all children from the same origin in array order. | `children`, optional `width`/`height`. Use for layered output where order matters. |
| `qkView.positioned(options)` | Places one child relative to the current parent bounds. | `left`, `right`, `top`, `bottom`, optional `width`/`height`, `child`. Usually used inside `overlay`. |
| `qkView.padding(options)` | Layout-only wrapper that insets one child. | `insets`, `child`. Use for spacing, not absolute positioning. |
| `qkView.clip(options)` | Wraps child commands in a rectangular clip command. | Optional `width`/`height`, `child`. |
| `qkView.spacer(options)` | Reserves fixed space or consumes remaining flex space. | `width`, `height`, `flex`. A `flex` spacer only grows inside `qkView.flex`, `row`, or `column`. |

### Paint And Overlay Factories

| API | What it does | Important options |
| --- | --- | --- |
| `qkView.box(options)` | Draws a filled and/or stroked rectangle. | `width`, `height`, `style.fill`, `style.stroke`. Use for simple marks or low-level paint. Prefer `surface` for semantic containers. |
| `qkView.text(options)` | Draws one single-line text command. | `text`, optional `width`/`height`, `style.font`, `style.color`, `style.lineHeight`, `style.baselineOffset`. It does not perform editable paragraph layout. |
| `qkView.paragraphPreview(options)` | Draws wrapped or ellipsized static text for widget chrome. | `text`, `width`, optional `height`, `maxLines`, `overflow: "visible" | "clip" | "ellipsis"`, `whiteSpace: "normal" | "nowrap"`, and text `style`. It is intentionally non-editable and does not own PM positions, selection, IME, or pagination. |
| `qkView.divider(options)` | Draws a lightweight separator line. | `axis: "horizontal" | "vertical"`, optional `width`, `height`, `style.color`, `style.width`. |
| `qkView.customPaint(options)` | Escape hatch that returns display commands from a callback. | `width`, `height`, `paint(rect, id, runtime)`. `runtime.host` exposes the compile-time host surface when supplied. Use for paths, icons, or specialized drawing not covered by primitives. |
| `qkView.domOverlay(options)` | Emits a DOM overlay descriptor with resolved geometry. | `width`, `height`, `html`, `ariaLabel`. The caller still mounts and wires the DOM. |
| `qkView.insets(value)` | Normalizes inset shorthand. | Accepts a number or partial `{ top, right, bottom, left }` object. |
| `qkView.emptyInsets` | Reusable zero-inset object. | Useful when a factory needs explicit empty padding. |
| `createQkView<TContext>()` | Returns the same qkView factories typed for a runtime event context. | It does not create or capture scope. Use it when direct event handlers should infer `event.context`. |

Use `paragraphPreview` when a card or callout needs text-like behavior but the
text is not an editable document paragraph:

```ts
qkView.paragraphPreview({
  text: "A long callout body can be collapsed into one visual line.",
  width: 180,
  maxLines: 1,
  overflow: "ellipsis",
  whiteSpace: "nowrap",
  style: { font: "13px system-ui", color: "#475569", lineHeight: 20 }
});

qkView.paragraphPreview({
  text: "The same primitive can wrap when the UI wants the callout to grow.",
  width: 180,
  overflow: "visible",
  style: { font: "13px system-ui", color: "#475569", lineHeight: 20 }
});
```

Editable PM `Paragraph` nodes still belong to the document-flow layout engine.
They need position mapping, selection rectangles, caret stops, IME composition
geometry, and pagination data that a static widget preview must not pretend to
own.

### Compiler

| API | What it does | Parameters and result |
| --- | --- | --- |
| `compileQuireViewNode(options)` | Compiles one widget tree to display-list output. | `options.id` prefixes generated commands, `origin` places the root, `constraints` bounds layout, `node` is the root widget. Optional `host` is exposed to widget callbacks as `runtime.host`. The result contains `rect`, `displayList`, `domOverlays`, and `targets`. |

### View Targets And Event Scope

Interactive widgets declare event bindings on their node spec. The compiler
turns semantic or eventful nodes into `QuireViewTarget` values. A mounted
surface owns native event listening and hit testing, then dispatches through a
scope.

| API | What it does | Notes |
| --- | --- | --- |
| `createQuireViewContextKey<T>(name)` | Creates a typed provide/inject key for a view scope. | Keys are scope-local and never global mutable state. |
| `createQuireViewScope(options?)` | Creates a runtime scope for context, provided values, named handlers, and event dispatch. | Renderer consumers can use this without creating an editor. Editor views should create one scope per mounted view or clone. |
| `QuireViewScope.provide(key, value)` | Provides a dependency for later event handlers. | Handlers read it through `event.inject(key)` or `event.require(key)`. |
| `QuireViewScope.setHost(host)` | Updates the host surface exposed to future events. | Use this after mount, remount, mode switch, or host surface replacement. Pass `undefined` when detached. |
| `QuireViewScope.getHost()` | Reads the current host surface metadata. | Returns the same object exposed as `event.host`. |
| `QuireViewScope.registerEventHandler(id, handler)` | Registers a named event handler. | Returns a cleanup function. Named handler descriptors carry serializable ids; direct handlers are local runtime closures. |
| `QuireViewScope.dispatchViewEvent(options)` | Dispatches a target or semantic event. | If `options.binding` is omitted, the scope walks `options.path` from deepest to outermost target and reads each target binding from `events[options.type]`. `event.target` remains the original hit target; `event.currentTarget` changes per target. |
| `QuireViewScope.dispatchViewEventResult(options)` | Dispatches an event and returns detailed cancellation state. | Use this in mounted runtimes that need to skip default selection or pointer behavior when a handler calls `event.preventDefault()`. |
| `createQuireViewTargetIndex(targets)` | Builds a query index from compiled targets. | Use it for hit testing, ancestry lookup, role/part lookup, and range-based lookup before dispatching through a scope. |
| `QuireViewTargetIndex.hitTest(point)` | Finds the deepest topmost pointer target at a renderer-space point. | The returned hit includes `target`, `path`, and `point`. Targets with `pointerEvents: "none"` are ignored. |
| `QuireViewTarget` | Resolved hit-test/event target. | Contains id, tree path, rect, optional range, role, part, owner, pointer policy, cursor, and event bindings. |
| `QuireViewOwner` | Renderer-neutral owner metadata attached to a target or widget. | Use it to record whether the target was produced by a document node, mark, decoration, extension, or standalone widget family. Owner metadata does not make a target interactive by itself; owner-only targets default to `pointerEvents: "none"`. |
| `createQuireViewWidgetIndex(targets, options?)` | Wraps compiled targets in virtual widget objects. | Use it when consumers need DOM-like `parent`, `children`, `ancestors`, `host`, and geometry helper methods instead of bare target records. `options.getHost` lets widgets read the current host lazily. |
| `QuireViewWidget` | Virtual widget object backed by a `QuireViewTarget`. | Exposes target metadata, including `owner`, plus `targetPath`, `parent`, `children`, `ancestors`, `host`, `containsPoint(point)`, `containsPosition(pos)`, and `overlapsRange(range)`. `targetPath` can be passed to `QuireViewScope.dispatchViewEvent()`. It remains renderer-neutral and does not import editor types. It is not the same concept as a ProseMirror widget decoration. |
| `QuireViewHost` | Renderer-neutral host surface metadata. | Contains `kind`, optional `id`, the host-owned `surface`, and optional metadata. It is scope-owned runtime data, not a field on `QuireViewNode`. |
| `QuireWidgetRuntimeContext` | Runtime data passed to widget callbacks. | Currently exposes `host`, matching the host passed to `compileQuireViewNode({ host })`. |
| `QuireViewEventBinding` | Event binding accepted by qkView nodes. | Either `{ handler, payload }` or a direct handler. String shorthand is not supported. |

```ts
declare const canvasElement: HTMLCanvasElement;

const OpenKey = createQuireViewContextKey<(id: string) => void>("open");
const scope = createQuireViewScope({
  host: {
    kind: "canvas",
    surface: canvasElement
  }
});

scope.provide(OpenKey, id => console.log(id));
scope.registerEventHandler("detail.open", event => {
  console.log(event.host?.kind);
  event.require(OpenKey)(event.target?.id ?? "");
});

const output = compileQuireViewNode({
  id: "button",
  origin: { x: 0, y: 0 },
  constraints: { minWidth: 0, maxWidth: 160, minHeight: 0, maxHeight: 48 },
  node: qkView.surface({
    id: "doc-1",
    role: "button",
    onClick: { handler: "detail.open" },
    child: qkView.text({ text: "Open" })
  })
});
const targetIndex = createQuireViewTargetIndex(output.targets);
const hit = targetIndex.hitTest({ x: 8, y: 8 });

if (hit) {
  scope.dispatchViewEvent({
    type: "click",
    point: hit.point,
    target: hit.target,
    path: hit.path
  });
}
```

### Constraint Helpers

Constraint helpers are useful when embedding the compiler in a larger runtime.
Most extension authors only need the `constraints` object passed to
`compileQuireViewNode`.

| API | What it does |
| --- | --- |
| `createQuireWidgetConstraints(options)` | Normalizes min/max width and height, filling missing values with safe defaults. |
| `createTightQuireWidgetConstraints(size)` | Creates constraints where min and max equal the same size. |
| `createQuireWidgetInsets(value)` | Normalizes inset shorthand. |
| `insetQuireWidgetConstraints(constraints, insets)` | Shrinks constraints by padding insets. |
| `clampQuireWidgetDimension(value, min, max)` | Clamps one dimension into a min/max range. |
| `resolveQuireWidgetDimension(value, min, max)` | Resolves optional fixed size against constraints. |
| `isFiniteQuireWidgetDimension(value)` | Returns whether a dimension is a finite number. |
| `emptyQuireWidgetInsets` | Constant `{ top: 0, right: 0, bottom: 0, left: 0 }`. |

## Import Guidance

Prefer root imports:

```ts
import {
  qkView,
  renderCanvasDisplayList,
  serializeSvgDisplayListToSvg,
  type QuireDisplayList
} from "@quirekit/renderer";
```

Avoid private source paths such as `@quirekit/renderer/src/svg/sync`. The root
export is the public compatibility boundary.
