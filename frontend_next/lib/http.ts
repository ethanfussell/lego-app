// frontend_next/lib/http.ts
export function isStatus(err: unknown, code: number) {
    const msg = String((err as any)?.message || "");
    return msg.startsWith(String(code));
  }