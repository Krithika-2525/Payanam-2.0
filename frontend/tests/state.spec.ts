import { test, expect } from "@playwright/test";
import { newDraft, persistDraft, loadDrafts } from "../src/travel/drafts";
import type { Trip, Item } from "../src/travel/client";
import { prepareChanges } from "../src/travel/savePlan";
import {
  preserveOAuthDraft,
  restoreOAuthDraft,
} from "../src/travel/oauthDraft";
import { AccountScope } from "../src/travel/accountScope";

test("device capacity rejects new drafts without evicting existing journeys", () => {
  const storage = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    value: {
      getItem: (k: string) => storage.get(k) || null,
      setItem: (k: string, v: string) => storage.set(k, v),
    },
    configurable: true,
  });
  const first = newDraft();
  persistDraft(first);
  for (let i = 0; i < 49; i++) persistDraft(newDraft());
  expect(() => persistDraft(newDraft())).toThrow(/full/);
  expect(loadDrafts().some((d) => d.id === first.id)).toBeTruthy();
  persistDraft({ ...first, metadata: { ...first.metadata, title: "Updated" } });
  expect(loadDrafts()).toHaveLength(50);
});

test("a malformed saved entry does not hide valid drafts or accept invalid dates", () => {
  const good = newDraft(),
    bad = { ...newDraft(), items: [null] },
    invalid = {
      ...newDraft(),
      metadata: { ...good.metadata, start_date: "2026-99-99" },
    };
  Object.defineProperty(globalThis, "localStorage", {
    value: { getItem: () => JSON.stringify([bad, invalid, good]) },
    configurable: true,
  });
  expect(loadDrafts().map((d) => d.id)).toEqual([good.id]);
});

test("moves and removals precede shortening; new mixed items have final-order operations", () => {
  const draft = newDraft();
  draft.metadata.start_date = "2026-10-07";
  draft.metadata.end_date = "2026-10-07";
  const item = (id: string, position: number, day_index = 0) =>
    ({
      id,
      position,
      day_index,
      notes: "",
      place: { id: "place-" + id },
    }) as Item;
  const existing = {
    ...draft.metadata,
    id: "trip",
    version: 1,
    end_date: "2026-10-09",
    items: [item("a", 0, 2), item("b", 0)],
  } as Trip;
  draft.items = [item("n", 0), item("a", 1), item("b", 2)];
  const changes = prepareChanges(existing, draft);
  expect(changes.at(-1)?.change.kind).toBe("update_metadata");
  expect(
    changes
      .filter((p) => p.change.kind === "move_item")
      .map((p) => [p.change.item_id, p.change.position]),
  ).toEqual([
    ["n", 0],
    ["a", 1],
  ]);
});

test("OAuth handoff restores a consented draft once without uploading", () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (k: string) => values.get(k) || null,
    setItem: (k: string, v: string) => values.set(k, v),
    removeItem: (k: string) => values.delete(k),
  };
  const draft = newDraft();
  draft.metadata.title = "Before Google";
  preserveOAuthDraft(draft, storage);
  expect(restoreOAuthDraft(storage)?.metadata.title).toBe("Before Google");
  expect(restoreOAuthDraft(storage)).toBeNull();
});

test("a late account operation stays invalid after sign-out and same-user sign-in", () => {
  const scope = new AccountScope();
  scope.setIdentity("a");
  const request = scope.capture();
  scope.setIdentity(null);
  scope.setIdentity("a");
  expect(scope.current(request)).toBeFalsy();
  scope.setIdentity("b");
  expect(scope.current(request)).toBeFalsy();
});
