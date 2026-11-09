import { v4 as uuidv4 } from "uuid";
import { createQuireMemoryMediaRepository, createQuireMediaResolverChain, createQuireInlineImageResolver } from "@quirekit/media";
import type {
  QuireMediaAssetKind,
  QuireMediaRepository
} from "@quirekit/media";
import type { ClassicEditorMediaServices } from "../types";

/** Default in-memory media services owned by one Classic Editor instance. */
class ClassicEditorMemoryMediaServices implements ClassicEditorMediaServices {
  readonly #repository: QuireMediaRepository;

  /**
   * Creates one isolated repository and identity sequence.
   *
   * @param repository - Repository shared by the sink and resolver surfaces.
   */
  constructor(repository: QuireMediaRepository) {
    this.#repository = repository;
  }

  /** @returns Registration authority backed by this instance repository. */
  get sink(): QuireMediaRepository {
    return this.#repository;
  }

  /** @returns Lease-based registration authority backed by this repository. */
  get registrar(): QuireMediaRepository {
    return this.#repository;
  }

  /** @returns Resolution authority backed by this instance repository. */
  get resolver(): QuireMediaRepository {
    return this.#repository;
  }

  /**
   * Allocates a random identity, so concurrent editors of one document never pick the same one.
   *
   * @param kind - Media family receiving the identity.
   * @returns A repository-local stable identity.
   */
  createAssetId(kind: QuireMediaAssetKind): string {
    return `classic-${kind}-${uuidv4()}`;
  }
}

/**
 * Creates isolated default media services for one Classic Editor instance.
 *
 * @returns In-memory media services whose sink and resolver share one repository.
 */
export function createDefaultClassicEditorMediaServices(): ClassicEditorMediaServices {
  return new ClassicEditorMemoryMediaServices(createQuireMemoryMediaRepository());
}

/** @param media - Host services, omitted for an isolated memory repository. @returns One resource authority shared by mounted views and fixed-layout exports. */
export function resolveClassicEditorMediaServices(media = createDefaultClassicEditorMediaServices()): ClassicEditorMediaServices {
  return { sink: media.sink, registrar: media.registrar,
    resolver: createQuireMediaResolverChain([createQuireInlineImageResolver(), media.resolver]),
    createAssetId: kind => media.createAssetId(kind) };
}
