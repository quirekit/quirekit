import { matchesQuireRegionOccurrence } from "../../../layout/owner-facts/region";
import { cloneQuireTextFragmentWithLazyCaretStops } from "@quirekit/layout/text";
import {
  projectQuireLayoutBoxViewProductsToPage
} from "../../../layout/engine/pagination/projection/split-box/visual-instance";
import {
  projectQuireSubLayoutProjectionVisualInstance
} from "../../../layout/engine/pagination/projection/sub-layout-visual-instance";
import type { QuireLayoutBox } from "../../../layout/engine/types";
import type {
  QuireLayoutBoxSubLayoutFragment
} from "../../../layout/engine/sub-layout";
import { identifyQuireStoryTableOccurrence } from "./table-identity";

/**
 * Reidentifies a repeated story layout and all nested paint geometry.
 *
 * @param box - Layout box belonging to a repeated source tree.
 * @param suffix - Visual-instance suffix appended to snapshot-local ids.
 * @param pageIndex - Zero-based physical page that owns the occurrence.
 * @returns The same layout shape with occurrence ids and unchanged logical ownership.
 */
export function identifyQuireStoryLayoutOccurrence<Layout extends QuireLayoutBox>(
  box: Layout,
  suffix: string,
  pageIndex: number
): Layout {
  const viewProducts = projectNestedBoxViewProducts(
    box,
    suffix,
    pageIndex
  );
  const textFragments = box.textFragments?.map((fragment) =>
    cloneQuireTextFragmentWithLazyCaretStops({
      source: fragment,
      id: `${fragment.id}:${suffix}`,
      range: fragment.range,
      rect: fragment.rect,
      baseline: fragment.baseline
    })
  );
  const nodeHandle = box.nodeHandle === undefined
    ? undefined
    : { ...box.nodeHandle, id: `${box.nodeHandle.id}:${suffix}` };
  const subLayoutFragments = box.subLayoutFragments?.map((fragment) =>
    identifySubLayoutFragment(fragment, suffix)
  );
  const children = "children" in box && Array.isArray(box.children)
    ? box.children.map((child) => identifyQuireStoryLayoutOccurrence(child, suffix, pageIndex))
    : undefined;

  return {
    ...box,
    ...viewProducts,
    id: `${box.id}:${suffix}`,
    ...(box.table === undefined ? {} : { table: identifyQuireStoryTableOccurrence(box.table, suffix) }),
    ...(textFragments === undefined ? {} : { textFragments }),
    ...(nodeHandle === undefined ? {} : { nodeHandle }),
    ...(subLayoutFragments === undefined ? {} : { subLayoutFragments }),
    ...(children === undefined ? {} : { children })
  };
}

/**
 * Scopes one retained child-flow result to a repeated story occurrence.
 *
 * @param fragment - Translated child-flow fragment owned by a nested provider.
 * @param occurrenceId - Stable page-local story occurrence id.
 * @returns Fragment whose retained primary region is snapshot-unique.
 */
function identifySubLayoutFragment(
  fragment: QuireLayoutBoxSubLayoutFragment,
  occurrenceId: string
): QuireLayoutBoxSubLayoutFragment {
  const projection = fragment.subLayout;
  const scopedResultId = `${occurrenceId}:${projection.geometry.id}`;
  const scopedProjection = {
    ...projection,
    geometry: {
      ...projection.geometry,
      id: scopedResultId
    },
    view: {
      ...projection.view,
      resultId: scopedResultId
    }
  };

  return {
    ...fragment,
    subLayout: projectQuireSubLayoutProjectionVisualInstance(scopedProjection)
  };
}

/**
 * Projects one nested story box into the enclosing repeated occurrence.
 *
 * The story root is already projected by its placement authority. Nested
 * providers, such as Word tables, retain independent regions that also need
 * page-local identity while preserving their exact installed visual geometry.
 *
 * @param box - Translated layout box inside the repeated story.
 * @param occurrenceId - Stable page-local story occurrence id.
 * @param pageIndex - Zero-based physical page that owns the occurrence.
 * @returns Page-local view products, or an empty object when none are needed.
 */
function projectNestedBoxViewProducts(
  box: QuireLayoutBox,
  occurrenceId: string,
  pageIndex: number
): Pick<QuireLayoutBox, "viewRegion" | "regionProducts" | "layoutOwner"> {
  const sourceRegion = box.viewRegion;
  if (
    sourceRegion === undefined
    || sourceRegion.visualInstanceId === occurrenceId
  ) {
    return {};
  }

  const visualInstanceId = sourceRegion.visualInstanceId === undefined
    ? occurrenceId
    : `${occurrenceId}:${sourceRegion.visualInstanceId}`;
  const installedRect = box.regionProducts?.regions.find((region) =>
    matchesQuireRegionOccurrence(region.ref, sourceRegion)
  )?.rect ?? box.rect;

  return projectQuireLayoutBoxViewProductsToPage(
    box,
    pageIndex,
    installedRect,
    visualInstanceId
  );
}
