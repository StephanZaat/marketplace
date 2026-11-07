import { describe, it, expect } from "vitest";
import { apiErrorMessage } from "../lib/apiError";

const err = (detail: unknown) => ({ response: { data: { detail } } });

describe("apiErrorMessage", () => {
  it("uses a string detail", () => {
    expect(apiErrorMessage(err("Not your listing"), "x")).toBe("Not your listing");
  });
  it("turns a 422 list into text instead of crashing", () => {
    const d = [{ loc: ["body", "description"], msg: "String should have at least 1 character", type: "string_too_short" }];
    expect(apiErrorMessage(err(d), "x")).toBe("description: String should have at least 1 character");
  });
  it("falls back otherwise", () => {
    expect(apiErrorMessage(new Error("network"), "Failed")).toBe("Failed");
    expect(apiErrorMessage(err({ weird: 1 }), "Failed")).toBe("Failed");
  });
});
