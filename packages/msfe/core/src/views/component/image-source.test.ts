// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { bindImageSource } from "./image-source";

/** @returns Pending promises settle before the next assertion. */
const settle = () => new Promise(resolve => setTimeout(resolve, 0));

describe("bindImageSource", () => {
  it("shows resolved addresses and releases the previous resource", async () => {
    const image = document.createElement("img"), releases: string[] = [];
    const binding = bindImageSource(image, source => ({ url: `blob:${source}`, release: () => releases.push(source) }));
    binding.set("assets/a.png"); await settle();
    expect(image.getAttribute("src")).toBe("blob:assets/a.png");
    binding.set("assets/b.png"); await settle();
    expect(image.getAttribute("src")).toBe("blob:assets/b.png"); expect(releases).toEqual(["assets/a.png"]);
    binding.destroy(); expect(releases).toEqual(["assets/a.png", "assets/b.png"]);
  });
  it("drops results for superseded addresses and passes inline images through", async () => {
    const image = document.createElement("img"), release = vi.fn();
    let finish: (url: string) => void = () => undefined;
    const resolve = vi.fn((source: string) => source === "assets/slow.png" ? new Promise<{ url: string, release: () => void }>(done => { finish = url => done({ url, release }); }) : `blob:${source}`);
    const binding = bindImageSource(image, resolve);
    binding.set("assets/slow.png"); await settle();
    binding.set("data:image/png;base64,AAAA");
    finish("blob:slow"); await settle();
    expect(image.getAttribute("src")).toBe("data:image/png;base64,AAAA"); expect(release).toHaveBeenCalledOnce();
    expect(resolve).toHaveBeenCalledTimes(1);
  });
  it("shows the stored address when resolution fails", async () => {
    const image = document.createElement("img");
    bindImageSource(image, () => Promise.reject(new Error("missing"))).set("assets/gone.png"); await settle();
    expect(image.getAttribute("src")).toBe("assets/gone.png");
  });
});
