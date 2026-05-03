import { describe, expect, it } from "vitest";
import { isHttpUrl, isPlaceholderUrl, usableCallUrl } from "./url";

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

  it("rejects non-http(s) schemes — defence in depth against bad backfill", () => {
    expect(usableCallUrl("javascript:alert(1)")).toBeNull();
    expect(usableCallUrl("data:text/html,<script>alert(1)</script>")).toBeNull();
    expect(usableCallUrl("file:///etc/passwd")).toBeNull();
    expect(usableCallUrl("ftp://example.org/x")).toBeNull();
    expect(usableCallUrl("custom-scheme://anything")).toBeNull();
  });
});

describe("isHttpUrl", () => {
  it("accepts http and https", () => {
    expect(isHttpUrl("http://example.com")).toBe(true);
    expect(isHttpUrl("https://example.com/foo?q=1")).toBe(true);
  });

  it("rejects non-web schemes", () => {
    expect(isHttpUrl("javascript:alert(1)")).toBe(false);
    expect(isHttpUrl("data:text/html,foo")).toBe(false);
    expect(isHttpUrl("file:///x")).toBe(false);
    expect(isHttpUrl("ftp://example.org/")).toBe(false);
    expect(isHttpUrl("custom-scheme://x")).toBe(false);
  });

  it("rejects unparseable strings + non-strings", () => {
    expect(isHttpUrl("garbage")).toBe(false);
    expect(isHttpUrl("")).toBe(false);
    expect(isHttpUrl(undefined)).toBe(false);
    expect(isHttpUrl(null)).toBe(false);
    expect(isHttpUrl(42)).toBe(false);
  });
});
