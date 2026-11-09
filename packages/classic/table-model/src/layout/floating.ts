import type {
  QuireTableFloatingHorizontalAlignment,
  QuireTableFloatingPlacement,
  QuireTableFloatingReference,
  QuireTableFloatingVerticalAlignment
} from "@quirekit/layout/table";

/**
 * Normalizes a Word floating-table attr into renderer-neutral placement data.
 *
 * @param value - Untrusted table-node floating attr.
 * @returns Normalized floating placement, or null when the attr is absent.
 */
export function normalizeQuireWordTableFloating(
  value: unknown
): QuireTableFloatingPlacement | null {
  if (value === null || typeof value !== "object") {
    return null;
  }

  const source = value as Readonly<Record<string, unknown>>;
  const verticalReference = readReference(
    source.verticalAnchor === undefined ? source.vertAnchor : source.verticalAnchor
  );

  return {
    horizontal: {
      reference: readReference(
        source.horizontalAnchor === undefined ? source.horzAnchor : source.horizontalAnchor
      ),
      offset: readTwipLength(source.x === undefined ? source.tblpX : source.x),
      alignment: readHorizontalAlignment(
        source.xSpec === undefined ? source.tblpXSpec : source.xSpec
      )
    },
    vertical: {
      reference: verticalReference,
      offset: readTwipLength(source.y === undefined ? source.tblpY : source.y),
      alignment: verticalReference === "text"
        ? null
        : readVerticalAlignment(source.ySpec === undefined ? source.tblpYSpec : source.ySpec)
    },
    clearances: {
      top: readTwipLength(source.topFromText) ?? 0,
      right: readTwipLength(source.rightFromText) ?? 0,
      bottom: readTwipLength(source.bottomFromText) ?? 0,
      left: readTwipLength(source.leftFromText) ?? 0
    },
    wrapMode: typeof source.wrap === "string" ? source.wrap : null,
    allowOverlap: source.overlap !== "never"
  };
}

/**
 * Reads a canonical floating-table reference, retaining the legacy model fallback.
 * Producer-specific omitted anchors are resolved at the OOXML import boundary.
 *
 * @param value - Candidate source reference.
 * @returns Canonical reference.
 */
function readReference(value: unknown): QuireTableFloatingReference {
  return value === "page" || value === "margin" || value === "text"
    ? value
    : "text";
}

/**
 * Converts a finite twip value to CSS pixels.
 *
 * @param value - Candidate source twip length.
 * @returns CSS-pixel length, or null when absent or invalid.
 */
function readTwipLength(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value)
    ? value / 15
    : null;
}

/**
 * Reads a canonical horizontal floating-table alignment.
 *
 * @param value - Candidate OOXML alignment token.
 * @returns Canonical alignment, or null when absent or unsupported.
 */
function readHorizontalAlignment(
  value: unknown
): QuireTableFloatingHorizontalAlignment | null {
  if (value === "left" || value === "start") return "start";
  if (value === "center") return "center";
  if (value === "right" || value === "end") return "end";
  if (value === "inside" || value === "outside") return value;
  return null;
}

/**
 * Reads a canonical vertical floating-table alignment.
 *
 * @param value - Candidate OOXML alignment token.
 * @returns Canonical alignment, or null when absent or unsupported.
 */
function readVerticalAlignment(
  value: unknown
): QuireTableFloatingVerticalAlignment | null {
  if (value === "top" || value === "start") return "start";
  if (value === "center") return "center";
  if (value === "bottom" || value === "end") return "end";
  if (value === "inside" || value === "outside") return value;
  return null;
}
