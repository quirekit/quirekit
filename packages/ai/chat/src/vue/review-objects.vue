<script setup lang="ts">
import { computed, onBeforeUnmount, shallowRef, watch } from "vue";
import { QuireButton, QuireImage, QuireImagePreview } from "@quirekit/ui/vue";
import type { QuireDocumentObjectChange } from "@quirekit/ai-runtime";
import type { AiChatImage } from "../types";

/** Image of one side of an object change. */
type Side = NonNullable<QuireDocumentObjectChange["before"]>;
/** Which image of an object change. */
type SideName = "before" | "after";

const props = defineProps<{
  /** Objects of one change whose image changed, was added or was removed. */
  readonly objects: readonly QuireDocumentObjectChange[];
  /** Product language. */
  readonly locale: "zh-CN" | "en";
  /** Host resolver lending displayable images. */
  readonly resolveImage: (source: unknown) => Promise<AiChatImage | null>;
}>();

const images = shallowRef(new Map<Side, AiChatImage>());
let generation = 0;

/** Every resolved image of the change, in reading order, so the preview moves between before and after. */
const items = computed(() => props.objects.flatMap((object, index) => (["before", "after"] as const).flatMap(side => {
  const image = object[side] === undefined ? undefined : images.value.get(object[side]!);
  return image === undefined ? [] : [{ id: `${index}:${side}`, src: image.url, alt: title(object, side), title: title(object, side), background: "#fff" }];
})));

/** Releases every lent image. */
function releaseAll(): void {
  for (const image of images.value.values()) image.release();
  images.value = new Map();
}

/**
 * Resolves the images of the current objects, dropping results of a superseded list.
 * @param objects - Objects to show.
 */
async function resolveAll(objects: readonly QuireDocumentObjectChange[]): Promise<void> {
  const current = ++generation;
  releaseAll();
  const sides = objects.flatMap(object => [object.before, object.after]).filter((side): side is Side => side !== undefined);
  await Promise.all(sides.map(async side => {
    const image = await props.resolveImage(side.source).catch(() => null);
    if (image === null) return;
    if (current !== generation) {
      image.release();
      return;
    }
    images.value = new Map(images.value).set(side, image);
  }));
}

watch(() => props.objects, objects => { void resolveAll(objects); }, { immediate: true });
onBeforeUnmount(() => {
  generation += 1;
  releaseAll();
});

/**
 * @param object - Object change.
 * @param side - Which image.
 * @returns Caption under the image.
 */
function caption(object: QuireDocumentObjectChange, side: SideName): string {
  const zh = props.locale === "zh-CN";
  if (object.kind === "inserted") return zh ? "新增" : "Added";
  if (object.kind === "removed") return zh ? "删除" : "Removed";
  return side === "before" ? (zh ? "修改前" : "Before") : (zh ? "修改后" : "After");
}

/**
 * @param object - Object change.
 * @param side - Which image.
 * @returns Name of the image in the preview.
 */
function title(object: QuireDocumentObjectChange, side: SideName): string {
  return `${object.label} · ${caption(object, side)}`;
}

/**
 * @param index - Object position in the change.
 * @param side - Which image.
 * @returns Position of the image in the preview, or -1 while it is unresolved.
 */
function itemIndex(index: number, side: SideName): number {
  return items.value.findIndex(item => item.id === `${index}:${side}`);
}
</script>

<template>
  <QuireImagePreview :items="items">
    <template #default="{ open }">
      <div class="qk-ai-review__objects">
        <div v-for="(object, index) in objects" :key="index" class="qk-ai-review__object" :data-kind="object.kind">
          <span v-if="objects.length > 1" class="qk-ai-review__where">{{ object.label }}</span>
          <div class="qk-ai-review__images">
            <template v-for="side in (['before', 'after'] as const)" :key="side">
              <span v-if="side === 'after' && object.before && object.after" class="qk-ai-review__arrow" aria-hidden="true">→</span>
              <figure v-if="object[side]" class="qk-ai-review__figure" :data-side="side">
                <QuireButton v-if="itemIndex(index, side) >= 0" variant="text" block class="qk-ai-review__thumb"
                  :aria-label="locale === 'zh-CN' ? `查看${title(object, side)}` : `View ${title(object, side)}`" @click="open(itemIndex(index, side))">
                  <QuireImage :src="items[itemIndex(index, side)]!.src" :alt="title(object, side)" width="100%" :height="120" fit="contain" loading="eager" />
                </QuireButton>
                <div v-else class="qk-ai-review__placeholder" />
                <figcaption class="qk-ai-review__caption">{{ caption(object, side) }}</figcaption>
              </figure>
            </template>
          </div>
        </div>
      </div>
    </template>
  </QuireImagePreview>
</template>
