import { describe, expect, it } from "vitest";

import type { View } from "@/store/store";
import { breadcrumbTrail, navItemForView, VIEW_META } from "@/store/views";

const ALL_VIEWS = Object.keys(VIEW_META) as View[];

describe("VIEW_META", () => {
  it("has a non-empty label for every view", () => {
    for (const view of ALL_VIEWS) {
      expect(VIEW_META[view].label.length).toBeGreaterThan(0);
    }
  });

  it("has a parent that resolves to a real view", () => {
    for (const view of ALL_VIEWS) {
      const { parent } = VIEW_META[view];
      if (parent !== undefined) {
        expect(VIEW_META[parent]).toBeDefined();
      }
    }
  });

  it("has no parent cycles", () => {
    for (const view of ALL_VIEWS) {
      const seen = new Set<View>();
      let current: View | undefined = view;
      while (current) {
        expect(seen.has(current)).toBe(false);
        seen.add(current);
        current = VIEW_META[current].parent;
      }
    }
  });
});

describe("navItemForView", () => {
  it("highlights itself for a top-level view", () => {
    expect(navItemForView("documents")).toBe("documents");
    expect(navItemForView("applications")).toBe("applications");
  });

  it("highlights the parent list for a detail or create view", () => {
    expect(navItemForView("edit")).toBe("documents");
    expect(navItemForView("create")).toBe("documents");
    expect(navItemForView("application")).toBe("applications");
    expect(navItemForView("application-create")).toBe("applications");
    expect(navItemForView("company")).toBe("companies");
    expect(navItemForView("company-create")).toBe("companies");
    expect(navItemForView("contact")).toBe("contacts");
    expect(navItemForView("contact-create")).toBe("contacts");
  });
});

describe("breadcrumbTrail", () => {
  it("is a single item for a top-level view", () => {
    expect(breadcrumbTrail("documents")).toEqual(["documents"]);
  });

  it("is root-first, current-view-last for a nested view", () => {
    expect(breadcrumbTrail("application")).toEqual(["applications", "application"]);
    expect(breadcrumbTrail("application-create")).toEqual(["applications", "application-create"]);
  });
});
