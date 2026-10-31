<script setup lang="ts">
import { defaultTheme, quireIconRegistry } from "@quirekit/ui";
import type { QuireKitFormSlotProps, QuireKitFormValues } from "@quirekit/ui/vue";
import {
  QuireButton, QuireDialogRoot, QuireDialogContent, QuireField,
  QuireForm, QuireIconProvider, QuireInput, QuireInputNumber,
  QuireRadioGroup, QuireSelect, QuireThemeProvider
} from "@quirekit/ui/vue";
import { computed, ref, useId, watch } from "vue";
import {
  createQuireAiProfileFromPreset,
  quireAiProviderPresets,
  findQuireAiProviderPreset
} from "./presets";
import type {
  QuireAiProviderSettingsDraft
} from "./types";
import { validateQuireAiProviderSettings } from "./validate";

const props = defineProps<{
  /** Shared modal visibility owned by the application controller. */
  readonly state: { readonly open: boolean; readonly busy?: boolean; readonly error?: string };
  /** Settings loaded when the page bootstrapped. */
  readonly initialDraft: QuireAiProviderSettingsDraft;
  /** Host-owned configuration, limited to managed profiles or disconnected mode: a team's models or one person's own. */
  readonly managed?: "team" | "personal" | undefined;
}>();

const emit = defineEmits<{
  /** Requests closing without changing configuration. */
  close: [];
  /** Saves one locally validated provider catalog. */
  save: [draft: QuireAiProviderSettingsDraft];
  /** Clears all persisted provider configuration and credentials. */
  clear: [];
}>();

const form = ref<QuireKitFormSlotProps>();
const formId = `qk-ai-provider-form-${useId()}`;
const draft = computed(() => (form.value?.values ?? props.initialDraft) as unknown as QuireAiProviderSettingsDraft);
const selectedProfileId = ref(draft.value.defaultProfileId);
const selectedPresetId = ref("deepseek");
const revealApiKey = ref(false);
const presetOptions = quireAiProviderPresets.map(preset => ({
  label: preset.label,
  value: preset.id
}));
const protocolOptions = [
  { label: "Pi OpenAI Completions", value: "openai-completions" },
  { label: "OpenAI Responses", value: "openai-responses" },
  { label: "Anthropic Messages", value: "anthropic-messages" }
];
const authenticationOptions = [
  { label: "Authorization: Bearer", value: "bearer" },
  { label: "x-api-key", value: "x-api-key" },
  { label: "api-key", value: "api-key" }
];
const thinkingLevelOptions = [
  { label: "Pi high", value: "high" },
  { label: "Pi max", value: "max" },
  { label: "Pi off", value: "off" }
];
/** Wording of a host-owned configuration. */
const MANAGED = {
  team: { title: "团队 AI 模型", description: "由管理员统一配置，成员无需设置。", models: "统一配置团队使用的模型", off: "暂停团队 AI 功能", key: "由服务端保存；保留掩码表示沿用已存密钥，清空表示不使用密钥。" },
  personal: { title: "个人 AI 模型", description: "为本机配置模型，密钥保存在系统钥匙串。", models: "配置自己使用的模型", off: "暂不使用 AI", key: "保存在系统钥匙串；保留掩码表示沿用已存密钥，清空表示不使用密钥。" }
} as const;
const managedText = computed(() => props.managed ? MANAGED[props.managed] : undefined);
const modeOptions = computed(() => managedText.value ? [
  { value: "browser", label: "模型服务", description: managedText.value.models },
  { value: "local", label: "暂不启用", description: managedText.value.off }
] : [
  { value: "browser", label: "浏览器直连", description: "配置多个 Provider 与模型" },
  { value: "host", label: "Host 代理", description: "由服务端管理密钥与出站策略" },
  { value: "local", label: "暂不连接", description: "配置连接后才能使用 AI" }
]);
const activeProfile = computed(() => draft.value.profiles.find(
  profile => profile.id === selectedProfileId.value
));

watch(() => props.state.open, (open) => {
  if (!open) return;
  selectedProfileId.value = props.initialDraft.defaultProfileId;
  revealApiKey.value = false;
});

/** @param values - Public Form draft to validate before persistence. */
function submit(values: QuireKitFormValues): void {
  const source = values as unknown as QuireAiProviderSettingsDraft;
  emit("save", validateQuireAiProviderSettings({
    ...source,
    profiles: source.profiles.map(profile => ({
      ...profile,
      contextWindowTokens: Number(profile.contextWindowTokens),
      contextBudgetPercent: Number(profile.contextBudgetPercent),
      maxOutputTokens: Number(profile.maxOutputTokens)
    }))
  }));
}

/** @param field - Active model field. @param value - Editable value, including transient numeric text. */
function setProfileField(field: string, value: unknown): void {
  const index = draft.value.profiles.findIndex(profile => profile.id === selectedProfileId.value);
  if (index >= 0) form.value?.setFieldValue(`profiles[${index}].${field}`, value);
}

/** @param open - Requested public dialog visibility. */
function updateOpen(open: boolean): void { if (!open) emit("close"); }

/** Adds one new model profile from the selected official preset. */
function addPresetProfile(): void {
  const preset = findQuireAiProviderPreset(selectedPresetId.value);
  if (preset === undefined) return;
  const id = createUniqueProfileId(preset.id);
  form.value?.setFieldValue("profiles", [...draft.value.profiles, createQuireAiProfileFromPreset(preset, id)]);
  selectedProfileId.value = id;
  revealApiKey.value = false;
}

/** Adds one fully editable custom Chat Completions profile. */
function addCustomProfile(): void {
  const id = createUniqueProfileId("custom");
  form.value?.setFieldValue("profiles", [...draft.value.profiles, {
    id,
    protocol: "openai-completions",
    baseUrl: "https://api.example.com/v1",
    authScheme: "bearer",
    apiKey: "",
    model: "model-id",
    providerLabel: "Custom",
    maxOutputTokens: 32_768,
    contextWindowTokens: 128_000,
    contextBudgetPercent: 70,
    thinkingLevel: "off"
  }]);
  selectedProfileId.value = id;
  revealApiKey.value = false;
}

/** Removes the selected profile while preserving at least one model. */
function removeActiveProfile(): void {
  if (draft.value.profiles.length <= 1) return;
  const index = draft.value.profiles.findIndex(
    profile => profile.id === selectedProfileId.value
  );
  if (index < 0) return;
  const profiles = [...draft.value.profiles];
  const [removed] = profiles.splice(index, 1);
  form.value?.setFieldValue("profiles", profiles);
  const fallback = draft.value.profiles[Math.min(index, draft.value.profiles.length - 1)];
  if (fallback === undefined) return;
  selectedProfileId.value = fallback.id;
  if (removed?.id === draft.value.defaultProfileId) {
    form.value?.setFieldValue("defaultProfileId", fallback.id);
  }
  revealApiKey.value = false;
}

/**
 * Selects one profile for editing.
 *
 * @param id - Stable profile identity.
 */
function selectProfile(id: string): void {
  selectedProfileId.value = id;
  revealApiKey.value = false;
}

/** @param value - Selected model identity to use as the default. */
function setActiveProfileAsDefault(value: string | null | undefined): void {
  if (value && activeProfile.value !== undefined) {
    form.value?.setFieldValue("defaultProfileId", activeProfile.value.id);
  }
}

/**
 * Creates a collision-free profile id.
 *
 * @param stem - Human-readable preset stem.
 * @returns Stable id unique inside the current draft.
 */
function createUniqueProfileId(stem: string): string {
  let suffix = 1;
  let id = `profile-${stem}`;
  const ids = new Set(draft.value.profiles.map(profile => profile.id));
  while (ids.has(id)) {
    suffix += 1;
    id = `profile-${stem}-${suffix}`;
  }
  return id;
}

/**
 * Creates a mutable deep clone for the modal's draft lifecycle.
 *
 * @param source - Immutable stored settings.
 * @returns Mutable modal draft.
 */
function cloneDraft(source: QuireAiProviderSettingsDraft): QuireAiProviderSettingsDraft {
  return {
    mode: source.mode,
    profiles: source.profiles.map(profile => ({ ...profile })),
    defaultProfileId: source.defaultProfileId,
    hostUrl: source.hostUrl
  };
}
</script>

<template>
  <QuireThemeProvider :theme="defaultTheme">
    <QuireIconProvider :registry="quireIconRegistry">
      <QuireDialogRoot :open="state.open" @update:open="updateOpen">
        <QuireDialogContent :title="managedText?.title ?? 'AI Provider 与模型'" :description="managedText?.description ?? '为每个模型配置连接、密钥与上下文。'" size="large" class="qk-ai-provider-settings" data-ai-provider-settings-dialog="true">
          <p v-if="state.error" role="alert">{{ state.error }}</p>
          <QuireForm v-if="state.open" :id="formId" ref="form" :initial-values="{ ...cloneDraft(initialDraft) }" :on-submit="submit" class="qk-ai-provider-settings__form">
            <QuireRadioGroup :model-value="draft.mode" :items="modeOptions" label="连接方式" orientation="horizontal" @update:model-value="$event && form?.setFieldValue('mode', $event)" />

        <div v-if="draft.mode === 'browser'" class="qk-ai-provider-settings__catalog">
          <aside>
            <div class="qk-ai-provider-settings__preset-add">
              <QuireSelect
                :model-value="selectedPresetId" @update:model-value="$event && (selectedPresetId = $event)"
                class="qk-ai-provider-settings__preset-select"
                label="Provider 预设"
                data-ai-provider-preset="true"
                :items="presetOptions"
                :portalled="true"
              />
              <QuireButton type="button" color="primary" variant="soft" @click="addPresetProfile">
                添加预设
              </QuireButton>
            </div>
            <QuireButton
              type="button"
              class="qk-ai-provider-settings__custom"
              block
              variant="outline"
              @click="addCustomProfile"
            >
              ＋ 自定义模型
            </QuireButton>
            <ol>
              <li v-for="profile in draft.profiles" :key="profile.id">
                <QuireButton
                  type="button"
                  class="qk-ai-provider-settings__profile"
                  :aria-pressed="profile.id === selectedProfileId"
                  :variant="profile.id === selectedProfileId ? 'soft' : 'ghost'"
                  block
                  @click="selectProfile(profile.id)"
                >
                  <span><strong>{{ profile.model }}</strong><small>{{ profile.providerLabel }} · {{ profile.protocol }}</small></span>
                  <template v-if="profile.id === draft.defaultProfileId" #trailing><em>默认</em></template>
                </QuireButton>
              </li>
            </ol>
          </aside>

          <div v-if="activeProfile" class="qk-ai-provider-settings__fields">
            <div class="qk-ai-provider-settings__profile-heading">
              <QuireRadioGroup :model-value="draft.defaultProfileId" :items="[{ value: activeProfile.id, label: '设为聊天默认模型' }]" label="默认模型" hide-label @update:model-value="setActiveProfileAsDefault" />
              <QuireButton
                type="button"
                color="danger"
                variant="ghost"
                :disabled="draft.profiles.length <= 1"
                @click="removeActiveProfile"
              >
                删除模型
              </QuireButton>
            </div>

            <div class="qk-ai-provider-settings__row">
              <QuireField v-slot="{ controlProps }" label="Provider 名称" width="100%">
                <QuireInput v-bind="controlProps" width="100%"
                  :model-value="activeProfile.providerLabel" @update:model-value="setProfileField('providerLabel', $event)"
                  aria-label="Provider 名称"
                  data-ai-provider-label="true"
                  spellcheck="false"
                />
              </QuireField>
              <QuireField v-slot="{ controlProps }" label="模型 ID" width="100%">
                <QuireInput v-bind="controlProps" width="100%"
                  :model-value="activeProfile.model" @update:model-value="setProfileField('model', $event)"
                  aria-label="模型 ID"
                  data-ai-provider-model="true"
                  spellcheck="false"
                />
              </QuireField>
            </div>

            <div class="qk-ai-provider-settings__row">
              <QuireField v-slot="{ controlProps }" label="标准 API 协议" width="100%">
                <QuireSelect v-bind="controlProps" width="100%"
                  :model-value="activeProfile.protocol" @update:model-value="setProfileField('protocol', $event)"
                  label="标准 API 协议"
                  data-ai-provider-protocol="true"
                  :items="protocolOptions"
                  :portalled="true"
                />
              </QuireField>
              <QuireField v-slot="{ controlProps }" label="API Key 鉴权" width="100%">
                <QuireSelect v-bind="controlProps" width="100%"
                  :model-value="activeProfile.authScheme" @update:model-value="setProfileField('authScheme', $event)"
                  label="API Key 鉴权"
                  data-ai-provider-auth-scheme="true"
                  :items="authenticationOptions"
                  :portalled="true"
                />
              </QuireField>
            </div>

            <QuireField v-slot="{ controlProps }" label="API Base URL" width="100%">
              <QuireInput v-bind="controlProps" width="100%"
                :model-value="activeProfile.baseUrl" @update:model-value="setProfileField('baseUrl', $event)"
                aria-label="API Base URL"
                data-ai-provider-base-url="true"
                spellcheck="false"
              />
            </QuireField>

            <QuireField v-slot="{ controlProps }" label="API Key" :description="managedText?.key ?? '保存在当前浏览器；本地无鉴权模型可留空。'" width="100%">
              <QuireInput v-bind="controlProps" width="100%"
                  :model-value="activeProfile.apiKey" @update:model-value="setProfileField('apiKey', $event)"
                  aria-label="API Key"
                  data-ai-provider-api-key="true"
                  type="password" v-model:visible="revealApiKey"
                  autocomplete="off"
                  spellcheck="false"
                  placeholder="sk-…"
              />
            </QuireField>

            <div class="qk-ai-provider-settings__row qk-ai-provider-settings__tokens">
              <QuireField v-slot="{ controlProps }" label="上下文窗口 Token" width="100%">
                <QuireInputNumber label="数值" v-bind="controlProps" width="100%"
                  :model-value="String(activeProfile.contextWindowTokens)" @update:model-value="setProfileField('contextWindowTokens', $event)"
                  aria-label="上下文窗口 Token"
                  data-ai-provider-context-window="true"
                  :min="8192"
                  :max="2000000"
                  :step="8192"

                />
              </QuireField>
              <QuireField v-slot="{ controlProps }" label="单轮最大输出" width="100%">
                <QuireInputNumber label="数值" v-bind="controlProps" width="100%"
                  :model-value="String(activeProfile.maxOutputTokens)" @update:model-value="setProfileField('maxOutputTokens', $event)"
                  aria-label="单轮最大输出"
                  data-ai-provider-max-output-tokens="true"
                  :min="1024"
                  :max="262144"
                  :step="1024"

                />
              </QuireField>
            </div>
            <p class="qk-ai-provider-settings__budget">对话历史和压缩由原生会话管理，切换模型会保留当前对话。</p>

            <QuireField v-slot="{ controlProps }" label="Pi Thinking" width="100%">
              <QuireSelect v-bind="controlProps" width="100%"
                :model-value="activeProfile.thinkingLevel" @update:model-value="setProfileField('thinkingLevel', $event)"
                label="Pi Thinking"
                data-ai-provider-thinking-level="true"
                :items="thinkingLevelOptions"
                :portalled="true"
              />
            </QuireField>

          </div>
        </div>

        <div v-else-if="draft.mode === 'host'" class="qk-ai-provider-settings__fields">
          <QuireField v-slot="{ controlProps }" label="QuireKit AI Host URL" width="100%">
            <QuireInput v-bind="controlProps" width="100%"
              :model-value="draft.hostUrl" @update:model-value="form?.setFieldValue('hostUrl', $event)"
              aria-label="QuireKit AI Host URL"
              data-ai-provider-host-url="true"
              spellcheck="false"
              placeholder="http://127.0.0.1:4789"
            />
          </QuireField>
          <p>Host 可返回多个模型 profile；聊天框继续使用同一模型选择器。</p>
        </div>



          </QuireForm>
          <template #footer>
        <footer>
          <QuireButton type="button" color="danger" variant="ghost" :disabled="!!state.busy" @click="emit('clear')">清除配置</QuireButton>
          <span />
          <QuireButton type="button" :disabled="!!state.busy" @click="emit('close')">取消</QuireButton>
          <QuireButton type="submit" :form="formId" color="primary" variant="solid" :busy="!!state.busy" data-ai-provider-settings-save="true">
            保存并重新连接
          </QuireButton>
        </footer>
          </template>
        </QuireDialogContent>
      </QuireDialogRoot>
    </QuireIconProvider>
  </QuireThemeProvider>
</template>

<style scoped>
.qk-ai-provider-settings__form, .qk-ai-provider-settings__fields { display: grid; gap: var(--qk-space-group); }
.qk-ai-provider-settings__catalog { display: grid; grid-template-columns: 240px minmax(0, 1fr); gap: var(--qk-space-surface); align-items: start; }
.qk-ai-provider-settings__catalog aside { min-width: 0; }
.qk-ai-provider-settings__preset-add, .qk-ai-provider-settings__profile-heading, footer { display: flex; align-items: center; gap: var(--qk-space-inline); }
.qk-ai-provider-settings__preset-select { flex: 1; min-width: 0; }
.qk-ai-provider-settings__custom { margin-top: var(--qk-space-inline); }
.qk-ai-provider-settings__profile-heading { justify-content: space-between; }
.qk-ai-provider-settings__row { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--qk-space-surface-compact); }
.qk-ai-provider-settings__tokens { grid-template-columns: repeat(3, minmax(0, 1fr)); }
aside ol { display: grid; gap: var(--qk-space-inline-tight); margin: var(--qk-space-surface-compact) 0 0; padding: 0; list-style: none; }
.qk-ai-provider-settings__profile { height: auto; min-height: 48px; text-align: start; justify-content: start; }
.qk-ai-provider-settings__profile span { display: grid; min-width: 0; gap: var(--qk-space-inline-tight); }
.qk-ai-provider-settings__profile strong, .qk-ai-provider-settings__profile small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.qk-ai-provider-settings__profile small, .qk-ai-provider-settings__budget { color: var(--qk-color-text-secondary); font-size: var(--qk-type-helper-font-size); }
.qk-ai-provider-settings__profile em { font-style: normal; color: var(--qk-color-text-secondary); }
.qk-ai-provider-settings__budget { margin: 0; }
footer { flex-wrap: wrap; width: 100%; }
footer > span { flex: 1; }
@media (max-width: 760px) {
  .qk-ai-provider-settings__catalog, .qk-ai-provider-settings__row { grid-template-columns: 1fr; }
}
</style>
