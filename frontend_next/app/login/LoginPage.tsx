"use client";

import React, { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/app/providers";

function safeNextPath(raw: string | null, fallback = "/collection") {
  if (!raw) return fallback;
  if (!raw.startsWith("/")) return fallback;
  if (raw.startsWith("//")) return fallback;
  return raw;
}

export default function LoginPage() {
  const { loginWithToken } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const next = useMemo(() => safeNextPath(searchParams.get("next"), "/collection"), [searchParams]);

  const [username, setUsername] = useState("ethan");
  const [password, setPassword] = useState("lego123");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    try {
      setLoading(true);

      const body = new URLSearchParams();
      body.set("username", username);
      body.set("password", password);

      const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

      const resp = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      });

      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Login failed (${resp.status}): ${text}`);
      }

      const data = await resp.json();
      const token = data.access_token || data.token || "";
      if (!token) throw new Error("Login succeeded but no token was returned.");

      loginWithToken(token);
      router.replace(next);
      router.refresh();
    } catch (err: any) {
      setError(err?.message || String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md p-6">
      <h1 className="text-2xl font-bold">Log in</h1>

      <form onSubmit={onSubmit} className="mt-6" style={{ maxWidth: 420 }}>
        <div style={{ display: "grid", gap: 10 }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span>Username</span>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              style={{ padding: "0.55rem 0.65rem", borderRadius: 10, border: "1px solid #d1d5db" }}
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              style={{ padding: "0.55rem 0.65rem", borderRadius: 10, border: "1px solid #d1d5db" }}
            />
          </label>

          {error && <div style={{ color: "#b42318" }}>{error}</div>}

          <button
            type="submit"
            disabled={loading}
            style={{
              height: 36,
              padding: "0 14px",
              borderRadius: 999,
              border: "none",
              background: loading ? "#6b7280" : "#111827",
              color: "white",
              cursor: loading ? "not-allowed" : "pointer",
              fontWeight: 800,
              width: "fit-content",
            }}
          >
            {loading ? "Logging in…" : "Log in"}
          </button>
        </div>
      </form>
    </div>
  );
}