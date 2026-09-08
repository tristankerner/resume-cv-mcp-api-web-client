import { describe, expect, it } from "vitest";

import { contentTypeFor, formatBytes } from "@/lib/tracking/files";

describe("contentTypeFor", () => {
  it("resolves .pdf", () => {
    expect(contentTypeFor("resume.pdf")).toBe("application/pdf");
  });

  it("resolves .docx", () => {
    expect(contentTypeFor("resume.docx")).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
  });

  it("is case-insensitive", () => {
    expect(contentTypeFor("resume.PDF")).toBe("application/pdf");
  });

  it("rejects an unsupported extension", () => {
    expect(contentTypeFor("resume.doc")).toBeNull();
  });

  it("rejects a filename with no extension", () => {
    expect(contentTypeFor("resume")).toBeNull();
  });
});

describe("formatBytes", () => {
  it("formats bytes", () => {
    expect(formatBytes(512)).toBe("512 B");
  });

  it("formats kilobytes", () => {
    expect(formatBytes(48200)).toBe("47.1 KB");
  });

  it("formats megabytes", () => {
    expect(formatBytes(1_258_291)).toBe("1.2 MB");
  });

  it("switches from B to KB at the 1024 boundary", () => {
    expect(formatBytes(1023)).toBe("1023 B");
    expect(formatBytes(1024)).toBe("1.0 KB");
  });

  it("switches from KB to MB at the 1024 * 1024 boundary", () => {
    expect(formatBytes(1024 * 1024 - 1)).toBe("1024.0 KB");
    expect(formatBytes(1024 * 1024)).toBe("1.0 MB");
  });
});
