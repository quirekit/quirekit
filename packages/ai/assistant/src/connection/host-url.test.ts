import { describe, expect, it } from "vitest";
import {
  quireAiHostUrlQueryParameter,
  resolveQuireAiHostUrl
} from "./host-url";

describe("resolveQuireAiHostUrl", () => {
  it("does not synthesize a Host for an ordinary local start", () => {
    expect(resolveQuireAiHostUrl({ search: "" })).toBeUndefined();
  });

  it("uses the build-time Host when no runtime override exists", () => {
    expect(resolveQuireAiHostUrl({
      search: "?scenario=revision-regression",
      environmentHostUrl: " http://127.0.0.1:4789 ",
      defaultHostUrl: "http://127.0.0.1:5173/api/ai"
    })).toBe("http://127.0.0.1:4789");
  });

  it("uses an application gateway only when the caller explicitly supplies one", () => {
    expect(resolveQuireAiHostUrl({
      search: "",
      defaultHostUrl: " http://127.0.0.1:5173/api/ai "
    })).toBe("http://127.0.0.1:5173/api/ai");
  });

  it("lets one browser URL select a different provider-neutral Host", () => {
    const search = new URLSearchParams({
      [quireAiHostUrlQueryParameter]: "http://127.0.0.1:5790"
    });
    expect(resolveQuireAiHostUrl({
      search: search.toString(),
      environmentHostUrl: "http://127.0.0.1:4789",
      defaultHostUrl: "http://127.0.0.1:5173/api/ai"
    })).toBe("http://127.0.0.1:5790");
  });

  it("lets an explicit empty override keep the browser in local mode", () => {
    expect(resolveQuireAiHostUrl({
      search: `?${quireAiHostUrlQueryParameter}=`,
      environmentHostUrl: "http://127.0.0.1:4789",
      defaultHostUrl: "http://127.0.0.1:5173/api/ai"
    })).toBeUndefined();
  });
});
