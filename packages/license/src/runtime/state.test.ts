import { afterEach, describe, expect, it, vi } from "vitest";
import { isDevelopmentLocation } from "./environment";
import { checkQuireKitLicense, setQuireKitLicense, setQuireKitOemCertificate, subscribeQuireKitLicense } from "./state";

afterEach(() => {
  setQuireKitLicense(null);
  setQuireKitOemCertificate(null);
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
    expect(await checkQuireKitLicense("docx")).toEqual({ status: "invalid", reason: "malformed" });
    setQuireKitLicense("open-source");
    expect(listener).toHaveBeenCalledTimes(1);
    stop();
  });
  it("rechecks sub-licenses after the host declares its OEM certificate", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    const listener = vi.fn();
    const stop = subscribeQuireKitLicense(listener);
    setQuireKitLicense("qks1_eyJ9.eyJ9");
    expect((await checkQuireKitLicense("classic")).reason).toBe("malformed");
    setQuireKitOemCertificate("qkc1_eyJ9.eyJ9", { application: "合同管理系统" });
    setQuireKitOemCertificate("qkc1_eyJ9.eyJ9", { application: "合同管理系统" });
    expect(listener).toHaveBeenCalledTimes(2);
    stop();
  });
  it("keeps verification results out of the page-wide state", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    await checkQuireKitLicense("docx");
    const shared = (globalThis as unknown as Record<symbol, object>)[Symbol.for("quirekit.license.state.v1")]!;
    expect(Object.keys(shared).filter((key) => key !== "oem").sort()).toEqual(["key", "listeners", "releaseDates"]);
  });
  it("never shows the notice on local development hosts, rechecking when the host changes", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    expect((await checkQuireKitLicense("export")).status).toBe("evaluation");
    vi.stubGlobal("location", { protocol: "http:", hostname: "localhost", port: "5173" });
    expect((await checkQuireKitLicense("export")).status).toBe("licensed");
    const dev = (hostname: string, protocol = "http:", port = "5173") => isDevelopmentLocation({ protocol, hostname, port });
    expect(["127.0.0.1", "::1", "app.localhost"].every((host) => dev(host))).toBe(true);
    // Reserved names that intranets can resolve are production.
    expect(dev("example.com")).toBe(false);
    expect(dev("site.test")).toBe(false);
    // Packaged desktop and mobile shells serve production apps from localhost-like origins.
    expect(dev("localhost", "https:", "")).toBe(false);
    expect(dev("localhost", "tauri:", "")).toBe(false);
    expect(dev("tauri.localhost")).toBe(false);
    expect(dev("localhost", "capacitor:", "")).toBe(false);
  });
  it("treats packaged shells serving from a local port as production", () => {
    const dev = () => isDevelopmentLocation({ protocol: "http:", hostname: "localhost", port: "41234" });
    // An Electron browser embedded in an editor still shows the dev server; Node integration marks a packaged app.
    vi.stubGlobal("navigator", { userAgent: "Mozilla/5.0 (Macintosh) AppleWebKit/537.36 Chrome/130.0 Electron/33.2.0 Safari/537.36" });
    expect(dev()).toBe(true);
    vi.stubGlobal("process", { ...process, versions: { ...process.versions, electron: "33.2.0" } });
    expect(dev()).toBe(false);
    vi.unstubAllGlobals();
    vi.stubGlobal("Capacitor", {});
    expect(dev()).toBe(false);
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
    vi.stubGlobal("location", { protocol: "http:", hostname: "localhost", port: "5173" });
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
