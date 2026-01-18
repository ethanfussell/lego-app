// src/lib/http.js
export function isStatus(err, code) {
    return String(err?.message || "").startsWith(String(code));
  }