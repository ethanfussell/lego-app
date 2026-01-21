export const SAVED_LIST_IDS_KEY = "saved_list_ids";

export function savedListsEventName() {
  return "saved_lists_updated";
}

export function readSavedListIds(): string[] {
  try {
    const raw = localStorage.getItem(SAVED_LIST_IDS_KEY);
    const arr = JSON.parse(raw || "[]");
    return Array.isArray(arr) ? arr.map(String).filter(Boolean) : [];
  } catch {
    return [];
  }
}

export function writeSavedListIds(ids: any[]): string[] {
  const cleaned = Array.from(new Set((ids || []).map(String).filter(Boolean)));
  localStorage.setItem(SAVED_LIST_IDS_KEY, JSON.stringify(cleaned));

  // same-tab update (storage event doesn’t fire in same tab reliably)
  window.dispatchEvent(new Event(savedListsEventName()));

  return cleaned;
}

export function toggleSavedListId(id: any): string[] {
  const key = String(id);
  const ids = readSavedListIds();
  const s = new Set(ids);

  if (s.has(key)) s.delete(key);
  else s.add(key);

  return writeSavedListIds([...s]);
}

export function isListSaved(id: any): boolean {
  return readSavedListIds().includes(String(id));
}