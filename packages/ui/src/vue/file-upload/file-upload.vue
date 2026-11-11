<script setup lang="ts">
import { FileUpload } from "@ark-ui/vue/file-upload";
import type { FileUploadFileAcceptDetails, FileUploadFileChangeDetails, FileUploadFileRejectDetails } from "@ark-ui/vue/file-upload";
import { computed } from "vue";
import { useQuireKitLocale, useQuireKitMessages } from "../locale-provider/context";
import type { FileUploadProps as Props, FileUploadSlots as Slots, FileUploadEmits as Emits } from "./types";
import QuireIcon from "../icon/icon.vue";
import HiddenInput from "./hidden-input.vue";
import FileList from "./file-list.vue";

const props = withDefaults(defineProps<Props>(), {
  hint: undefined,
  accept: undefined,
  multiple: false,
  maxFiles: 5,
  maxFileSize: Infinity,
  minFileSize: 0,
  defaultFiles: () => [],
  allowDrop: true,
  clearable: true,
  disabled: false,
  readOnly: false,
  invalid: false,
  required: false,
  name: undefined,
  validate: undefined
});
const modelFiles = defineModel<File[] | undefined>();
const emit = defineEmits<Emits>();
defineSlots<Slots>();
let acceptedInCurrentBatch: File[] | undefined;

const effectiveMaxFiles = computed(() => props.multiple ? Math.max(1, props.maxFiles) : 1);
const optionalRootProps = computed(() => ({
  ...(modelFiles.value === undefined
    ? { defaultAcceptedFiles: props.defaultFiles }
    : { acceptedFiles: modelFiles.value }),
  ...(props.accept === undefined ? {} : { accept: props.accept }),
  ...(props.name === undefined ? {} : { name: props.name }),
  ...(props.validate === undefined ? {} : { validate: props.validate })
}));
const text = useQuireKitMessages("fileUpload");
const locale = useQuireKitLocale();
const description = computed(() => props.description ?? text.value.dropzone);
const generatedHint = computed(() => props.hint ?? text.value.hint({
  multiple: props.multiple, maxFiles: effectiveMaxFiles.value,
  ...(Number.isFinite(props.maxFileSize) ? { maxFileSize: formatBytes(props.maxFileSize) } : {})
}));

/**
 * 将字节数格式化为适合约束说明的短文本。
 *
 * @param bytes - 原始字节数。
 * @returns 带单位的文件大小。
 */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${Math.round(bytes / 1024)} KB`;
  return `${Number((bytes / 1024 ** 2).toFixed(1))} MB`;
}

/**
 * 保留同轮接受结果，避免拒绝反馈清除时的旧受控值覆盖新文件。
 *
 * @param details - Ark 文件状态详情。
 */
function handleFileChange(details: FileUploadFileChangeDetails): void {
  emit("fileChange", acceptedInCurrentBatch === undefined
    ? details
    : { ...details, acceptedFiles: acceptedInCurrentBatch });
}

/**
 * 从接受集合的变化同步模型，并转发通过校验的文件集合。
 *
 * @param details - Ark 接受详情。
 */
function handleFileAccept(details: FileUploadFileAcceptDetails): void {
  acceptedInCurrentBatch = details.files;
  modelFiles.value = details.files;
  // Rejection changes share this batch; later operations read the current host value.
  queueMicrotask(() => { acceptedInCurrentBatch = undefined; });
  emit("fileAccept", details);
}

/**
 * 转发一次未通过校验的文件集合。
 *
 * @param details - Ark 拒绝详情。
 */
function handleFileReject(details: FileUploadFileRejectDetails): void {
  emit("fileReject", details);
}
</script>

<template>
  <FileUpload.Root
    v-bind="optionalRootProps"
    :class="['qk-file-upload', { 'qk-file-upload--invalid': invalid }]"
    :max-files="effectiveMaxFiles"
    :max-file-size="maxFileSize"
    :min-file-size="minFileSize"
    :allow-drop="allowDrop"
    :disabled="disabled"
    :read-only="readOnly"
    :invalid="invalid"
    :required="required"
    :locale="locale"
    :translations="{
      dropzone: description,
      itemPreview: (file: File) => text.preview(file.name),
      deleteFile: (file: File) => text.remove(file.name)
    }"
    @file-change="handleFileChange"
    @file-accept="handleFileAccept"
    @file-reject="handleFileReject"
  >
    <FileUpload.Context v-slot="fileUpload">
      <FileUpload.Label :class="$slots.default ? 'sr-only' : 'qk-file-upload__label'">
        {{ label }}<span v-if="required" class="qk-file-upload__required" aria-hidden="true">*</span>
      </FileUpload.Label>

      <slot :accepted-files="fileUpload.acceptedFiles" :rejected-files="fileUpload.rejectedFiles"
        :disabled="fileUpload.disabled || fileUpload.readOnly"
        :open-file-picker="() => { if (!fileUpload.disabled && !fileUpload.readOnly) fileUpload.openFilePicker(); }"
        :add-transfer-files="(transfer: DataTransfer) => fileUpload.setClipboardFiles(transfer)">
      <FileUpload.Dropzone class="qk-file-upload__dropzone">
        <slot
          name="dropzone"
          :dragging="fileUpload.dragging"
          :max-files-reached="fileUpload.maxFilesReached"
          :remaining-files="fileUpload.remainingFiles"
        >
          <span class="qk-file-upload__dropzone-icon" aria-hidden="true">
            <QuireIcon name="upload" :size="20" />
          </span>
          <strong class="qk-file-upload__description">{{ description }}</strong>
          <span class="qk-file-upload__hint">{{ generatedHint }}</span>
        </slot>
      </FileUpload.Dropzone>

      <div class="qk-file-upload__actions">
        <FileUpload.Trigger class="qk-file-upload__trigger">
          <QuireIcon name="upload" :size="16" />
          {{ text.choose }}
        </FileUpload.Trigger>
        <FileUpload.ClearTrigger
          v-if="clearable && fileUpload.acceptedFiles.length > 0"
          class="qk-file-upload__clear"
        >
          {{ text.clearAll }}
        </FileUpload.ClearTrigger>
        <span class="qk-file-upload__count" aria-live="polite">
          {{ text.selected(fileUpload.acceptedFiles.length, effectiveMaxFiles) }}
        </span>
      </div>

      <FileList v-if="fileUpload.acceptedFiles.length || fileUpload.rejectedFiles.length || $slots.empty">
        <template v-if="$slots.item" #item="scope"><slot name="item" v-bind="scope" /></template>
        <template v-if="$slots.rejection" #rejection="scope"><slot name="rejection" v-bind="scope" /></template>
        <template v-if="$slots.empty" #empty><slot name="empty" /></template>
      </FileList>
      </slot>
    </FileUpload.Context>
    <HiddenInput />
  </FileUpload.Root>
</template>
