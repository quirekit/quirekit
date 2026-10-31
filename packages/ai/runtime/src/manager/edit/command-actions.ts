import { readCommandDescriptors, type QuireCommandDescriptor } from "@quirekit/core";
import type { QuireAiActionCapability, QuireAiHostPorts } from "@quirekit/ai-contract";

/** Arguments of a described command without options: none. */
const noParams = Object.freeze({ type: "object", additionalProperties: false, maxProperties: 0 });

/**
 * Turns the editor commands declared with `defineCommand` into edit operations named after the commands.
 *
 * This is the one place AI code calls a command by name, as the editor command authority allows:
 * only described commands are looked up, and the call runs in the edit's shared command chain after
 * write authorization, parameter checks and target resolution, and before tracked changes, preview
 * and failure isolation.
 *
 * @param editor - Editor whose resolved commands are read.
 * @returns One action per described command.
 */
export function createQuireAiCommandActions(editor: Parameters<typeof readCommandDescriptors>[0]): readonly QuireAiActionCapability[] {
  return [...readCommandDescriptors(editor)].map(([name, descriptor]) => toAction(name, descriptor));
}

/**
 * @param name - Command name, also the operation name.
 * @param descriptor - Agent-facing description.
 * @returns Action running the command on its target.
 */
function toAction(name: string, descriptor: QuireCommandDescriptor): QuireAiActionCapability {
  return {
    kind: "action",
    name,
    description: descriptor.description,
    target: descriptor.target === undefined || descriptor.target === "document" ? "none" : descriptor.target,
    ...(descriptor.nodes === undefined ? {} : { nodes: descriptor.nodes }),
    ...(descriptor.standalone === undefined ? {} : { standalone: descriptor.standalone }),
    ...(descriptor.category === undefined ? {} : { category: descriptor.category }),
    ...(descriptor.risk === undefined ? {} : { risk: descriptor.risk }),
    ...(descriptor.prepare === undefined ? {} : {
      prepare: (params: unknown, ports: QuireAiHostPorts) => descriptor.prepare!(params, ports as Readonly<Record<string, unknown>>)
    }),
    schema: descriptor.params ?? noParams,
    // The edit has already placed the selection on the target; the command acts where the selection is.
    apply: ({ tr, commands, pos, range, author, prepared, text }, params) => {
      const command = (commands as unknown as Readonly<Record<string, ((options?: unknown) => boolean) | undefined>>)[name];
      if (command === undefined) return false;
      const context = { doc: tr.doc, pos, range, text: text ?? null, author, prepared };
      let options: unknown;
      if (descriptor.adapt !== undefined) {
        options = descriptor.adapt(params, context);
        if (options === null) return false;
      } else {
        options = toCommandIndices(params, descriptor.ordinals);
      }
      const applied = descriptor.params === undefined && descriptor.adapt === undefined ? command() : command(options);
      return applied || (descriptor.satisfied?.(params, { ...context, doc: tr.doc }) ?? false);
    }
  };
}

/**
 * @param params - Schema-valid parameters, counting from 1.
 * @param ordinals - Parameters the command counts from 0.
 * @returns Parameters as the command takes them.
 */
function toCommandIndices(params: unknown, ordinals: readonly string[] | undefined): unknown {
  if (ordinals === undefined || params === null || typeof params !== "object") return params;
  const converted: Record<string, unknown> = { ...(params as Record<string, unknown>) };
  for (const name of ordinals) {
    if (typeof converted[name] === "number") converted[name] = (converted[name] as number) - 1;
  }
  return converted;
}
