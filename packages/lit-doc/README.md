# @quirekit/lit-doc

QuireKit's own TypeScript legacy Word reader and foundational converter, running in Node and browser module Workers. MIT licensed.
The reader and projection use no native conversion engine. `lit-docx-contract` is a types-only dependency; the injected DOCX runtime retains its own license.

**Current scope includes source inspection and experimental DOC → typed OOXML → DOCX → LitAST conversion.**
The foundation retains main-story text, empty paragraphs, admitted direct character/paragraph fields, named styles and explicit page properties.
Tables project a common grid, dimensions and horizontal/vertical merges with limited styling coverage. List definitions, instances, levels and start overrides are projected with explicit shared-counter and presentation limits. Main-story and header/footer inline pictures and ordinary top-level floating pictures support bounded media extraction and DrawingML projection. Floating pictures retain independent position axes, basic wrapping and paint order, with explicit contour approximation. Headers and footers retain six variants, section inheritance and explicit blanks. Floating-table positioning and overlap are retained. Complete wrapping, other auxiliary stories, complex objects and full DOP settings have separate boundaries.
Basic Classic integration is verified for the authored Chinese fixture. Native 1/0-start fixtures verify editable numbering round trips. Table dimensions, horizontal/vertical splitting and PNG/JPEG picture metadata and dimensions have actual Classic history/export checks. Raw inspection retains source controls.

## Node or synchronous inspection

```ts
import { readFile } from 'node:fs/promises'
import { inspectDoc, DocReadError } from '@quirekit/lit-doc'

try {
  const source = inspectDoc(await readFile('legacy.doc'))
  console.log(source.scope, source.pieces, source.stories, source.diagnostics)
} catch (error) {
  if (error instanceof DocReadError) console.error(error.code, error.message)
  else throw error
}
```

Input is a `Uint8Array`; fetching files belongs to the caller. Returned CP ranges
count UTF-16 code units, with exclusive ends. Physical piece byte offsets are
relative to the `WordDocument` stream. Text retains BOMs, lone surrogates and
control units. The caller's input is neither changed nor detached.

FAT sectors explicitly located by DIFAT may use an `ENDOFCHAIN` self marker. The reader reports
`fat-sector-end-marker` and retains exclusive metadata ownership. Shared sectors, cycles, out-of-range
links and incorrect chain lengths still fail. Paragraph formatting and complete conversion apply their
own checks after source text becomes readable.

Once slot 0/type 5, the root's absent siblings and allocation topology are verified, a bounded
nonstandard root label may be ignored with `root-label-ignored`. The label never identifies a stream,
and diagnostics do not expose its original path. Ordinary member terminators, names, duplicate
identities and parent isolation remain validated.

## Floating drawing source inspection

`inspectDoc(bytes, { includeDrawings: true })` returns the `drawings` source graph: original anchors
in both parts, labelled main/header drawings, group ownership, raw shape types/flags, separate
property layers and global defaults. Label order does not determine the part. Header CPs use common
source coordinates, while the undefined terminal PLC operand retains its original relative value.
Twip rectangles, negative coordinates, fBid/fComplex, complex bytes and array headers are not
prematurely normalized. An absent directory differs from an existing empty group.
The original `mediaDeclaredCount` and physical `mediaCount` remain distinct; differences report a compatibility diagnostic.

This option implies neither complete formatting nor media decoding. `OfficeArtProperty.complex`
is an independent `Uint8Array`; real Workers return the same complete graph. This is not editable
LitAST, OOXML raw preservation or a directly JSON-persistable contract. The watermark source predicate
does not establish WordArt/watermark rendering. Ordinary floating pictures and other object conversion
retain their [separate admission scope](../../docs/changes/legacy-doc-import/floating-drawings.zh-CN.md).

Anchors and shapes each use `maxDrawings`, default/hard ceiling 10,000/100,000. Container depth
`maxDrawingDepth` is 64/256. Copied complex property bytes use `maxDrawingPropertyBytes`, 8/64 MiB.
Inline pictures share the same OfficeArt record/property reader and complex-byte ceiling.
Record/property work also consumes shared `maxPropertyOperations`. Structural and budget failures
reject explicitly instead of becoming empty drawings.

## Textbox source inspection

`inspectDoc(bytes, { includeTextboxes: true })` returns `textboxes`: complete original FTXBXS
chain descriptors and BKD display fragments for body and header textbox subdocuments. Each part
retains relative CPs, original flags, shape identities and unused terminal operands. Text remains
stored once in `text`. The final descriptor is always spare, even with a zero original flag;
its potentially out-of-story endpoint is never treated as displayed author content. Missing and
physically empty tables remain distinct.

This option does not decode formatting, drawings or media, or create LitAST/Classic stories.
Both table families and parts share `maxTextboxEntries` (10,000 default, 100,000 hard ceiling)
and the property-work budget. `textbox-formatting-unresolved` keeps native rich text, display-chain
execution and shape association outside this source-only scope; ordinary native frames follow the separate conversion scope below. Node and real Workers validate
all fields, preserve the caller input and reject old workers missing the requested result.

`pnpm doc:textboxes:source` checks all 558 originals against independent POI table facts and real
Workers: 414 matched, 139 source refusals, five reference-unverified, zero mismatches. Of 50 originals
with textbox subdocuments, 48 are readable, with 804 chain descriptors and 804 display fragments.
These source observations do not claim native conversion or final layout fidelity.

## Ordinary textbox conversion

Ordinary top-level rectangular textboxes in main/header stories use exact CP/FSPA,
ClientTextbox/lTxid and FTXBXS owner associations. Complete single-frame author paragraphs,
blank paragraphs, tables, character/paragraph formatting, shared styles/numbering and ordinary
fields reuse the existing Story conversion into DrawingML, LitAST `textBox` and Classic owned
stories. Guard CRs, spare slots and unknown cached display endpoints never become author text;
shape order is not used to guess ownership.
An original next-shape operand pointing to the frame itself is accepted only with a single-frame
FTX descriptor, sequence zero and unique active text owner/FSPA, reporting
`textbox-self-link-variant`; this neither creates a cycle nor splits a real linked chain.

Frames retain creation extents, independent position axes, basic wrapping/distances/stacking,
rotation/flips, direct RGB solid/no-fill paint, ordinary outlines, insets, horizontal wrapping,
vertical alignment and fit-shape-to-text. Anchor locks survive JSON and fresh output through safe
drawing metadata, without introducing Classic lock commands. Inline images register atomically
under the containing OPC part; refused textbox content leaves no image graph, while budget errors
remain fatal. Original shape roles are indexed once. Legacy SHAPE field wrappers are explicitly
normalized with a `legacy-shape-field-normalized` loss, leaving their displayed drawings under
independently editable object/text owners instead of an opaque ordinary-field cache.

Axis-aligned groups of ordinary rectangular textboxes and pictures reuse the same source owners,
retaining the original hierarchy, nested physical placement, text identities and media bytes.
The initial DOCX retains native `wpg` grouping; LitAST/Classic use their existing independently
editable-leaf contract and report that fresh export omits the grouping relationship. A refused
group claims no author text and installs no partial media. Leaf aspect locks remain independent
of the group and cannot be overridden by stale preserved XML after editing.

Cross-paragraph, field-owned or grouped linked frames, rotated/reflected groups, shear, unsupported group leaves, vertical/rotated text, automatic margins, complex/theme paint,
effects and invalid position values retain explicit refusal/unprojected boundaries. Contour wrapping
is explicitly approximated as rectangular. Strict mode rejects declared losses. Textbox records,
drawing occurrences, formatting/tables/media and output each retain shared budgets.

`pnpm doc:textboxes:content` fixes all 50 textbox originals: 46 are convertible, with four source
refusals. Twenty originals emit 40 native frames with independently matched original identities
and frame properties; 38 also match complete text, table topology and
field instructions/caches. Two frames containing image controls remain outside complete-content
admission; their source media hashes and Classic edit/history/export/reopen preservation are checked.
All 40 source identities and their content boundaries are fixed admission requirements. Field-code
comparison ignores only generated outer ASCII spaces; internal/quoted whitespace, flags and caches
remain exact. Both raw options, JSON with **whole-frame rawXml forcibly removed**, fresh packages
and all 50 real Workers pass. Another 560
source text chains in converted originals, including 482 in Bug61268, remain explicitly unprojected; they are not removed from
the denominator. These checks do not claim all textboxes, producers or complete layout fidelity.

Eight originals pass Classic text/table editing, frame movement, complete history and independently
reopened fresh packages. Canvas/SVG checks use the real file menu and Worker, scoped text/table
paint, author-text hits/input, full history and actual export/reimport. Complete conversion and
previous picture admissions are checked separately from the new frame counts.

## Linked textbox data conversion

Ordinary independently anchored chains outside fields in one complete paragraph validate the original
author slot, consecutive frame sequence, exact next-shape edges, unique shapes/FSPAs and first-frame
FTXBX owner. Every frame and the complete author must pass before one text claim and its media are
installed. Each frame remains at its original CP: the author uses `wps:txbx(id)` and continuations use
`wps:linkedTxbx(id,seq)`. Author text is neither duplicated nor split using cached display fragments.
The declared chain count must match; a native producer's count-one variant is accepted only when
the complete graph establishes the actual chain, reporting `textbox-chain-count-variant`.

LitAST `textBox.attrs.textBoxLink` stores `{ chainId, sequence }`, with author children only at
sequence zero. JSON and native regeneration after removing raw XML retain the chain, each frame's
properties and one current author. Missing authors, duplicate/gapped sequences, content-owning
continuations, cross-Story links and unsupported chain extensions are explicitly refused.
Classic preserves these semantic links through author text and frame geometry edits with complete
history. It currently lays out text only in the author frame; import explicitly reports
`drawing-linked-textbox-flow-unavailable` instead of claiming continuation layout.

`pnpm doc:textboxes:links:produce --seed <pinned-ODT> --soffice <native-program> --corpus <external-directory>`
uses a pinned public fixture's valid frame styles to author native two/three-frame DOCs with six
English/Chinese paragraphs, recording the producer and file hashes externally.
`pnpm doc:textboxes:links` independently verifies five original frames and both complete authors,
two raw/JSON native round trips and real Workers. These inputs remain outside the fixed 558-file
denominator. Separate Classic and Canvas/SVG regressions exercise actual import, click/input,
history and exported-package reopening. The pinned LibreOffice preserves frames and complete text
when reopening this pure WPS output but does not restore text flow; native Word reopening, VML
fallback and cross-application layout equivalence remain outside admission.

## Foundational DOCX and LitAST conversion

```ts
import * as runtime from '@quirekit/lit-docx'
import { convertDocToDocx, parseDoc, DocConversionError } from '@quirekit/lit-doc/conversion'

// Best-effort conversion reports explicit losses and any content recovery.
const converted = await convertDocToDocx(bytes, runtime)
console.log(converted.docx, converted.report)
const parsed = await parseDoc(bytes, runtime, {
  lossPolicy: 'best-effort',
  parseOptions: { numberingMode: 'flat-numbered-paragraphs', preserveRawXml: true },
})
console.log(parsed.ast, parsed.warnings, parsed.report)
```

`createDocxSourcePlan(bytes, options)` creates the shared typed package graph without a ZIP writer.
The shared source interpreter keeps style definitions, four font slots and actual direct-field provenance;
it never writes all derived settings as direct formatting. Conversion uses the injected resolver/materializer,
and `parseDoc` then calls that runtime's existing `parseDocx`. `@quirekit/lit-docx` is a separately licensed commercial component.

Default `lossPolicy: 'best-effort'` first attempts complete conversion using the existing admitted
formatting, table, ordinary-field and object projections and their local loss policies. Required body
and FIB-selected table streams are acquired before auditing unrelated container streams. Unreadable
unused streams report `cfb-unreadable-streams-omitted`. Explicit `strict` retains complete source
preflight and rejects known omissions/approximations with `DocConversionError.report`.

The default path recovers bounded CFB allocation counts, metadata markers, directory links/names and
actual stream prefixes. A final v3 directory slot can omit its unused upper size word. Known FIB
locator prefixes and invalid cbMac hints remain bounded by actual bytes. A damaged CLX retains its
first continuous readable main-Story interval. `report.recovery.mainStoryRange` records the original
CP endpoints, with missing characters omitted and diagnosed. Missing prefixes with unresolved field
visibility retain a specific error.

After validating the actual text interval, local formatting-page, style, table, field or object
failures can trigger one ordinary-body recovery. `report.recovery.level` is `text` and `cause` retains
the original error code. Recovery preserves stored body order, empty paragraphs, tabs and manual
breaks. Tables and sections become ordinary paragraphs, with explicit losses for formatting, objects
and auxiliary Stories. Field instructions and indexed private caches are omitted. Unreadable field indexes
suppress all field caches, and ambiguous field ownership omits the remaining tail with a diagnostic.
When complete character runs are available, hidden/deleted text is omitted and inserted text is kept
with a revision-flattening loss. Otherwise `unresolvedTextSemantics` identifies unresolved hidden
formatting and tracked-change state in the recovered stored body. `unmeasuredSourceCounts` lists
unavailable source denominators whose numeric slots contain zero. Callers retain the original file.

`inspectDoc` and the source-record validation described below retain their separate strict contracts.
Best-effort conversion recovers the local failures described above. Unreadable core body storage,
encrypted input, unsupported formats/versions, exhausted budgets and cancellation retain specific errors.
Password/decryption APIs remain unimplemented. Unexpected program exceptions and host writer/parser failures propagate. Recovery
shares the output budget with the complete attempt. Forbidden XML scalars become U+FFFD with a loss
diagnostic. Complete projections and text recovery have separate counts in the
[content-recovery acceptance](../../docs/changes/legacy-doc-import/content-recovery.zh-CN.md).

Reports distinguish `loss`, `approximation`, `host-limit` and compatibility decisions. Repeated equivalent
issues retain an `occurrences` count and their first CP range. `source.codeUnits` counts complete source
storage. `paragraphs`, `characterRuns` and `tables` retain main-story counts. Inspect header/footer slots
and ranges with `includeHeaderFooters`. Styles, fonts and sections use document-wide counts.
Host limits mean OOXML retains a field while native LitAST/Classic presentation is limited, including logical
start/end and direct hAnsi font slots.
Legacy `sprmCCpg` (`0x486B`) consumes a complete two-byte operand and reports its unprojected semantics
through `source-properties-unprojected`. Source text follows the established FcCompressed/UTF-16 rules,
character resets retain the diagnostic, and strict conversion rejects the reported loss.
Output defaults/hard ceilings are 500,000/2,000,000 elements and
attributes, 16/64 Mi cumulative XML code units and 1,000/10,000 report entries; `outputLimits` controls them.
Overflow rejects explicitly.

## Ordinary complex fields

Ordinary fields retain begin/separate/end markers, lexical instructions and their run formatting, text
caches, separator-free shape, nested instructions and cross-paragraph results. Instruction carriers follow
any active ancestor code region without merging a child's cache into the parent's instruction. Result
flow retains paragraphs, empty paragraphs and complete tables. Existing LitAST, lit-docx and Classic
field models own persistence and editing. Source end-state locked maps to begin fldLock, including
explicit false. DOC edit/format flags are not assumed to mean OOXML dirty; unmapped state reports loss.
Private results containing data raise `unsupported-field`; empty results retain their shape with a loss
diagnostic. Broken pairing raises `invalid-field-data`. Cross-cell/Story pairing and cross-paragraph
instructions are explicitly refused.

FORMTEXT/FORMCHECKBOX/FORMDROPDOWN and EMBED/LINK require separate binary resource owners.
Best-effort reports `field-resource-unprojected`, atomically omits their code and markers, and keeps
displayed results under existing picture/note admission, preserving Classic media boundaries. Strict
mode rejects this loss. Other instruction resource controls are omitted with diagnostics. Non-text caches
of ordinary fields, form data/macros, OLE editing, complex reference dependencies and full recalculation still need
separate acceptance.

Of 17 pinned originals, 13 convert and four retain independent formatting refusals. Their 97 source fields
include 32 ordinary fields independently compared for instructions, caches, separators and locks under
the declared instruction-control loss policy; 65 resource fields remain explicitly unmodeled. Six structure
vectors pass both raw-preservation options, JSON persistence and fresh package reopening. A nested
vector passes the complete Worker lifecycle. Five Classic cases verify original-field locking, code edits,
nested children, table-result editing and exact undo/redo.

## Bookmark range conversion

Standard bookmarks pair source names/starts through explicit indexes into the independently ordered end
table. Original case, hidden prefixes, empty/crossing ranges, paragraphs and complete table flow are
retained. Boundaries split source runs without changing their formatting and emit paragraph children.
Table-column metadata round-trips as colFirst/colLast, with a separate host limit for rectangular
navigation. Temporary `_GoBack` is explicitly omitted. Unmapped fNative export hints report loss while
preserving named reference targets.

Independent actual Stories, split surrogate pairs, unprojected structural CPs and instruction-region
boundaries never produce half a bookmark: the complete unsupported pair is omitted and diagnosed.
Markers in field caches use existing rich-result preservation; native Classic global navigation and
reference evaluation inside those caches report a host limit. Ordinary targets work with existing
Classic bookmark commands and REF context. This slice adds no PAGEREF page recalculation.

Use `inspectDoc(bytes, { includeBookmarks: true })` for optional source inspection; the Worker accepts
the same option. `bookmarks.scope` is `bookmark-source`. Entries retain absolute UTF-16 CPs, raw BKC,
end-table indexes and source column intervals without implying character-format inspection.
maxBookmarks defaults to 10000 with a hard ceiling of 0x3FFC. Bad counts, duplicate end indexes,
reversed ranges and truncation raise `invalid-bookmark-data`. Plain text-storage inspection does not
parse this optional index.

The four original POI pageref.doc assertions pass Node and the real Worker. Its three replacement and
whole-pair deletion contracts are verified through complete Classic history and independent export.
Original DOC offsets remain distinct from editor coordinates, with range deltas checked under the
declared instruction-resource omission. See [bookmark acceptance](../../docs/changes/legacy-doc-import/bookmark-ranges.zh-CN.md)
for corpus counts and unverified targets.

## Comments and optional source indexes

Conversion retains original authors and initials, point/range anchors and complete rich message
paragraphs, blanks, tables, lists and ordinary fields through the existing OOXML, LitAST and Classic
comment/Story owners. Valid legacy DTTM values become minute-resolution floating ISO dates with
zero seconds as their carrier. Unknown dates remain absent; invalid active dates report loss. No
current time or UTC zone is invented. Classic now accepts empty initials, orders forward-linked parents
before replies, and collects comment-only numbering definitions.

Parent relationships use commentsExtended with native thread-root anchors. Separate legacy reply
quotations/references report loss instead of creating reply anchors that cannot be removed with their
thread. Unadmitted bodies, references or endpoints omit the entire thread and its resources. Initial DOCX
retains the original annotationRef; legacy ordinal presentation/position, ink and native object selection
have separate limits. Missing or mid-prefix self markers never cause author text to be trimmed.

`inspectDoc(bytes, { includeComments: true })` and the Worker optionally return `comments.scope =
'comment-source'`: exact authors, tags/ranges, absolute message CPs, raw DTTM and signed parent
deltas without implying rich-body formatting. maxComments defaults to 10000 with a hard ceiling of
100000, maxCommentAuthors to 10000/0x7FFF and maxCommentDepth to 64/256. Malformed graphs raise
`invalid-comment-data`; exhausted budgets still fail.

The 19 fixed originals contain 95 source comments: 94 match independent POI facts and one has an
unavailable reference. Actual conversion retains 95 messages across all 19 files; 94 messages and 80 ranges
in 18 files match independently. The remaining original retains its unavailable-reference boundary. Both raw modes,
JSON/fresh parts and complete Workers pass. Classic editing, replies, resolution, removal, complete
history and export have separate acceptance. See [comment acceptance](../../docs/changes/legacy-doc-import/comment-stories.zh-CN.md).

## Optional revision-author source table

`inspectDoc(bytes, { includeRevisionAuthors: true })` and the Worker return
`revisionAuthors.scope = 'revision-author-source'`, `present` and source-ordered `authors`.
Absent and present-empty tables remain distinct. Duplicate, empty and whitespace names are retained
without requesting paragraph or character formatting. A nonstandard first slot is preserved with a
diagnostic. A completely zero-filled residual directory follows independently verified POI empty-table
behavior and reports `revision-author-empty-directory`; other malformed tables raise `invalid-revision-data`.

`maxRevisionAuthors` defaults to 10000 with a hard ceiling of 65534. Aggregate UTF-16
`maxRevisionAuthorCodeUnits` defaults to 1 Mi with a hard ceiling of 8 Mi; both are checked before
allocation. Three original POI methods cover 16 passing assertions. Full Worker parity passes for all
558 originals: 416 independently matched author facts, 137 source refusals and 5 unavailable references.
This API reads only the directory; content review uses the separate source graph and conversion below.

## Ordinary text revisions and main-story source graph

`inspectDoc(bytes, { includeRevisions: true })` and the Worker return
`revisions.scope = 'main-story-revision-source'`, implying main-story paragraph/character inspection
and original authors. Every complete character interval retains effective insertion/deletion flags,
independent author indexes, explicit-author/date presence, raw DTTM, reason operands and three separate
save sessions. A missing date operation is null. Source CPs include paragraph endings and are not editor
positions. Inspection retains original operands; conversion separately requires valid active author
references and raises `invalid-revision-data` for missing/out-of-range slots.

Conversion writes ordinary main text as ins/del, with whitespace-preserving delText for deleted payloads.
Ordinary paragraph marks use separate pPr/rPr carriers through the existing LitAST/Classic owners.
Empty/whitespace authors remain exact. Unknown dates stay absent; valid dates use floating ISO minute
carriers without inventing a user, current time or UTC. Character resets preserve review operands.
Save sessions are not business change ids, and equal author/minute values do not imply one original change.

Dual flags, fields/resources, page/column controls, auxiliary Stories and table/section/final paragraph
boundaries retain their content under its original owner with explicit review losses. Property revisions
and moves are not represented as ordinary ins/del. Initial run save-session attributes survive OOXML;
edited LitAST/Classic persistence remains a host limit and paragraph-marker save sessions are unmapped.
Inactive actor/date operands remain inspectable without fabricating tracked events.

Across all 558 originals, 322 main-story review source observations match independent POI facts, 172 are
source refusals and 64 lack a reference; complete Worker parity passes. All 12 observed review originals
remain in the cohort: all 12 convert and pass both raw/JSON/fresh-package round trips.
Seven independently readable originals match 20,767 reviewed UTF-16
units and 260 paragraph markers; 10 structural markers remain explicitly omitted. Classic originals,
decisions and complete history have separate [acceptance](../../docs/changes/legacy-doc-import/text-revisions.zh-CN.md).

## Legacy styles and modern numbering

Old ilfo=2047 references in named styles no longer invalidate an independent modern LFO graph.
They report `legacy-style-numbering-unprojected` at the original style and emit numId=0 to block
unrelated inherited lists. Valid modern references, definitions and overrides retain their graph.
An actual Story using the old sentinel, a negative reference or a missing modern instance keeps
the existing whole-graph refusal. Strict conversion stays strict; ANLD counters remain unprojected.

`pnpm doc:numbering:styles` fixes seven originals. Four modern graphs independently match
97 instances, 193 levels and 362 active paragraph references. Bug61268 separately retains four
instances/36 levels through actual reconstruction and round trips, with its POI style-reset reference
still unavailable. Both raw options reconstruct numbering from runtime Maps, then verify JSON
preservation and complete Workers. Classic also retains style-only list users independently of
paragraph restarts and prior review states. Four originals pass editing/full-history/reopening;
the original 72pt marker retains its canonical markerStyle and exported size. These results do not
admit old counters, every shared-counter case or final layout fidelity.

## Numbering conversion

Conversion preserves definition/instance relationships, actual UTF-16 placeholder offsets, number
formats, zero starts, legal/restart/suffix/alignment fields and start-only/full replacements. Level
paragraph and marker properties reuse the existing interpreters. Actual direct writes remain separate
from style inheritance; labels are not inserted into body text. Unknown formats never become decimal.
Literal `%1`–`%9` ambiguity and negative-reference logical indentation refuse the optional graph;
uncovered fields report loss, while shared counters and downstream field gaps report `host-limit`.

Native Word 1/0-start DOC fixtures pass actual DOCX and independent XWPF comparisons, plus Classic
local restart, undo/redo and fresh export/reimport. Corpus graph counts observe projection and do not
admit every number format, counter sequence or layout. See the [numbering projection scope](../../docs/changes/legacy-doc-import/numbering-ooxml.zh-CN.md).

## Table dimensions and merges

Conversion unifies every row's original edge coordinates, retaining physical tracks, grid spans, omitted
leading/trailing columns, preferred percentage/absolute widths, row heights, explicit false and merge roles.
Preferred widths remain separate from the physical grid. Every continuation cell and its stored content
survive; Classic derives semantic rectangles, with split and undo preserving source identities.

Uncovered styles, borders, shading and margins report losses. Logical alignment, row-level exceptions,
omitted-column width preferences and nondefault text direction, fitText/hideMark are retained with host
limits. A known optional geometry refusal omits the complete table geometry in best-effort mode with
`table-geometry-unprojected`, preserving validated cells and text. Budgets, core topology and unexpected
errors still fail. Independent checks and producer limits are recorded in the
[table conversion scope](../../docs/changes/legacy-doc-import/table-geometry-ooxml.zh-CN.md).

## Inline picture conversion

Main-story and header/footer U+0001 anchors and their character locators are read through PICF, OfficeArt and BLIP.
The converter retains PNG/JPEG/TIFF file bytes and decoded EMF/WMF/PICT bytes, then projects source
frame dimensions, scale, crop, rotation, flips, aspect locks, names and alternative text into DrawingML.
Repeated source pictures share media resources and receive separate drawing occurrence identities.
The conversion bundle includes the MIT dependency fflate 0.8.3 for standard zlib decoding.

Known source picture refusals produce `picture-unprojected` under best-effort policy while preserving
adjacent text. Strict policy rejects them. Occurrence, per-picture and total decoded-byte budgets always
apply. Uncovered properties, borders, global drawing defaults and additional records carry explicit loss
diagnostics. DIB and OLE object paths need separate admission; ordinary floating pictures are covered below. Vector media bytes
survive DOCX/AST transport. Classic authoring and browser decoding currently verify PNG/JPEG, with
`picture-media-host-limit` for other formats.

The total byte budget also charges repeated picture references per occurrence to bound expansion
in AST data URLs and Worker transport.

Pinned POI originals verify bytes, dimensions and alternative text in actual packages and fresh AST
exports. LitDOCX retains fractional pixel dimensions and declared package MIME types. Independent
assertions and Classic lifecycle coverage are recorded in the [inline-picture scope](../../docs/changes/legacy-doc-import/inline-pictures.zh-CN.md).

## Ordinary floating picture conversion

Main-story and aggregate-header U+0008, final special-character attributes and the original FSPA/shape
jointly identify ordinary pictures. Original one-based media slots select the global BStore. Global
defaults and local scalars retain their precedence, while Boolean groups apply independent use bits.
The conversion retains original media, FSPA creation rectangles, independent axis references and
alignment or offsets, paint order, locks, overlap/cell layout, four distances, crop, rotation/flips,
aspect locks, names and alternative text without applying a new-picture preset.

None, square and top-and-bottom wrapping are native. Tight/through explicitly approximate to square
with `floating-picture-wrap-approximated`, because the image codec does not yet round-trip original
contours. Ordinary grouped pictures follow the complete-group contract above. OLE, unsupported group transforms, hidden/script roles, unsupported references and negative distances
refuse that picture with `floating-picture-unprojected`; other properties/records report separate losses.
Known source refusals are isolated only in best-effort mode. Budgets and unexpected errors still fail.

A complete four-byte ClientAnchor that remains zero on a later slot can recover through the actual
CP/FSPA association when that part has one unique shape/FSPA pairing. This reports compatibility
with `drawing-client-anchor-variant`. Nonzero conflicts, bad extents, repeated records and multiple
FSPA aliases still refuse the picture; see the [zero-anchor scope](../../docs/changes/legacy-doc-import/picture-anchor-compatibility.zh-CN.md).

Inline and floating pictures share `maxPictures`, decoded/reference byte limits, OfficeArt work and
complex-property budgets. Shared media and occurrence identities remain separate. Relationships are
registered only after complete geometry/XML validation, and unsuccessful Stories cannot leak resources.
All 98 independently anchored pictures across 45 fixed originals remain in the denominator;
the convertible independently observed subset additionally contains 144 group-owned picture leaves.
Forty originals convert and five retain source refusals, producing 68 floating pictures, including
one grouped PNG. Independent media/geometry/placement match 64; four with unavailable source
references remain separate. Both raw policies, JSON fresh packages and all 45 real Workers pass.
The 25 omitted independent anchors, 143 picture leaves refused with their whole groups, and 15 contour approximations remain
explicit, without establishing complete drawing or page fidelity. Admission locks each independently
proven original identity and media verification, so total counts cannot hide an old picture disappearing. Classic and backend observations are
recorded in the [floating-picture scope](../../docs/changes/legacy-doc-import/floating-drawings.zh-CN.md).

## Headers and footers

Conversion retains default/even/first headers and footers, section-local references, different-first-page
and document-wide odd/even switches. Source guard paragraphs are removed while authored empty
paragraphs survive. Absent section slots inherit the preceding same variant. Explicit blanks create
independent stories. Text, styles, tabs, ordinary tables, numbering and inline pictures reuse the existing
interpreters and support boundaries. Image relationships belong to the containing story part.

```ts
const source = inspectDoc(bytes, { includeHeaderFooters: true })
console.log(source.headerFooters?.evenAndOddHeaders, source.headerFooters?.stories)
// start/end use absolute DOC CPs. contentEnd excludes the independent guard CR.
```

`inspectDocInWorker` accepts the same flag. `maxHeaderFooterStories` defaults to 10,000 with a hard
ceiling of 100,000, counting empty slots and note separators. Paragraph, run, table, image and property
work budgets are shared across conversion stories.

Best-effort diagnoses malformed directories with `header-footer-directory-unprojected`. An unprojectable
story in a valid directory retains an explicit blank part and section reference, reporting
`header-footer-content-unprojected` to preserve inheritance semantics. Limits and unexpected errors
terminate the task. Empty stories ignore stale directories with `stale-header-directory`. Note separators, field recalculation dependencies and paragraph frames retain separate gaps.
All 69 source assertions and all story contents from eight POI originals pass, including the floating footer.
See the [expanded scope](../../docs/changes/legacy-doc-import/floating-table-position.zh-CN.md).

## Footnote and endnote content conversion

Automatic references and author content are connected to separate footnote/endnote parts, retaining
paragraphs, empty paragraphs, character formatting, lists and tables. Each family is read once and
paragraph, run, table and media budgets are shared across every story. Emitted main-body references
determine part membership. Unadmitted instruction references do not establish note entries.
Refused content retains an explicitly diagnosed blank note when its reference is valid. Budget exhaustion
terminates conversion.

The fixed 21-original cohort has 16 complete content matches, one partially covered document and
four source-format rejections. Twenty-five note bodies pass independent initial-package and preserved-part
round trips, including twenty-one bodies also checked with freshly generated note parts.
One embedded-object body remains reference-unverified and another is explicitly refused. Complete
Node/Worker parity passes. The original sixteen admitted documents pass Classic note editing, undo/redo
and reimport. Version-selected number formats, starts, restarts and placement are retained in OOXML,
including section overrides and explicit zero. Nondefault numbering/placement and section-end note
suppression report `note-settings-host-limit`. Native Classic layout still uses its default markers and
placement. Source separator stories report `note-separators-approximated`. Custom markers are separately refused. Note media can enter the initial
DOCX, while the LitAST writer retains an explicit refusal for regenerating edited relationship-owned note content.
Canvas/SVG verification covers actual references and footnote-table text painting, editing and reopening.
Arbitrary source presentation properties on references and self markers remain in the initial DOCX;
their LitAST/Classic regeneration needs further work.
Bounded font-name zero padding admits the additional original with a `font-name-zero-padding` diagnostic.
Classic explicitly rejects its four WMF images and substitutes labels. Vector rendering and preservation
remain separate work. The DOCX packager fixes ZIP entry dates at the 1980 UTC epoch while XML creation
and modification dates retain their field-owned serialization.
See the [conversion and page verification scope](../../docs/changes/legacy-doc-import/note-content.zh-CN.md)
and [font compatibility boundaries](../../docs/changes/legacy-doc-import/font-name-padding.zh-CN.md).

## Complete browser conversion

```ts
import { parseDocInWorker } from '@quirekit/lit-doc/conversion/browser'

const result = await parseDocInWorker(bytes, {
  runtimeModuleUrl: new URL('./docx-runtime.mjs', import.meta.url).href,
  lossPolicy: 'best-effort',
  signal: controller.signal,
})
```

The host builds `docx-runtime.mjs`, exporting `resolveDocxPackageSourcePlan`,
`materializeNewDocxPackagePlan` and `parseDocx`. The host selects this URL; document content never selects code.
`convertDocToDocxInWorker` returns package bytes; `parseDocInWorker` returns complete structured-clone LitAST
data, including Map and binary metadata. Reading, projection, ZIP materialization and AST parsing all run in
one dedicated Worker. Cancellation/deadlines terminate computation and release listeners/timers.
No files, fonts or office suite are acquired implicitly.

A bundler may statically assemble the Worker instead:

```ts
// legacy-doc.worker.ts
import * as runtime from '@quirekit/lit-docx'
import { installDocConversionWorker } from '@quirekit/lit-doc/conversion/worker-runtime'
import type { ConversionWorkerScope } from '@quirekit/lit-doc/conversion/worker-runtime'
installDocConversionWorker(globalThis as unknown as ConversionWorkerScope, runtime)
```

Inject that fresh dedicated Worker through `createWorker`. Per-call parse options must be serializable;
plugins/callbacks belong in the host's static assembly. Default adjacent ESM paths follow the inspection Worker rules.

## Optional main-story paragraph boundaries

```ts
const source = inspectDoc(bytes, { includeParagraphs: true })
console.log(source.paragraphs)
// [{ start: 0, end: 12, ending: 'paragraph' }, ...]
```

`inspectDocInWorker` accepts the same option. Each range includes its terminating
code unit. Empty paragraphs are retained; manual line breaks and page breaks
outside section endings stay inline. `ending` is `paragraph` (0x0D), `section`
(an actual section-ending 0x0C), or `cell-or-row` (0x07). A 0x0D may also terminate
a nested table cell/row; resolving those roles requires later property interpretation.
Only the main story is inspected; other stories retain their raw text ranges.

The ending marker selects its piece and paragraph-formatting record. Property
envelopes are validated, while style indexes and opaque property bytes stay
internal when only boundaries are requested. Effective formatting remains unresolved, reported through
`paragraph-formatting-unresolved`. Malformed records raise `invalid-paragraph-data`
when requested, without silently falling back to text. Without this option,
paragraph records need not be readable and the result has no `paragraphs` field.

## Optional paragraph base formatting

```ts
const source = inspectDoc(bytes, { includeParagraphFormatting: true })
console.log(source.paragraphs?.[0]?.baseFormat)
```

This option implicitly requests main-story paragraphs; the browser accepts the same
option. `baseFormat.scope` is `paragraph-base`. Defaults, inherited paragraph styles,
PAPX and the ending piece modifier produce these base settings, in that order:

- `styleIndex`, `alignment`, `leftIndent` / `rightIndent` with physical/logical basis,
  and signed `firstLineIndentTwips`.
- `outlineLevel`: zero through eight for outline levels, nine for body text, defaulting to nine;
  independent of list depth. Conversion preserves inherited and direct values separately
  without applying a heading appearance preset.
- `spacingBeforeTwips` / `spacingAfterTwips` and `lineSpacing: { value, multiple }`.
  Negative line values mean exact twips; nonnegative multiples use `value / 240`;
  other nonnegative values specify minimum twips.
- `keepLines`, `keepNext`, `pageBreakBefore`, `widowControl` and `bidi`, retaining
  explicit false and zero overrides.
- `autoSpaceLatin` / `autoSpaceNumber` independently control spacing between East Asian text
  and Latin letters or numbers. Both DOC normative defaults are true; inheritance and
  explicit false remain distinct, and malformed Bool8 operands are rejected.
- `tabs.stops` holds effective custom stops, `tabs.changes` holds the current style
  or direct layer's additions/clears, and `tabs.rangeDeletion` identifies source
  deletion ranges. Positions use signed twips, with at most 64 effective stops.
- `shading: { pattern, foreground, background } | null` retains original Ipat and RGB/auto
  identities. Null means no source layer supplies a value; 65535 explicitly clears shading.
  Complete RGB records supersede palette compatibility data within the same source layer.

Automatic spacing projects to standard `autoSpaceDE` / `autoSpaceDN` fields. Local omissions
inherit, while document defaults explicitly retain both DOC true values. Existing LitAST and
Classic support independent switches, complete history and fresh-package reopening. Canvas/SVG
retain the existing quarter-em geometric approximation; see the
[automatic-spacing acceptance](../../docs/changes/legacy-doc-import/auto-spacing.zh-CN.md).

Paragraph shading keeps named-style and direct writes separate and emits standard `shd`.
Original operands, native solid-paint semantics, raw/JSON, Workers and Classic content/fill/clear/
inheritance edits with complete history are covered by the
[shading acceptance](../../docs/changes/legacy-doc-import/paragraph-shading.zh-CN.md).
Unmapped patterns are explicitly lost without guessing another token; standard preserved patterns
carry a host-limit diagnostic while Classic paints only their background fill.

Conversion preserves local tab writes and named-style references. Range deletions
use current exact clear positions with an approximation diagnostic. Legacy style
PChgTabs records produce `legacy-style-tab-operation`. Classic native layout covers
positive start/center/end stops and common leaders. Positive DOP default intervals
are retained in document settings; LitAST and Classic ordinary text continue that
grid after the last explicit stop. Canonical setting edits, complete history and
fresh exports have [separate acceptance](../../docs/changes/legacy-doc-import/default-tab-interval.zh-CN.md).
Classic also merges style and direct tab layers by position, replaces matching
positions and consumes explicit clear instructions while retaining the separate
document grid and stored layers. See [inheritance acceptance](../../docs/changes/legacy-doc-import/tab-inheritance.zh-CN.md).
Clear instructions remain read-only in the product panel; other alignments,
negative positions and middle-dot leaders follow the recorded
[tab support boundaries](../../docs/changes/legacy-doc-import/paragraph-tabs.zh-CN.md).

These are derived inspection settings. List/table styles, character formatting,
auto/line-unit spacing, character-unit indentation, grid and neighboring paragraph
effects still require interpretation. Base values must not become final layout or
persistent LitAST direct properties. Ordinary unhandled operations appear in each
paragraph's `unsupportedOpcodes`; the result always reports
`paragraph-formatting-partial`. Persistent style/direct-property projection requires
separate acceptance.

Style cycles, invalid references and malformed records raise `invalid-formatting-data`.
Unsupported compound changes raise `unsupported-formatting`. Indirect HugePapx /
TableProps Data chains have cycle, depth and work budgets. Requested inspection
never falls back silently; default storage and boundary-only modes retain their
own admission conditions.

### Paragraph style replacement

PIstd replaces the modeled paragraph baseline in PAPX/ending-piece order, clearing superseded
direct fields, tab deltas and numbering provenance. Character inheritance and OOXML pStyle use the
same final style. Indexes 1–9 explicitly assign their outline level; table structure and review
state stay with independent source owners. Invalid targets, permutations and level increments
remain rejected.

`pnpm doc:paragraphs:styles` fixes three originals and 200 replacement paragraphs, independently
checking target style core fields and real source Workers. Native style identities match at 154
unambiguous anchors; 46 remain unbound. Two original PAPX identities are unavailable, while final
piece replacement bytes remain independently observed. o_kurs retains its explicit table-depth
conflict; the other two originals now convert through Majority and current table-revision values. Three complete normative DOC vectors separately pass both raw/JSON
fresh packages and Classic content/style editing, full history and reopening.

## Optional character base formatting

```ts
const source = inspectDoc(bytes, { includeCharacterFormatting: true })
console.log(source.characterRuns)
```

This implicitly requests main-story paragraphs and paragraph base settings.
`characterRuns` cover the main story in UTF-16 `[start,end)` ranges, including
terminating controls, intersected with paragraph, piece, CHPX and BTE boundaries.
`baseFormat.scope` is `character-base`. Settings include common glyph toggles,
size/font slots, language indexes, colors/highlight/underline, vertical alignment,
spacing, position and scaling. Automatic direction, complex-script size and font
selection remain automatic; font indexes and LCIDs are not yet names or BCP47
labels. Colors retain palette or COLORREF encoding.

Paragraph/character styles follow their source inheritance. Relative toggles use
a stable style snapshot. Ordered CIstd/CPlain operations reset settings while
preserving the specified highlight, direction and special state. Results always
report `character-formatting-partial`; ordinary unknown fields remain listed in
`unsupportedOpcodes`. Unsupported compound changes and inversion of unresolved
automatic complex-script properties fail explicitly. These settings are not persistent marks,
final font/layout values or a complete revision model.

### Legacy zero-size preservation

Ordinary producer CHps=0 is retained literally with `legacy-zero-font-size`; other out-of-range
sizes stay refused. Conversion preserves its original OOXML property with an explicit
`zero-font-size-unportable` loss and host limit, so strict conversion rejects it. It does not
create a canonical 0pt mark or expand Classic authoring, display or measurement support.
Isolated ordinary, complex and dual zero slots survive JSON and both raw/fresh-package paths.
Unrelated edits retain them; a supported ordinary author size replaces both slots under the existing
ownership policy, with an explicit complex size taking precedence.
`pnpm doc:characters:zero-size` verifies three originals, two original style zeros, 869 effective
zero UTF-16 units, fixed native LO packages, fresh output and real Workers. Seven Classic
content/format/supported-size editing, complete-history and reopening cases pass. Native Word's
zero-size effect remains unverified; preserving its markup does not establish zero-size rendering.

### Majority selective reset

CMajority compiles its comparison set from independent document defaults, then restores only
matching specified fields to the underlying paragraph style. Unmatched values and unlisted
fields remain unchanged. The noProof=true and East Asian Times New Roman exceptions are
handled separately. Restored inheritance removes obsolete direct/inverse-toggle provenance;
later operations retain their original order. Unresolved automatic font/size comparisons,
explicit text animation and unimplemented comparison properties remain explicit refusals.

`pnpm doc:characters:majority` independently checks rasp.doc's original terminal selector bytes,
prefix and paragraph baseline, plus bold, size, language and inheritance in actual DOCX and both
raw/JSON fresh-package paths. Four Classic content/format editing, full-history and fresh-package
cases pass across normative DOCs and this original. An independent native Word Majority effect
reference remains unavailable, so this does not admit full formatting or final layout fidelity.

### Legacy style script hints and highlighting

Script hints in style character UPX retain their original layer and report
`legacy-style-script-hint`. Paragraph-style highlights and explicit zero clears participate in
inheritance with `legacy-paragraph-style-highlight`. Character-style highlights are ignored under
mature Word import behavior, reporting `character-style-highlight-ignored` without clearing
underlying paragraph/direct highlighting. These UPX owners have separate contexts and caches;
unrelated illegal operations, truncation and invalid values still fail. Ignored operations consume
the shared budget. Existing CIstd/CPlain preservation and direct-layer ordering stay intact.

`pnpm doc:styles:characters` fixes nine originals: eight convert, while one retains its compound
section limitation. Actual fresh packages independently match 82 original style owners, fields,
identities and ancestry. Two upstream highlighter assertions, both raw/JSON package paths and all
nine real Workers pass. Three originals pass Classic editing, complete history and independently
reopened output. Canvas/SVG verify the real menu/Worker, inherited/cleared paint, actual selection,
direct highlighting, complete history and export/reimport. This excludes the original test's two
separate shading-background assertions.

### Missing final main-story character layer

When the original BTE and final FKP end exactly before the last main-story CR, an empty direct
character layer is admitted only with a complete prefix in the same piece and a zero Prm.
`terminal-character-format-absent` reports this bounded compatibility. The complete PAPX and
original paragraph style remain authoritative; preceding size, toggles, pictures or revision state
are never copied. Ordinary gaps, conflicting endpoints, nonzero piece modifiers, a separate final-CR
piece and auxiliary stories remain rejected. Shared run and work budgets stay enforced.

`pnpm doc:characters:terminal` fixes ten originals. Independent POI checks both physical ends and
paragraph-style core baselines; eight native Word 16.109.2 and two LibreOffice exports verify empty
direct terminal formatting. All ten actual conversions, both raw/JSON fresh packages, real Workers,
three Classic terminal edit/history/reopen cases and Canvas/SVG input/reimport checks pass. Native
versions, artifact paths and hashes are fixed in the catalog, with binaries in the external corpus.
This independent terminal evidence does not replace whole-file character-core confirmation;
unavailable complete source references remain explicitly separate.

### RTL inversion over an unset style flag

CFBiDi=0x81 over an unset style flag uses the established converter flag baseline of false,
producing explicit RTL=true and `implicit-rtl-style-inversion`. Absence and 0x80 retain automatic
direction. Automatic complex-script inversion, illegal style operations and work limits remain
enforced. Existing `direct-inverse-toggle-approximated` explains that explicit OOXML values cannot
retain the source inverse relationship when a parent style changes later.

`pnpm doc:characters:rtl` fixes four originals and 31 related source intervals, independently
checking the full source direction stream, actual packages, both raw/JSON fresh packages and real
Workers. Native LibreOffice exports confirm 565 text units and five empty paragraphs; ten nonempty
paragraph marks lack direct native confirmation. This is not complete bidi layout fidelity. Four
Classic direction edit/history/reopen cases pass. The embedded-WMF original still explicitly reports
unsupported media transport and emits its picture label; WMF preview/editing is not supported.
Canvas/SVG menu import, ordinary typing, paragraph-mark retention and fresh-package reopening pass.

## Optional field source indexes

```ts
const source = inspectDoc(bytes, {
  includeFields: true,
  limits: { maxFields: 10000, maxFieldDepth: 64 },
})
console.log(source.fields?.indexes)
```

`fields.scope` is `field-index-source`, covering all seven document parts. Tokens retain part-relative
CPs, the next CP, complete `rawCode`, the control decoded without its three reserved bits, and the
original payload byte. Entries use absolute CPs, exclusive ends, nullable separators and begin order.
Index depth excludes unindexed enclosing fields; derived topology never overwrites original end flags.
The final CP retains its ordering role and never extends source content.

This option loads neither paragraph nor character formatting and reports `field-formatting-unresolved`.
Seven original POI assertions and the real Worker pass. Ordinary conversion is described above;
evaluation dependencies retain separate acceptance. Invalid positions, duplicate CPs, broken pairing and truncation raise `invalid-field-data`.
Combined field counts default to 10000 with a hard ceiling of 100000; depth defaults to 64 with a hard
ceiling of 256. Both synchronous and Worker calls enforce these limits with `limit-exceeded`.

## Optional footnote and endnote source indexes

Use `inspectDoc(bytes, { includeNoteSettings: true })` to independently inspect numbering and placement
in `noteSettings`. It retains version-selected DOP fields, section format codes, restart/offset values
and explicit field presence. Combine it with `includeNotes` when both settings and indexes are needed.
Twenty of the fixed 21 originals match independent POI settings. One section directory extends beyond
the main story and is explicitly rejected. All Worker results match, and all ten assertions from the two
original extractor methods pass. OOXML and Classic implementation progress is tracked in the
[numbering and placement scope](../../docs/changes/legacy-doc-import/note-settings.zh-CN.md).

```ts
const source = inspectDoc(bytes, { includeNotes: true, limits: { maxNotes: 10000 } })
console.log(source.notes?.entries)
```

Entries retain family-local slots, main-story anchors, absolute UTF-16 content ranges, and automatic/custom
reference selectors. Each range includes its own paragraph ending. Both families share the note-count limit.
Undefined PLC endpoints are ignored. Duplicate or out-of-range references and automatic references missing
the U+0002 control raise a source error. Browser Workers accept the same option and return complete results.

Four original position assertions and a fixed 21-document cohort are verified. Twenty documents contain
35 independently matched notes. One document has seven invalid automatic anchors and is consistently rejected.
Source inspection reports `note-formatting-unresolved`. The conversion entry points independently process
complete content. See the [source scope](../../docs/changes/legacy-doc-import/note-source.zh-CN.md).

## Optional table topology

```ts
const source = inspectDoc(bytes, { includeTables: true })
console.log(source.tables) // Source tables ordered by level, then start.
```

This includes main-story paragraph inspection. Each row retains source `cells` and a separate
`markerStart`. Cell `blocks` reference paragraph or table indexes in source order, and nested
`parent` identifies its containing table, row and cell. Source CPs include cell terminators and
are not editor positions. Adjacent rows are grouped by style, PGP group, direction and complete positioning identity;
source definitions must match cell markers. A nested row bearing both ending flags remains a row.

This inspects membership. Merges, grids, dimensions, borders, style formatting and layout remain
`table-formatting-unresolved`. Word 97/2000 direct membership with no depth operation and no active
inner-table ending flags is interpreted as outer depth one, with `implicit-table-depth` reported.
Explicit zero and newer generations do not use this compatibility rule; see the
[scope](../../docs/changes/legacy-doc-import/implicit-table-depth.zh-CN.md).
Paragraph-frame-only or mixed-None positioning, protection/SDT ranges, unknown compound operations
and zero-depth tables outside that scope are rejected as `unsupported-table`; inconsistent membership
uses `invalid-table-data`. Default text-storage admission is unchanged.

## Page-border conversion and preservation

Ordinary line page borders retain all four section sides. New RGB BRCs override older palette BRCs
for the same side. Conversion retains automatic color, width, point spacing, shadow/frame flags,
applicable pages, paint order and page/text offsets without changing body margins. Source widths
below two use the specified two-eighth-point equivalent. Special style 5, art borders, widths above
this slice's 96 eighth-points and invalid records remain explicitly refused.

`LitSectionAttrs._pgBordersRaw` is an independent JSON-safe preservation envelope under both
`preserveRawXml` settings. Classic retains it through text/page edits, complete history, section
splits/merges and fresh DOCX export. `page-borders-host-limit` reports that **Canvas/SVG do not yet
render page borders or provide authoring controls**. Image/corner relationships, foreign namespaces
and nested page-border content are explicitly refused instead of emitting dangling resources.
Carrier-only empty sections still follow Classic's minimum editable-body rule.

`pnpm doc:sections:borders` checks five fixed POI/LibreOffice originals and six sections against
independent original SEPX observations, native LibreOffice DOCX, fresh packages, JSON and actual
Workers. It does not admit every paragraph/table/picture border or final page appearance.

## Legacy section outline records

OLST80 section records require the complete 212-byte payload and share one 32-code-unit text slot
across nine levels. Separate outline colors require nine COLORREFs in a 36-byte payload. Valid records
allow otherwise admitted content to continue under best-effort conversion, with explicit
`legacy-section-outline-unprojected` loss. **Old level definitions, prefix/suffix text, restart and
color settings have no native projection or binary preservation.** They do not create modern lists
or change text colors. Strict conversion still refuses unsupported semantics; expanded 248-byte
records, truncation and unknown neighboring operations remain refused.
`pnpm doc:sections:outlines` verifies three fixed originals through source observations, actual
packages, JSON and Workers. Recognizing this record boundary does not admit old numbering formats.

## Floating-table positioning

`tables[].identity.position` retains anchors, offsets or alignments, four text clearances and overlap.
Source offsets use the MS-DOC plus-one decoding. DOCX projection retains the stored integer to match
observed native Word output and reports `table-position-offset-compatibility`. Positioning survives
optional grid-geometry refusal.

Eight pinned originals pass actual DOCX, fresh AST generation and Classic editing, history and reopening,
including a footer table. Canvas and SVG check adjacent floating tables, movement after clearing alignment,
and hit testing. Complete wrapping, collision, pagination and nesting require separate admission. See the
[verified scope](../../docs/changes/legacy-doc-import/floating-table-position.zh-CN.md).

## Optional numbering source records

```ts
const source = inspectDoc(bytes, { includeNumbering: true })
console.log(source.numbering?.definitions, source.numbering?.instances)
console.log(source.paragraphs?.[0]?.numbering)
```

The same browser option includes paragraph boundaries and paragraph base inspection.
`numbering.scope` is `numbering-source`. It retains one/nine-level definitions, source identities
and style links, instances, overrides identified by their actual level, and exact UTF-16 templates
and placeholder offsets. Explicit zero starts remain zero. Inactive bullet/none starts are null
with their original values retained. Fixed record headers and opaque level properties are independent
byte copies; caller buffers remain unchanged.

Paragraph references use the same style, PAPX and ending-piece property traversal. `rawIndex` and
`rawLevel` retain source values; `instanceIndex` is normalized to one-based indexing. Level 12 skips
the paragraph. Removal and no-list references have null instance/level values; negative references
set `keepLogicalIndentation`.

This inspects source structure and references. Level properties are not executed, markers and final
indentation are not evaluated, and editor identities are not created. Results report
`numbering-formatting-unresolved`. Conversion separately follows the numbering projection contract above; this inspection scope is unchanged.
Malformed records, missing references, truncation and overlap raise `invalid-numbering-data`.
Repeated override levels outside the admitted scope raise `unsupported-numbering`. Omitting this
option leaves the existing inspection scopes unchanged.

Legacy `ANLD80` and its separate color operation receive bounded envelope/count validation and
remain listed as unprojected operations; they do not independently create a modern numbering graph.
Best-effort conversion continues with admitted text and media, while strict mode rejects the declared
loss. See the [legacy descriptor scope](../../docs/changes/legacy-doc-import/legacy-numbering-descriptor.zh-CN.md).

## Browser Worker

```ts
import { inspectDocInWorker } from '@quirekit/lit-doc/browser'

const controller = new AbortController()
const result = await inspectDocInWorker(new Uint8Array(await file.arrayBuffer()), {
  signal: controller.signal,
  timeoutMs: 20_000,
  limits: { maxInputBytes: 32 * 1024 * 1024 },
})
```

Each call owns a fresh module Worker and terminates it on success, error, abort or
timeout. Cancellation terminates computation. A private input copy is transferred.
The default worker URL works when the distributed ESM files remain beside each
other. Bundlers must preserve that layout or supply their own emitted worker URL;
for example, with Vite's `?worker` import:

```ts
import DocWorker from '@quirekit/lit-doc/worker?worker'

const result = await inspectDocInWorker(bytes, {
  createWorker: () => new DocWorker(),
})
```

The factory must return a **new, dedicated** Worker implementing this package's
protocol. The library owns its termination. Worker URLs must satisfy the host's
CSP. Node does not require or instantiate browser globals from the root entry.

## Admission and budgets

- CFB v3/v4, normal and mini streams, FAT/DIFAT chains and root stream identity.
- FIB versions `0x00c1`, `0x00d9`, `0x0101`, `0x010c`, `0x0112`; CLX pieces,
  compressed characters, UTF-16 units and seven source story intervals.
- The documented Word 97 aliases `0x00c0` / `0x00c2` use the same layout; a newer
  version still takes precedence, and `version` retains its actual value. Root
  label case variants produce `root-name-case-variant` without changing root identity.
- A known base version with its complete locator prefix may omit the version extension,
  producing `missing-fib-version-extension`. Additional counted fields are skipped by
  their actual lengths with `extended-fib-regions`. Unknown effective versions,
  incomplete prefixes, truncation and invalid stream extents are rejected.
- Complete counted styles beyond a short declared stylesheet length may be recovered
  within the next source-region boundary, with `extended-stylesheet-range`. The style
  header, every definition and its UPX payloads must remain complete.
- Encrypted DOC/OOXML, other file formats and malformed storage are rejected with
  `DocReadError.code`. ZIP is not treated as DOCX passthrough. Macros and embedded
  objects are not executed or interpreted. This is not a complete CFB validator.

| Limit | Default | Hard maximum |
| --- | --- | --- |
| Input bytes | 64 MiB | 256 MiB |
| Directory slots | 65,536 | 262,144 |
| UTF-16 units | 8 Mi | 32 Mi |
| Text pieces | 200,000 | 1,000,000 |
| Main-story paragraphs / section boundaries | 200,000 | 1,000,000 |
| Formatting index entries / pages (combined in character mode) | 16,384 | 65,536 |
| Main-story character ranges | 200,000 | 1,000,000 |
| Main-story tables | 10,000 | 100,000 |
| Displayed picture occurrences | 10,000 | 100,000 |
| Decoded bytes per picture | 16 MiB | 64 MiB |
| Total decoded picture bytes | 64 MiB | 256 MiB |
| Table nesting depth | 32 | 64 |
| Numbering definitions | 4,096 | 32,767 |
| Numbering instances | 4,096 | 65,536 |
| Numbering levels, including complete overrides | 65,536 | 262,144 |
| Total numbering template UTF-16 units | 1 Mi | 8 Mi |
| Property reads, expansion and applications | 1,000,000 | 4,000,000 |
| Style / indirect-property depth | 64 | 256 |
| Comment messages | 10,000 | 100,000 |
| Comment authors | 10,000 | 32,767 |
| Comment thread depth | 64 | 256 |
| Revision-author slots | 10,000 | 65,534 |
| Aggregate revision-author UTF-16 units | 1 Mi | 8 Mi |
| Worker time | 20 seconds | 120 seconds |

The synchronous API has no timeout; use the browser API off the UI thread and
host isolation for untrusted Node workloads. Limits bound structures, not exact
peak memory. Unsupported properties are not presented as complete formatting.

## Verification

Numbering source records have separate gates: `pnpm doc:producer:numbering:check` and
`pnpm doc:corpus:run --split all --label numbering-source-accepted --numbering --browser`.
The independent scope matches 378 inputs, including 142 with instances; 174 are controlled
rejections and six have unavailable references. All 558 have Node/Chromium parity. Admission
covers the declared source core fields, excluding unreferenced definitions, all reserved bits
and effective marker formatting. It does not upgrade DOCX or Classic numbering support.

From the repository: `pnpm --filter @quirekit/lit-doc test` runs synthetic format,
malformed-input and lifecycle regressions. After preparing the separate POI
reference and fetching pinned samples, `pnpm doc:reader:check` compares Node and
Chromium Worker results with independent POI facts. It keeps unsupported table
assertions visible. Fetch the expanded corpus with `pnpm doc:corpus:fetch`, then run
`pnpm doc:corpus:run --split all --label acceptance --browser`. Four pinned sources
provide 558 unique inputs, in fixed groups of 439 development and 119 holdout
samples. 411 agree with POI storage facts, 142 are controlled
rejections, and five have unavailable references. All Node and
Chromium outcomes agree; losing previously verified support fails the regression
gate. Rejection is not compatibility, and storage agreement does not establish
formatting, LitAST/DOCX or Classic support. The separate paragraph run,
`pnpm doc:corpus:run --split all --label paragraphs-acceptance --paragraphs --browser`,
has 402 matching main-story boundary results, 152 controlled rejections and four
reference failures. Its admission registry is independent of storage admission.
The separate `--formatting` scope has 393 matching base-field results, 159 controlled
rejections and six reference failures, with full Node/Chromium parity and its own
admission registry. Direction-basis tags use normative vectors and browser parity;
real producer coverage is not claimed. The separate `--characters` scope has
307 independently matching core-field streams, 188 controlled rejections and 63
reference failures, with full browser/Node parity. Character style/reset branches
that POI cannot reliably confirm use normative vectors and are excluded from
reference confirmation. A core-field digest is not complete character-effect or
producer acceptance. A separately authored Chinese Word for Mac 16.109.2 fixture passes author
assertions, POI core fields and browser validation; use `pnpm doc:producer:check`. Its native Save As
DOCX is an application reference, not acceptance of this converter. Windows Word/WPS, other versions
and complete semantic acceptance remain pending. See the
[corpus tooling](../../tooling/legacy-doc-reference/README.zh-CN.md) for the workflow.

Table scope uses `--tables`: 351 independently matched files (69 containing tables), 200 controlled
rejections and seven reference-unavailable outcomes, with full browser parity.
`pnpm doc:reader:check --tables` passes all ten original assertions across three files.
Row/cell CP agreement does not establish dimensions, merges or conversion support.

[中文说明](README.zh-CN.md)
Run `pnpm doc:conversion:check` for the separate conversion gate: independent POI XWPF checks actual
DOCX text, bold, source font names, page geometry and grid against native Word output, including an AST
export/reopen. Full browser tasks compare complete structured data, Map/binary metadata, actual
materializer/parser cancellation, deadlines, recovery and cleanup. Conversion producer evidence currently
covers only this one Mac Word fixture; it does not establish conversion or Classic support for the 558 source inputs.
That fixture separately verifies opt-in Classic file-menu import, editing/undo, Worker cleanup, DOCX download/reimport and independent XWPF checks of the actual download. See [Classic integration](../classic-docx/README.md). Windows Word/WPS, other versions and complete semantics remain open.

## Current values with table-property revisions

TWall and TPropRMark envelopes and flags are validated before interpreting current table properties
in full original order. Clearing both final flags removes that history state. Active prior snapshots,
authors and dates are not yet projected: `table-property-revision-unprojected` reports explicit loss
and strict conversion rejects it. Compound conditional styles such as TCnf remain outside this scope.

`pnpm doc:tables:revisions` checks ten original metadata paragraphs across two files. Independent
current geometry matches eight tables, 46 rows and 270 cells; another original retains an explicit
geometry-reference gap. Both raw/JSON paths, real Workers and three Classic current-width/content
editing, complete-history and fresh-package cases pass. This does not enable decisions on omitted
DOC property history.

Shared DOCX media encoding now limits transient allocations. A 10 MiB vector matches the independent
standard encoder under a 64 MiB heap, and the large original completes the existing 256 MiB corpus
round trip. These machine observations are not browser or mobile memory budgets.

## Invalid spacing in a disabled grid

When the final document grid is disabled, `best-effort` may omit source character spacing outside
the DOC specification, reporting `inactive-grid-character-spacing-omitted` loss with its section
and original value. Valid negative values, zero, endpoints and line pitch remain unchanged. Strict
conversion and every enabled-grid mode still reject invalid spacing, without clamping or wrapping.

`pnpm doc:sections:inactive-grid` checks two pinned upstream originals against independent POI
and native saves, all five 10pt PAGE-field targets, fresh JSON packages and real Workers. Native
saves overflow the spacing: they support disabled-mode and content observations only.

## Repeated frames in nested tables

`redundant-nested-table-frame` identifies an inner table whose complete row-frame tuples and first
paragraphs match its actual enclosing positioned row. The inner table stays in its original cell;
the outer position is never copied to it. Top-level, mixed, missing or unproved frame ownership
still rejects. `pnpm doc:tables:frames` checks two originals, independent geometry for four tables,
22 rows and 49 cells, native text, both raw/JSON paths and real Workers. Classic inner-cell/width
edits, complete history and both rendering backends' real file-menu round trips pass. Original
pagination and complete table styling remain separate verification scopes.
