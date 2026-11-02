import type { MsfeComponentHost } from "../types";
import type { TaskScope } from "../../tasks/scope";

/** Generic component inputs, independent of source-node persistence. */
export interface ComponentViewMount<Props extends object> {
  /** Runtime-owned non-editable DOM boundary. */
  readonly dom: HTMLElement;
  /** Feature-defined immutable props. */
  readonly props: Props;
  /** Existing Vue/React provider host, when installed. */
  readonly host: MsfeComponentHost | undefined;
  /** View lifetime, ended when the widget is unmounted or its document is replaced. */
  readonly scope: TaskScope;
  /** Requests a coalesced CM measurement after geometry changes. */
  readonly requestMeasure: () => void;
}

/** Generic retained component lifecycle. */
export interface ComponentViewHandle<Props extends object> {
  /** @param event - Event originating inside this component. @returns True for component-owned controls, false to delegate native source interaction to CM. Defaults to true. */
  ignoreEvent?(event: Event): boolean;
  /** @param props - Changed inputs with the same renderer identity. */
  update(props: Props): void;
  /** Removes framework entries and renderer-owned listeners. */
  destroy(): void;
}

/** Typed renderer shared by source-independent widgets and component adapters. */
export type ComponentViewRenderer<Props extends object> = (mount: ComponentViewMount<Props>) => ComponentViewHandle<Props>;

/** Erased renderer boundary produced by componentView; author inputs retain their types. */
export interface ComponentView {
  /** Reusable renderer identity. */
  readonly renderer: ComponentViewRenderer<object>;
  /** Immutable feature-defined props. */
  readonly props: object;
  /** @param props - Cached immutable inputs. @param offset - Uniform source displacement.
   * @returns Inputs with source-coordinate fields and callbacks relocated; omit when props contain no source positions. */
  readonly map?: (props: object, offset: number) => object;
}

/** Generic Portal/Teleport entry alongside existing node-view entries in the same host. */
export interface ComponentViewEntry {
  /** Mount-local identity, independent of source offsets. */
  readonly id: string;
  /** Framework definition. */
  readonly component: unknown;
  /** Runtime-owned mount. */
  readonly dom: HTMLElement;
  /** Props passed as the component's view prop. */
  readonly props: object;
}

/** An image ready for display, with an optional release for host-created object URLs. */
export interface MsfeDisplayImage {
  /** Displayable `http(s)`, `blob:` or `data:` URL. */
  readonly url: string;
  /** Releases the host resource once the image no longer shows it. */
  readonly release?: () => void;
}

/** Host mapping from a stored image address, such as a document-relative path, to a displayable one. */
export type MsfeImageSourceResolver = (source: string, signal: AbortSignal) => string | MsfeDisplayImage | Promise<string | MsfeDisplayImage>;

/** Displays stored addresses in one image element, dropping results that arrive after a newer address. */
export interface MsfeImageSourceBinding {
  /** @param source - Stored address; null clears the image. */
  set(source: string | null): void;
  /** Cancels pending resolution and releases the shown resource. */
  destroy(): void;
}
