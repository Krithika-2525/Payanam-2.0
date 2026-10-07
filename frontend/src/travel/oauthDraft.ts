import { validDraft, type Draft } from "./drafts";
type Storage = Pick<globalThis.Storage, "getItem" | "setItem" | "removeItem">;
const key = "payanam.oauth-draft.v2";
export function preserveOAuthDraft(
  draft: Draft,
  storage: Storage = sessionStorage,
) {
  if (!validDraft(draft))
    throw new Error("Check your draft before signing in.");
  const value = JSON.stringify(draft);
  if (value.length > 2_000_000)
    throw new Error("Export this draft before signing in.");
  storage.setItem(key, value);
}
export function restoreOAuthDraft(
  storage: Storage = sessionStorage,
): Draft | null {
  try {
    const raw = storage.getItem(key);
    storage.removeItem(key);
    if (!raw || raw.length > 2_000_000) return null;
    const value = JSON.parse(raw);
    return validDraft(value) ? value : null;
  } catch {
    return null;
  }
}
