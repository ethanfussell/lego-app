// src/AddToListMenu.js
import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

const API_BASE = "http://localhost:8000";

function getStoredToken() {
  return localStorage.getItem("lego_token") || "";
}

async function apiFetch(path, { token, ...opts } = {}) {
  const headers = new Headers(opts.headers || {});
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(`${API_BASE}${path}`, { ...opts, headers });
}

async function safeJson(resp) {
  try {
    return await resp.json();
  } catch {
    return null;
  }
}

export default function AddToListMenu({
  setNum,
  lists: listsProp,

  includeOwned = true,
  includeWishlist = true,

  ownedSelected = false,
  wishlistSelected = false,

  onAddOwned,
  onRemoveOwned,
  onAddWishlist,
  onRemoveWishlist,

  onAddToList,
  onRemoveFromList,

  buttonLabel = "Add to list",
  buttonStyle = {},
}) {
  const token = getStoredToken();

  const btnRef = useRef(null);
  const menuRef = useRef(null);

  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ left: 0, top: 0, width: 240 });

  const [lists, setLists] = useState(Array.isArray(listsProp) ? listsProp : []);
  const [loadingLists, setLoadingLists] = useState(false);
  const [err, setErr] = useState(null);

  const [ownedLocal, setOwnedLocal] = useState(!!ownedSelected);
  const [wishlistLocal, setWishlistLocal] = useState(!!wishlistSelected);

  const [selectedMap, setSelectedMap] = useState({});
  const [confirm, setConfirm] = useState(null);

  const customLists = useMemo(() => {
    const arr = Array.isArray(lists) ? lists : [];
    return arr.filter((l) => l && l.id != null && l.title);
  }, [lists]);

  useEffect(() => setOwnedLocal(!!ownedSelected), [ownedSelected]);
  useEffect(() => setWishlistLocal(!!wishlistSelected), [wishlistSelected]);

  function computePosition() {
    const el = btnRef.current;
    if (!el) return;

    const r = el.getBoundingClientRect();
    const gap = 8;
    const desiredWidth = Math.max(220, Math.min(320, r.width * 1.35));

    let left = r.left;
    let top = r.bottom + gap;

    const pad = 10;
    const maxLeft = window.innerWidth - desiredWidth - pad;
    left = Math.max(pad, Math.min(left, maxLeft));

    const estimatedHeight =
      56 +
      (includeOwned ? 42 : 0) +
      (includeWishlist ? 42 : 0) +
      customLists.length * 42;

    if (top + estimatedHeight > window.innerHeight - pad) {
      top = Math.max(pad, r.top - gap - estimatedHeight);
    }

    setPos({ left, top, width: desiredWidth });
  }

  useEffect(() => {
    if (!open) return;

    function onDown(e) {
      const b = btnRef.current;
      const m = menuRef.current;
      if (b && b.contains(e.target)) return;
      if (m && m.contains(e.target)) return;
      setOpen(false);
      setConfirm(null);
    }

    function onKey(e) {
      if (e.key === "Escape") {
        setConfirm(null);
        setOpen(false);
      }
    }

    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", computePosition);
    window.addEventListener("scroll", computePosition, true);

    computePosition();

    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", computePosition);
      window.removeEventListener("scroll", computePosition, true);
    };
  }, [open, includeOwned, includeWishlist, customLists.length]);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    async function load() {
      try {
        setErr(null);
        setLoadingLists(true);

        let baseLists = Array.isArray(listsProp) ? listsProp : null;

        if (!baseLists) {
          if (!token) {
            if (!cancelled) {
              setLists([]);
              setSelectedMap({});
            }
            return;
          }
          const resp = await apiFetch("/lists/me", { token });
          if (!resp.ok) {
            const text = await resp.text();
            throw new Error(`Failed to load lists (${resp.status}): ${text}`);
          }
          baseLists = (await safeJson(resp)) || [];
        }

        if (cancelled) return;

        const normalized = Array.isArray(baseLists) ? baseLists : [];
        setLists(normalized);

        const map = {};
        await Promise.all(
          normalized
            .filter((l) => l && l.id != null)
            .map(async (l) => {
              try {
                const itemsInline = Array.isArray(l.items) ? l.items : null;
                if (itemsInline && itemsInline.includes(setNum)) {
                  map[l.id] = true;
                  return;
                }
                const resp = await apiFetch(`/lists/${encodeURIComponent(l.id)}`, { token });
                if (!resp.ok) return;
                const detail = await safeJson(resp);
                const items = Array.isArray(detail?.items) ? detail.items : [];
                if (items.includes(setNum)) map[l.id] = true;
              } catch {}
            })
        );

        if (!cancelled) setSelectedMap(map);
      } catch (e) {
        if (!cancelled) setErr(e?.message || String(e));
      } finally {
        if (!cancelled) setLoadingLists(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [open, listsProp, token, setNum]);

  function isSelected(action) {
    if (action.type === "owned") return !!ownedLocal;
    if (action.type === "wishlist") return !!wishlistLocal;
    if (action.type === "list") return !!selectedMap[action.listId];
    return false;
  }

  async function addToCustomList(listId) {
    if (typeof onAddToList === "function") return onAddToList(listId);
    if (!token) throw new Error("Please log in to use lists.");

    const resp = await apiFetch(`/lists/${encodeURIComponent(listId)}/items`, {
      token,
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ set_num: setNum }),
    });

    if (resp.status !== 409 && !resp.ok) {
      const text = await resp.text();
      throw new Error(`Add failed (${resp.status}): ${text}`);
    }
  }

  async function removeFromCustomList(listId) {
    if (typeof onRemoveFromList === "function") return onRemoveFromList(listId);
    if (!token) throw new Error("Please log in to use lists.");

    const resp = await apiFetch(
      `/lists/${encodeURIComponent(listId)}/items/${encodeURIComponent(setNum)}`,
      { token, method: "DELETE" }
    );

    if (resp.status !== 404 && !resp.ok) {
      const text = await resp.text();
      throw new Error(`Remove failed (${resp.status}): ${text}`);
    }
  }

  async function handleClickItem(action) {
    try {
      setErr(null);

      if (isSelected(action)) {
        const title =
          action.type === "list"
            ? (customLists.find((l) => String(l.id) === String(action.listId))?.title ||
                "this list")
            : action.type === "wishlist"
            ? "Wishlist"
            : "Owned";

        setConfirm({ ...action, title });
        return;
      }

      if (action.type === "owned") {
        if (!onAddOwned) throw new Error("Missing onAddOwned handler.");
        await onAddOwned();
        setOwnedLocal(true);
      } else if (action.type === "wishlist") {
        if (!onAddWishlist) throw new Error("Missing onAddWishlist handler.");
        await onAddWishlist();
        setWishlistLocal(true);
      } else if (action.type === "list") {
        await addToCustomList(action.listId);
        setSelectedMap((prev) => ({ ...prev, [action.listId]: true }));
      }

      setOpen(false);
    } catch (e) {
      setErr(e?.message || String(e));
    }
  }

  async function confirmRemove() {
    if (!confirm) return;

    try {
      setErr(null);

      if (confirm.type === "owned") {
        if (!onRemoveOwned) throw new Error("Missing onRemoveOwned handler.");
        await onRemoveOwned();
        setOwnedLocal(false);
      } else if (confirm.type === "wishlist") {
        if (!onRemoveWishlist) throw new Error("Missing onRemoveWishlist handler.");
        await onRemoveWishlist();
        setWishlistLocal(false);
      } else if (confirm.type === "list") {
        await removeFromCustomList(confirm.listId);
        setSelectedMap((prev) => {
          const copy = { ...prev };
          delete copy[confirm.listId];
          return copy;
        });
      }

      setConfirm(null);
      setOpen(false);
    } catch (e) {
      setErr(e?.message || String(e));
      setConfirm(null);
    }
  }

  // ✅ Keep defaults minimal; let SetCard control sizing via buttonStyle.
  const baseButtonStyle = {
    // keep your existing stuff, but change to grid for better centering
    display: "grid",
    gridTemplateColumns: "16px 1fr 16px", // left spacer, label, caret
    alignItems: "center",
    whiteSpace: "nowrap",
    padding: "0.35rem 0.6rem",
    borderRadius: "999px",
    border: "1px solid #d1d5db",
    background: "white",
    cursor: "pointer",
    fontSize: "0.85rem",
    fontWeight: 600,
    lineHeight: 1.2,
    boxSizing: "border-box",
    minWidth: 0,
    ...buttonStyle, // still allow SetCard to control width/height
  };
  
  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
          setConfirm(null);
        }}
        style={baseButtonStyle}
        aria-haspopup="menu"
        aria-expanded={open ? "true" : "false"}
        title={buttonLabel}
      >
        {/* left spacer (keeps label truly centered even with a caret on the right) */}
        <span />
  
        {/* centered label, truncates nicely in carousels */}
        <span
          style={{
            minWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            textAlign: "center",
          }}
        >
          {buttonLabel}
        </span>
  
        {/* caret on the right */}
        <span aria-hidden style={{ fontSize: "0.75rem", textAlign: "right" }}>
          ▼
        </span>
      </button>
      
      {open &&
        createPortal(
          <>
            <div
              ref={menuRef}
              role="menu"
              style={{
                position: "fixed",
                left: pos.left,
                top: pos.top,
                width: pos.width,
                background: "white",
                border: "1px solid #e5e7eb",
                borderRadius: 12,
                boxShadow: "0 12px 35px rgba(0,0,0,0.14)",
                padding: 6,
                zIndex: 9999,
              }}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            >
              {err && (
                <div style={{ color: "#b42318", fontSize: "0.85rem", padding: "8px 8px 6px" }}>
                  {err}
                </div>
              )}

              {includeOwned && (
                <MenuItem
                  label="Owned"
                  selected={ownedLocal}
                  onClick={() => handleClickItem({ type: "owned" })}
                />
              )}

              {includeWishlist && (
                <MenuItem
                  label="Wishlist"
                  selected={wishlistLocal}
                  onClick={() => handleClickItem({ type: "wishlist" })}
                />
              )}

              {loadingLists && (
                <div style={{ padding: "8px 10px", fontSize: "0.85rem", color: "#666" }}>
                  Loading lists…
                </div>
              )}

              {!loadingLists &&
                customLists.map((l) => (
                  <MenuItem
                    key={l.id}
                    label={l.title}
                    selected={!!selectedMap[l.id]}
                    onClick={() => handleClickItem({ type: "list", listId: l.id })}
                    title={l.title}
                  />
                ))}

              {!loadingLists && customLists.length === 0 && (
                <div style={{ padding: "8px 10px", fontSize: "0.85rem", color: "#666" }}>
                  No custom lists yet.
                </div>
              )}
            </div>

            {confirm &&
              createPortal(
                <div
                  role="dialog"
                  aria-modal="true"
                  style={{
                    position: "fixed",
                    inset: 0,
                    background: "rgba(0,0,0,0.35)",
                    zIndex: 10000,
                    display: "grid",
                    placeItems: "center",
                    padding: "1rem",
                  }}
                  onMouseDown={(e) => {
                    if (e.target === e.currentTarget) setConfirm(null);
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div
                    style={{
                      width: "min(420px, 100%)",
                      background: "white",
                      borderRadius: 14,
                      border: "1px solid #e5e7eb",
                      boxShadow: "0 12px 35px rgba(0,0,0,0.18)",
                      padding: "1rem",
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div style={{ fontWeight: 800, fontSize: "1.05rem" }}>
                      Remove from {confirm.title}?
                    </div>
                    <div style={{ color: "#666", fontSize: "0.9rem", marginTop: 6 }}>
                      This will remove the set from that list.
                    </div>

                    <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
                      <button
                        type="button"
                        onClick={() => setConfirm(null)}
                        style={{
                          padding: "0.45rem 0.8rem",
                          borderRadius: "999px",
                          border: "1px solid #ddd",
                          background: "white",
                          cursor: "pointer",
                          fontWeight: 700,
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={confirmRemove}
                        style={{
                          padding: "0.45rem 0.8rem",
                          borderRadius: "999px",
                          border: "none",
                          background: "#b42318",
                          color: "white",
                          cursor: "pointer",
                          fontWeight: 800,
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>,
                document.body
              )}
          </>,
          document.body
        )}
    </>
  );
}

function MenuItem({ label, selected, onClick, title }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      title={title || label}
      style={{
        width: "100%",
        textAlign: "left",
        padding: "10px 10px",
        borderRadius: 10,
        border: "none",
        background: "white",
        cursor: "pointer",
        fontWeight: 700,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
      }}
    >
      <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {label}
      </span>
      {selected ? <span style={{ fontSize: "0.95rem" }}>✅</span> : <span style={{ width: 18 }} />}
    </button>
  );
}