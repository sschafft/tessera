import { describe, expect, it } from "vitest";
import { isPlaceholderUrl, usableCallUrl } from "./url";

describe("isPlaceholderUrl", () => {
  it("flags example.* hosts", () => {
    expect(isPlaceholderUrl("https://example.com")).toBe(true);
    expect(isPlaceholderUrl("https://example.org/foo")).toBe(true);
    expect(isPlaceholderUrl("https://example.net/path?q=1")).toBe(true);
    expect(isPlaceholderUrl("https://meet.example.com/abc")).toBe(true);
  });

  it("flags localhost + 127.0.0.1", () => {
    expect(isPlaceholderUrl("http://localhost:3000")).toBe(true);
    expect(isPlaceholderUrl("http://127.0.0.1:8080/x")).toBe(true);
  });

  it("accepts real hosts", () => {
    expect(isPlaceholderUrl("https://meet.google.com/abc-defg-hij")).toBe(false);
    expect(isPlaceholderUrl("https://meet.jit.si/tessera-abc-123")).toBe(false);
    expect(isPlaceholderUrl("https://miro.com/board/123")).toBe(false);
  });

  it("treats unparseable strings as placeholders", () => {
    // "garbage" lacks a scheme; URL constructor throws.
    expect(isPlaceholderUrl("garbage")).toBe(true);
    expect(isPlaceholderUrl("")).toBe(true);
  });
});

describe("usableCallUrl", () => {
  it("returns null for placeholders", () => {
    expect(usableCallUrl("https://meet.example.com")).toBeNull();
    expect(usableCallUrl("http://localhost:3000")).toBeNull();
  });

  it("passes real URLs through", () => {
    const url = "https://meet.jit.si/tessera-abc";
    expect(usableCallUrl(url)).toBe(url);
  });

  it("handles null + undefined", () => {
    expect(usableCallUrl(null)).toBeNull();
    expect(usableCallUrl(undefined)).toBeNull();
  });

  it("handles empty string", () => {
    expect(usableCallUrl("")).toBeNull();
  });
});
