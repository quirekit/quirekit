/** Selection geometry local to the document layer, in CSS pixels. */
export interface MdFloatingAnchor {
  /** Horizontal point the toolbar centers on. */ readonly center: number;
  /** Top edge of the selection's first measured line. */ readonly top: number;
  /** Bottom edge of the selection's last measured line. */ readonly bottom: number;
  /** Layer width; the toolbar stays inside it. */ readonly layerWidth: number;
  /** Lowest layer coordinate covered by sticky chrome or the scrollport's top edge. */ readonly clearTop: number;
}

/** Measured toolbar box, in CSS pixels. */
export interface MdFloatingSize {
  /** Toolbar width. */ readonly width: number;
  /** Toolbar height. */ readonly height: number;
}

/** Where the toolbar's top-left corner goes inside the document layer. */
export interface MdFloatingPlacement {
  /** Left edge from the layer origin. */ readonly left: number;
  /** Top edge from the layer origin. */ readonly top: number;
  /** Side of the selection the toolbar sits on. */ readonly side: "top" | "bottom";
}

/** Space between the selection and the toolbar. */
export const mdFloatingGap = 8;
/** Smallest distance kept from the layer's left and right edges. */
export const mdFloatingMargin = 8;

/**
 * Places the selection toolbar in layer coordinates, so the browser scrolls it with the document.
 * @param anchor - Layer-local selection geometry.
 * @param size - Measured toolbar box.
 * @returns Above the selection when that clears the top chrome, otherwise below it; clamped to the layer width.
 */
export function placeMdFloatingToolbar(anchor: MdFloatingAnchor, size: MdFloatingSize): MdFloatingPlacement {
  const limit = Math.max(mdFloatingMargin, anchor.layerWidth - size.width - mdFloatingMargin);
  const left = Math.min(limit, Math.max(mdFloatingMargin, anchor.center - size.width / 2));
  const above = anchor.top - mdFloatingGap - size.height;
  return above >= anchor.clearTop
    ? { left, top: above, side: "top" }
    : { left, top: anchor.bottom + mdFloatingGap, side: "bottom" };
}
