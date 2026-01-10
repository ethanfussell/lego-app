// src/CollectionsPageParts.js
import React from "react";

export function ReorderSheet({ open, onClose, draftLists, setDraftLists, onSave, saving, error }) {
  if (!open) return null;

  function moveDraft(listId, dir) {
    setDraftLists((prev) => {
      const idx = prev.findIndex((l) => l.id === listId);
      const newIdx = idx + dir;
      if (idx < 0 || newIdx < 0 || newIdx >= prev.length) return prev;

      const copy = [...prev];
      const tmp = copy[idx];
      copy[idx] = copy[newIdx];
      copy[newIdx] = tmp;
      return copy;
    });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.35)",
        zIndex: 60,
        display: "grid",
        placeItems: "end center",
        padding: "1rem",
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: "min(720px, 100%)",
          background: "white",
          borderRadius: "16px",
          border: "1px solid #e5e7eb",
          boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
          padding: "1rem",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: "1rem",
            marginBottom: "0.75rem",
          }}
        >
          <div>
            <div style={{ fontWeight: 800, fontSize: "1.05rem" }}>Reorder sections</div>
            <div style={{ color: "#666", fontSize: "0.9rem", marginTop: "0.15rem" }}>
              Move Owned / Wishlist / Lists up/down, then hit Save.
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            style={{
              padding: "0.35rem 0.7rem",
              borderRadius: "999px",
              border: "1px solid #ddd",
              background: "white",
              cursor: saving ? "not-allowed" : "pointer",
              opacity: saving ? 0.6 : 1,
              fontWeight: 600,
            }}
          >
            Close
          </button>
        </div>

        {error && <div style={{ color: "red", marginBottom: "0.75rem" }}>{error}</div>}

        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "0.5rem" }}>
          {draftLists.map((l, idx) => (
            <li
              key={l.id}
              style={{
                border: "1px solid #eee",
                borderRadius: "12px",
                padding: "0.75rem",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "0.75rem",
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontWeight: 700,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {l.title}
                </div>
                <div style={{ color: "#777", fontSize: "0.85rem", marginTop: "0.15rem" }}>
                  {l.meta || ""}
                </div>
              </div>

              <div style={{ display: "flex", gap: "0.35rem" }}>
                <button
                  type="button"
                  onClick={() => moveDraft(l.id, -1)}
                  disabled={saving || idx === 0}
                  style={{
                    padding: "0.3rem 0.6rem",
                    borderRadius: "999px",
                    border: "1px solid #ddd",
                    background: "white",
                    cursor: saving || idx === 0 ? "not-allowed" : "pointer",
                    opacity: saving || idx === 0 ? 0.5 : 1,
                  }}
                  title="Move up"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => moveDraft(l.id, +1)}
                  disabled={saving || idx === draftLists.length - 1}
                  style={{
                    padding: "0.3rem 0.6rem",
                    borderRadius: "999px",
                    border: "1px solid #ddd",
                    background: "white",
                    cursor: saving || idx === draftLists.length - 1 ? "not-allowed" : "pointer",
                    opacity: saving || idx === draftLists.length - 1 ? 0.5 : 1,
                  }}
                  title="Move down"
                >
                  ↓
                </button>
              </div>
            </li>
          ))}
        </ul>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "0.9rem" }}>
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            style={{
              padding: "0.45rem 0.9rem",
              borderRadius: "999px",
              border: "none",
              background: saving ? "#888" : "#111827",
              color: "white",
              cursor: saving ? "not-allowed" : "pointer",
              fontWeight: 700,
            }}
          >
            {saving ? "Saving…" : "Save order"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function ListMenuButton({ open, onToggle }) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      style={{
        width: 34,
        height: 34,
        borderRadius: "999px",
        border: "1px solid #ddd",
        background: "white",
        cursor: "pointer",
        fontSize: "18px",
        lineHeight: "1",
        display: "grid",
        placeItems: "center",
      }}
      title="More"
      aria-haspopup="menu"
      aria-expanded={open ? "true" : "false"}
    >
      ⋯
    </button>
  );
}

export function ListMenuDropdown({ onEdit, onDelete }) {
  return (
    <div
      role="menu"
      style={{
        position: "absolute",
        right: 0,
        top: "calc(100% + 6px)",
        background: "white",
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        boxShadow: "0 10px 30px rgba(0,0,0,0.12)",
        minWidth: 160,
        padding: 6,
        zIndex: 50,
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        role="menuitem"
        onClick={onEdit}
        style={{
          width: "100%",
          textAlign: "left",
          padding: "10px 10px",
          borderRadius: 10,
          border: "none",
          background: "white",
          cursor: "pointer",
          fontWeight: 600,
        }}
      >
        ✏️ Edit
      </button>

      <button
        type="button"
        role="menuitem"
        onClick={onDelete}
        style={{
          width: "100%",
          textAlign: "left",
          padding: "10px 10px",
          borderRadius: 10,
          border: "none",
          background: "white",
          cursor: "pointer",
          fontWeight: 700,
          color: "#b42318",
        }}
      >
        🗑️ Delete
      </button>
    </div>
  );
}

export function EditListModal({
  open,
  title,
  setTitle,
  desc,
  setDesc,
  isPublic,
  setIsPublic,
  saving,
  error,
  onClose,
  onSave,
}) {
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.35)",
        zIndex: 80,
        display: "grid",
        placeItems: "center",
        padding: "1rem",
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: "min(520px, 100%)",
          background: "white",
          borderRadius: 16,
          border: "1px solid #e5e7eb",
          boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
          padding: "1rem",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: "1.05rem" }}>Edit list</div>
            <div style={{ color: "#666", fontSize: "0.9rem", marginTop: 2 }}>
              Update title / description / public setting.
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            style={{
              padding: "0.35rem 0.7rem",
              borderRadius: "999px",
              border: "1px solid #ddd",
              background: "white",
              cursor: saving ? "not-allowed" : "pointer",
              opacity: saving ? 0.6 : 1,
              fontWeight: 600,
            }}
          >
            Close
          </button>
        </div>

        <form onSubmit={onSave} style={{ marginTop: 12, display: "grid", gap: 10 }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: "0.9rem", color: "#333" }}>Title</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={{
                padding: "0.55rem 0.65rem",
                borderRadius: 10,
                border: "1px solid #d1d5db",
              }}
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: "0.9rem", color: "#333" }}>Description (optional)</span>
            <input
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              style={{
                padding: "0.55rem 0.65rem",
                borderRadius: 10,
                border: "1px solid #d1d5db",
              }}
            />
          </label>

          <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
            <span style={{ fontSize: "0.9rem", color: "#333" }}>Public (shows up in Explore)</span>
          </label>

          {error && <div style={{ color: "red" }}>{error}</div>}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button
              type="submit"
              disabled={saving}
              style={{
                padding: "0.5rem 0.9rem",
                borderRadius: "999px",
                border: "none",
                background: saving ? "#888" : "#111827",
                color: "white",
                cursor: saving ? "not-allowed" : "pointer",
                fontWeight: 700,
              }}
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}