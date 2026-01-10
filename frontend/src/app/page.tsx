"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

export default function Home() {
  const [health, setHealth] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    apiFetch("/health")
      .then(setHealth)
      .catch((e) => setErr(String(e.message || e)));
  }, []);

  return (
    <main style={{ padding: 24 }}>
      <h1>LEGO App</h1>
      <p>Backend health:</p>
      {err ? <pre>{err}</pre> : <pre>{JSON.stringify(health, null, 2)}</pre>}
    </main>
  );
}