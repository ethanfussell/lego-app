// frontend_next/lib/savedLists.ts
const STORAGE_KEY = "saved_list_ids";
const EVENT_NAME = "saved_lists_updated";

function uniqStrings(arr: string[]) {
  return [...new Set(arr.map((s) => s.trim()).filter(Boolean))];
}

function safeRead(): string[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);

    if (!Array.isArray(parsed)) return [];
    return uniqStrings(parsed.map(String));
  } catch {
    return [];
  }
}

function safeWrite(ids: string[]) {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(uniqStrings(ids)));

  // notify same-tab listeners
  window.dispatchEvent(new Event(EVENT_NAME));
}

export function savedListsEventName() {
  return EVENT_NAME;
}

export function readSavedListIds(): string[] {
  return safeRead();
}

export function setSavedListIds(ids: string[]) {
  safeWrite(ids);
}

export function isSavedListId(id: string) {
  const key = String(id || "").trim();
  if (!key) return false;
  return safeRead().includes(key);
}

export function addSavedListId(id: string) {
  const key = String(id || "").trim();
  if (!key) return safeRead();
  const next = uniqStrings([...safeRead(), key]);
  safeWrite(next);
  return next;
}

export function removeSavedListId(id: string) {
  const key = String(id || "").trim();
  const next = safeRead().filter((x) => x !== key);
  safeWrite(next);
  return next;
}

export function toggleSavedListId(id: string) {
  const key = String(id || "").trim();
  if (!key) return safeRead();
  return isSavedListId(key) ? removeSavedListId(key) : addSavedListId(key);
}