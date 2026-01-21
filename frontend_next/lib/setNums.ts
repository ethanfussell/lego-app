// frontend_next/lib/setNums.ts

export function baseSetNum(setNum: unknown): string {
    return String(setNum ?? "").trim().split("-")[0] ?? "";
  }
  
  export function isFullSetNum(s: unknown): boolean {
    const t = String(s ?? "").trim();
    const parts = t.split("-");
    return parts.length === 2 && parts[0].length > 0 && parts[1].length > 0;
  }
  
  export function toDeleteParam(setNum: unknown): string {
    return baseSetNum(setNum);
  }
  
  export function listHasSetNum(listLike: unknown, setNum: unknown): boolean {
    if (!listLike) return false;
  
    const plain = baseSetNum(setNum);
    const full = String(setNum ?? "").trim();
  
    const arr =
      listLike instanceof Set
        ? Array.from(listLike)
        : Array.isArray(listLike)
          ? listLike
          : [];
  
    for (const x of arr) {
      const v = String(x ?? "").trim();
      if (!v) continue;
      if (v === full) return true;
      if (baseSetNum(v) === plain) return true;
    }
  
    return false;
  }