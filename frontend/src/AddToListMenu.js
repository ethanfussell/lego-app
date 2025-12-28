// frontend/src/AddToListMenu.js
import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useToast } from "./Toast";

const API_BASE = "http://localhost:8000";

function getStoredToken() {
  try {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("lego_token") || "";
  } catch {
    return "";
  }
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

function isSystemList(l) {
  if (!l) return false;
  if (l.is_system || l.isSystem || l.system) return true;

  const key = String(l.system_key || l.systemKey || l.kind || l.type || "").toLowerCase();
  if (key === "owned" || key === "wishlist") return true;

  const title = String(l.title || "").trim().toLowerCase();
  if (title === "owned" || title === "wishlist") return true;

  return false;
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
  const navigate = useNavigate();
  const { push: toast } = useToast();

  const token = getStoredToken();

  const btnRef = useRef(null);
  const menuRef = useRef(null);

  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ left: 0, top: 0, width: 260 });

  const [lists, setLists] = useState(Array.isArray(listsProp) ? listsProp : []);
  const [loadingLists, setLoadingLists] = useState(false);
  const [err, setErr] = useState(null);

  const [ownedLocal, setOwnedLocal] = useState(!!ownedSelected);
  const [wishlistLocal, setWishlistLocal] = useState(!!wishlistSelected);

  const [selectedMap, setSelectedMap] = useState({});
  const [confirm, setConfirm] = useState(null); // { type, listId?, title? }

  // ✅ ONLY custom lists (exclude system lists)
  const customLists = useMemo(() => {
    const arr = Array.isArray(lists) ? lists : [];
    return arr
      .filter((l) => l && l.id != null && l.title)
      .filter((l) => !isSystemList(l));
  }, [lists]);

  useEffect(() => setOwnedLocal(!!ownedSelected), [ownedSelected]);
  useEffect(() => setWishlistLocal(!!wishlistSelected), [wishlistSelected]);

  const shouldScrollLists = customLists.length > 3;

  function goToCreateList(e) {
    e?.stopPropagation?.();
    setOpen(false);
    setConfirm(null);
    navigate("/collection?create=1");
  }

  function computePosition() {
    const el = btnRef.current;
    if (!el) return;

    const r = el.getBoundingClientRect();
    const gap = 8;

    const desiredWidth = Math.max(240, Math.min(320, r.width * 1.25));
    let left = r.left;
    let top = r.bottom + gap;

    const pad = 10;
    const maxLeft = window.innerWidth - desiredWidth - pad;
    left = Math.max(pad, Math.min(left, maxLeft));

    const estimatedHeight =
      16 +
      (includeOwned ? 42 : 0) +
      (includeWishlist ? 42 : 0) +
      Math.min(customLists.length, 3) * 42 +
      56;

    if (top + estimatedHeight > window.innerHeight - pad) {
      top = Math.max(pad, r.top - gap - estimatedHeight);
    }

    setPos({ left, top, width: desiredWidth });
  }

  // Outside click / escape / reposition
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

  // ✅ Load lists + membership map on open (custom lists only)
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

        // membership map (custom lists only)
        const customOnly = normalized.filter((l) => l && l.id != null && !isSystemList(l));

        const map = {};
        await Promise.all(
          customOnly.map(async (l) => {
            try {
              const itemsInline = Array.isArray(l.items) ? l.items : null;
              if (itemsInline && itemsInline.includes(setNum)) {
                map[l.id] = true;
                return;
              }
              if (!token) return;
              const r = await apiFetch(`/lists/${encodeURIComponent(l.id)}`, { token });
              if (!r.ok) return;
              const detail = await safeJson(r);
              const items = Array.isArray(detail?.items) ? detail.items : [];
              if (items.includes(setNum)) map[l.id] = true;
            } catch {
              // ignore
            }
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

  function resolveTitleForAction(action) {
    if (action.type === "owned") return "Owned";
    if (action.type === "wishlist") return "Wishlist";
    if (action.type === "list") {
      return customLists.find((l) => String(l.id) === String(action.listId))?.title || "this list";
    }
    return "this item";
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

    if (resp.status === 409) return;
    if (!resp.ok) {
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

    if (resp.status === 404) return;
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Remove failed (${resp.status}): ${text}`);
    }
  }

  async function handleClickItem(action) {
    try {
      setErr(null);

      if (isSelected(action)) {
        setConfirm({ ...action, title: resolveTitleForAction(action) });
        return;
      }

      if (action.type === "owned") {
        await onAddOwned?.();
        setOwnedLocal(true);
        toast?.("Added to Owned ✅");
      } else if (action.type === "wishlist") {
        await onAddWishlist?.();
        setWishlistLocal(true);
        toast?.("Added to Wishlist ✅");
      } else if (action.type === "list") {
        await addToCustomList(action.listId);
        setSelectedMap((prev) => ({ ...prev, [action.listId]: true }));
        toast?.(`Added to ${resolveTitleForAction(action)} ✅`);
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
        await onRemoveOwned?.();
        setOwnedLocal(false);
        toast?.("Removed from Owned");
      } else if (confirm.type === "wishlist") {
        await onRemoveWishlist?.();
        setWishlistLocal(false);
        toast?.("Removed from Wishlist");
      } else if (confirm.type === "list") {
        await removeFromCustomList(confirm.listId);
        setSelectedMap((prev) => {
          const copy = { ...prev };
          delete copy[confirm.listId];
          return copy;
        });
        toast?.(`Removed from ${confirm.title}`);
      }

      setConfirm(null);
      setOpen(false);
    } catch (e) {
      setErr(e?.message || String(e));
      setConfirm(null);
    }
  }

  const baseButtonStyle = {
    height: 32,
    padding: "0 12px",
    borderRadius: "999px",
    border: "1px solid #d1d5db",
    background: "white",
    color: "#111827",
    fontWeight: 600,
    fontSize: "0.85rem",
    lineHeight: 1,
    cursor: "pointer",
    boxSizing: "border-box",
    whiteSpace: "nowrap",
    minWidth: 124,
    maxWidth: "100%",
    ...buttonStyle,
    position: "relative",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    paddingRight: 28,
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
        <span style={{ width: "100%", overflow: "hidden", textOverflow: "ellipsis", padding: "0 2px" }}>
          {buttonLabel}
        </span>
        <span
          aria-hidden
          style={{
            position: "absolute",
            right: 10,
            top: "50%",
            transform: "translateY(-50%)",
            fontSize: "0.75rem",
            pointerEvents: "none",
          }}
        >
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
                <MenuItem label="Owned" selected={ownedLocal} onClick={() => handleClickItem({ type: "owned" })} />
              )}

              {includeWishlist && (
                <MenuItem
                  label="Wishlist"
                  selected={wishlistLocal}
                  onClick={() => handleClickItem({ type: "wishlist" })}
                />
              )}

              {loadingLists && (
                <div style={{ padding: "8px 10px", fontSize: "0.85rem", color: "#666" }}>Loading lists…</div>
              )}

              <div
                style={{
                  maxHeight: shouldScrollLists ? 42 * 3 : "none",
                  overflowY: shouldScrollLists ? "auto" : "visible",
                  overscrollBehavior: "contain",
                }}
              >
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

              <div style={{ borderTop: "1px solid #f3f4f6", marginTop: 6, paddingTop: 6 }}>
                <MenuItem label="➕ Create list" selected={false} onClick={goToCreateList} />
              </div>
            </div>

            {confirm && (
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
                  e.stopPropagation();
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
                  <div style={{ fontWeight: 800, fontSize: "1.05rem" }}>Remove from {confirm.title}?</div>
                  <div style={{ color: "#666", fontSize: "0.9rem", marginTop: 6 }}>
                    This will remove the set from that list.
                  </div>

                  <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirm(null);
                      }}
                      style={{
                        height: 32,
                        padding: "0 12px",
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
                      onClick={(e) => {
                        e.stopPropagation();
                        confirmRemove();
                      }}
                      style={{
                        height: 32,
                        padding: "0 12px",
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
              </div>
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
      <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</span>
      {selected ? <span style={{ fontSize: "0.95rem" }}>✅</span> : <span style={{ width: 18 }} />}
    </button>
  );
}