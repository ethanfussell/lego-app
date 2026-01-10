// frontend/src/ProfileMenu.js
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

function useIsMobile(breakpointPx = 640) {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(`(max-width: ${breakpointPx}px)`).matches;
  });

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${breakpointPx}px)`);
    const handler = (e) => setIsMobile(e.matches);

    if (mql.addEventListener) mql.addEventListener("change", handler);
    else mql.addListener(handler);

    setIsMobile(mql.matches);

    return () => {
      if (mql.removeEventListener) mql.removeEventListener("change", handler);
      else mql.removeListener(handler);
    };
  }, [breakpointPx]);

  return isMobile;
}

export default function ProfileMenu({ me, onLogout }) {
  const navigate = useNavigate();
  const isMobile = useIsMobile(640);

  const username = useMemo(() => {
    return me?.username || me?.email || "Account";
  }, [me]);

  const initials = useMemo(() => {
    const u = (username || "U").trim();
    return u.slice(0, 1).toUpperCase();
  }, [username]);

  const [open, setOpen] = useState(false);

  const buttonRef = useRef(null);
  const dropdownRef = useRef(null);

  // Close on Esc
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  // Close on outside click (desktop dropdown only)
  useEffect(() => {
    if (!open || isMobile) return;

    function onMouseDown(e) {
      const btn = buttonRef.current;
      const dd = dropdownRef.current;
      if (!btn || !dd) return;

      if (btn.contains(e.target)) return;
      if (dd.contains(e.target)) return;

      setOpen(false);
    }

    window.addEventListener("mousedown", onMouseDown);
    return () => window.removeEventListener("mousedown", onMouseDown);
  }, [open, isMobile]);

  function closeThen(fn) {
    setOpen(false);
    fn?.();
  }

  return (
    <div style={{ position: "relative" }}>
      {/* Trigger */}
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((p) => !p)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.6rem",
          padding: "0.35rem 0.6rem",
          borderRadius: "999px",
          border: "1px solid #ddd",
          background: "white",
          cursor: "pointer",
        }}
      >
        <div
          aria-hidden
          style={{
            width: 30,
            height: 30,
            borderRadius: "999px",
            background: "#111827",
            color: "white",
            display: "grid",
            placeItems: "center",
            fontWeight: 700,
            fontSize: "0.9rem",
          }}
        >
          {initials}
        </div>

        <div style={{ display: "grid", lineHeight: 1.1 }}>
          <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>{username}</span>
        </div>

        <span aria-hidden style={{ fontSize: "0.85rem", color: "#6b7280" }}>
          ▾
        </span>
      </button>

      {/* Desktop dropdown */}
      {open && !isMobile && (
        <div
          ref={dropdownRef}
          style={{
            position: "absolute",
            right: 0,
            top: "calc(100% + 8px)",
            width: 220,
            background: "white",
            border: "1px solid #e5e7eb",
            borderRadius: 12,
            boxShadow: "0 10px 30px rgba(0,0,0,0.10)",
            overflow: "hidden",
            zIndex: 50,
          }}
        >
          <MenuButton label="Account" onClick={() => closeThen(() => alert("Account page coming soon."))} />
          <MenuButton label="My Collection" onClick={() => closeThen(() => navigate("/collection"))} />
          <MenuButton label="Settings" onClick={() => closeThen(() => alert("Settings coming soon."))} />
          <Divider />
          <MenuButton
            label="Log out"
            danger
            onClick={() =>
              closeThen(() => {
                onLogout?.();
                navigate("/");
              })
            }
          />
        </div>
      )}

      {/* Mobile sheet */}
      {open && isMobile && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.35)",
            zIndex: 60,
            display: "flex",
            justifyContent: "flex-end",
          }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div
            style={{
              width: "min(92vw, 360px)",
              height: "100%",
              background: "white",
              borderLeft: "1px solid #e5e7eb",
              boxShadow: "-10px 0 30px rgba(0,0,0,0.10)",
              padding: "1rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.75rem",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <div
                aria-hidden
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 999,
                  background: "#111827",
                  color: "white",
                  display: "grid",
                  placeItems: "center",
                  fontWeight: 800,
                  fontSize: "1rem",
                }}
              >
                {initials}
              </div>

              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700 }}>{username}</div>
              </div>

              <button
                type="button"
                onClick={() => setOpen(false)}
                style={{
                  padding: "0.35rem 0.6rem",
                  borderRadius: 10,
                  border: "1px solid #e5e7eb",
                  background: "white",
                  cursor: "pointer",
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ borderTop: "1px solid #eee", marginTop: "0.25rem" }} />

            <SheetButton label="Account" onClick={() => closeThen(() => alert("Account page coming soon."))} />
            <SheetButton label="My Collection" onClick={() => closeThen(() => navigate("/collection"))} />
            <SheetButton label="Settings" onClick={() => closeThen(() => alert("Settings coming soon."))} />

            <div style={{ marginTop: "auto" }} />

            <SheetButton
              label="Log out"
              danger
              onClick={() =>
                closeThen(() => {
                  onLogout?.();
                  navigate("/");
                })
              }
            />
          </div>
        </div>
      )}
    </div>
  );
}

function MenuButton({ label, onClick, danger }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: "100%",
        textAlign: "left",
        padding: "0.7rem 0.8rem",
        border: "none",
        background: "white",
        cursor: "pointer",
        fontSize: "0.92rem",
        color: danger ? "#b91c1c" : "#111827",
        fontWeight: danger ? 700 : 600,
      }}
      onMouseOver={(e) => (e.currentTarget.style.background = "#f9fafb")}
      onMouseOut={(e) => (e.currentTarget.style.background = "white")}
    >
      {label}
    </button>
  );
}

function SheetButton({ label, onClick, danger }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: "100%",
        textAlign: "left",
        padding: "0.9rem 0.9rem",
        borderRadius: 12,
        border: "1px solid #e5e7eb",
        background: "white",
        cursor: "pointer",
        fontSize: "1rem",
        fontWeight: 700,
        color: danger ? "#b91c1c" : "#111827",
      }}
    >
      {label}
    </button>
  );
}

function Divider() {
  return <div style={{ height: 1, background: "#eee" }} />;
}