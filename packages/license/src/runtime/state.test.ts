import { afterEach, describe, expect, it, vi } from "vitest";
import { isDevelopmentLocation } from "./environment";
import { checkQuireKitLicense, setQuireKitLicense, subscribeQuireKitLicense } from "./state";

afterEach(() => {
  setQuireKitLicense(null);
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("page license state", () => {
  it("runs as evaluation without a key, logging once per product and reason", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    expect((await checkQuireKitLicense("classic")).status).toBe("evaluation");
    expect(await checkQuireKitLicense("classic")).toEqual({ status: "evaluation", reason: "missing" });
    expect(info).toHaveBeenCalledTimes(1);
  });
  it("rechecks after a key change and notifies subscribers", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    const listener = vi.fn();
    const stop = subscribeQuireKitLicense(listener);
    expect((await checkQuireKitLicense("docx")).status).toBe("evaluation");
    setQuireKitLicense("open-source");
    expect(listener).toHaveBeenCalledTimes(1);
    expect((await checkQuireKitLicense("docx")).plan).toBe("open-source");
    setQuireKitLicense("open-source");
    expect(listener).toHaveBeenCalledTimes(1);
    stop();
  });
  it("keeps verification results out of the page-wide state", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    await checkQuireKitLicense("docx");
    const shared = (globalThis as unknown as Record<symbol, object>)[Symbol.for("quirekit.license.state.v1")]!;
    expect(Object.keys(shared).sort()).toEqual(["key", "listeners", "releaseDates"]);
  });
  it("never shows the notice on local development hosts", async () => {
    vi.stubGlobal("location", { protocol: "http:", hostname: "localhost", port: "5173" });
    expect((await checkQuireKitLicense("export")).status).toBe("licensed");
    const dev = (hostname: string, protocol = "http:", port = "5173") => isDevelopmentLocation({ protocol, hostname, port });
    expect(["127.0.0.1", "::1", "app.localhost", "site.test"].every((host) => dev(host))).toBe(true);
    expect(dev("example.com")).toBe(false);
    // Packaged desktop and mobile shells serve production apps from localhost-like origins.
    expect(dev("localhost", "https:", "")).toBe(false);
    expect(dev("localhost", "tauri:", "")).toBe(false);
    expect(dev("tauri.localhost")).toBe(false);
    expect(dev("localhost", "capacitor:", "")).toBe(false);
  });
});

describe("declared product lines", () => {
  it("reports every unlicensed declared product once a covering key is missing", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.stubGlobal("location", { hostname: "docs.example.com" });
    const { declareQuireKitProducts, checkDeclaredQuireKitProducts, subscribeQuireKitProducts } = await import("./products");
    const listener = vi.fn();
    const stop = subscribeQuireKitProducts(listener);
    declareQuireKitProducts(["classic", "md"]);
    declareQuireKitProducts(["classic"]);
    expect(listener).toHaveBeenCalledTimes(1);
    expect((await checkDeclaredQuireKitProducts()).map(({ product }) => product)).toEqual(["classic", "md"]);
    setQuireKitLicense("open-source");
    expect(await checkDeclaredQuireKitProducts()).toEqual([]);
    stop();
  });
  it("checks a product line against the newest release date its packages declared", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    const { declareQuireKitProducts } = await import("./products");
    const { recordReleaseDate } = await import("./state");
    declareQuireKitProducts(["docx"], { releaseDate: "2026-01-01" });
    recordReleaseDate("docx", "2025-01-01");
    const scope = globalThis as unknown as Record<symbol, { releaseDates: Map<string, string> }>;
    expect(scope[Symbol.for("quirekit.license.state.v1")]!.releaseDates.get("docx")).toBe("2026-01-01");
  });
});
