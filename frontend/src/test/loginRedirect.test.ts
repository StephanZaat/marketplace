import { describe, it, expect } from "vitest";
import { loginUrl, safeNext } from "../lib/loginRedirect";

describe("loginUrl", () => {
  it("carries the page to return to", () => {
    expect(loginUrl("/listings/kK8Vr9l3wM")).toBe("/login?next=%2Flistings%2FkK8Vr9l3wM");
    expect(loginUrl("/listings?q=bike")).toBe("/login?next=%2Flistings%3Fq%3Dbike");
  });
  it("doesn't nest when already on the login page", () => {
    expect(loginUrl("/login?next=%2Fx")).toBe("/login");
  });
});

describe("safeNext", () => {
  it("accepts same-site paths", () => {
    expect(safeNext("/listings/kK8Vr9l3wM")).toBe("/listings/kK8Vr9l3wM");
  });
  it.each([null, "", "https://evil.com", "//evil.com", "/\\evil.com", "javascript:alert(1)", "/login"])(
    "rejects %s",
    (next) => expect(safeNext(next)).toBeNull(),
  );
});
