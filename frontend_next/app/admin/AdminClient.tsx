"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/app/providers";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/app/ui-providers/ToastProvider";
import RequireAuth from "@/app/components/RequireAuth";
import BlogEditor from "@/app/admin/BlogEditor";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AdminStats = {
  set_count: number;
  user_count: number;
  email_signup_count: number;
  review_count: number;
  affiliate_click_count: number;
};

type ReportItem = {
  id: number;
  reporter: string;
  target_type: "review" | "list";
  target_id: number;
  target_snippet: string;
  reason: string;
  notes: string | null;
  status: string;
  created_at: string;
};

type SuggestResult = {
  set_num: string;
  name: string;
  ip: string;
  year: number;
};

type AdminSetData = {
  set_num: string;
  name: string;
  year: number;
  theme: string;
  pieces: number;
  image_url: string | null;
  ip: string | null;
  retail_price: number | null;
  retail_currency: string | null;
  launch_date: string | null;
  exit_date: string | null;
  retirement_status: string | null;
  retirement_date: string | null;
  description: string | null;
  subtheme: string | null;
  set_tag: string | null;
  locked_fields: string[];
};

type EditFields = {
  image_url: string;
  name: string;
  theme: string;
  launch_date: string;
  retail_price: string;
  set_tag: string;
};

const SET_TAG_OPTIONS = [
  { value: "", label: "None" },
  { value: "GWP", label: "Gift with Purchase" },
  { value: "Insider Reward", label: "Insider Reward" },
  { value: "Promotional", label: "Promotional" },
  { value: "Exclusive", label: "Exclusive" },
];

type FeaturedThemesConfig = Record<string, string[]>;

// ---------------------------------------------------------------------------
// Shared sub-components
// ---------------------------------------------------------------------------

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="text-xs font-extrabold uppercase tracking-wide text-zinc-500">
        {label}
      </div>
      <div className="mt-2 text-3xl font-extrabold leading-none text-zinc-900">
        {typeof value === "number" ? value.toLocaleString() : value}
      </div>
    </div>
  );
}

function ReasonBadge({ reason }: { reason: string }) {
  const colors: Record<string, string> = {
    spam: "border-amber-200 bg-amber-50 text-amber-700",
    offensive: "border-red-200 bg-red-50 text-red-700",
    inappropriate: "border-orange-200 bg-orange-50 text-orange-700",
    other: "border-zinc-200 bg-zinc-100 text-zinc-600",
  };
  return (
    <span
      className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${colors[reason] || colors.other}`}
    >
      {reason}
    </span>
  );
}

function LockIcon({ locked, onClick }: { locked: boolean; onClick?: () => void }) {
  if (!locked) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      title="Admin override active — click to unlock"
      className="shrink-0 rounded p-1 text-amber-500 transition-colors hover:bg-amber-50 hover:text-amber-600"
    >
      <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
        <path
          fillRule="evenodd"
          d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
          clipRule="evenodd"
        />
      </svg>
    </button>
  );
}

function FieldRow({
  label,
  value,
  onChange,
  locked,
  onUnlock,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  locked: boolean;
  onUnlock: () => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <label className="w-28 shrink-0 text-xs font-semibold uppercase tracking-wide text-zinc-500">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="min-w-0 flex-1 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
      />
      <LockIcon locked={locked} onClick={onUnlock} />
      {/* Empty spacer when not locked to keep alignment */}
      {!locked ? <div className="w-[28px] shrink-0" /> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Set Editor Section
// ---------------------------------------------------------------------------

function SetEditorSection({ token }: { token: string }) {
  const toast = useToast();

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SuggestResult[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Selected set state
  const [selectedSet, setSelectedSet] = useState<AdminSetData | null>(null);
  const [loadingSet, setLoadingSet] = useState(false);
  const [editFields, setEditFields] = useState<EditFields>({
    image_url: "",
    name: "",
    theme: "",
    launch_date: "",
    retail_price: "",
    set_tag: "",
  });
  const [saving, setSaving] = useState(false);

  // Debounced search
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const results = await apiFetch<SuggestResult[]>(
          `/sets/suggest?q=${encodeURIComponent(searchQuery.trim())}&limit=8`,
          { token },
        );
        setSearchResults(Array.isArray(results) ? results : []);
        setSearchOpen(true);
      } catch {
        setSearchResults([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, token]);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Load a set for editing
  async function selectSet(setNum: string) {
    setSearchOpen(false);
    setSearchQuery("");
    setSearchResults([]);
    setLoadingSet(true);
    try {
      const data = await apiFetch<AdminSetData>(`/admin/sets/${setNum}`, { token });
      setSelectedSet(data);
      setEditFields({
        image_url: data.image_url || "",
        name: data.name || "",
        theme: data.theme || "",
        launch_date: data.launch_date || "",
        retail_price: data.retail_price != null ? String(data.retail_price) : "",
        set_tag: data.set_tag || "",
      });
    } catch (e: unknown) {
      toast.push(e instanceof Error ? e.message : "Failed to load set", { type: "error" });
    } finally {
      setLoadingSet(false);
    }
  }

  // Save changes
  async function handleSave() {
    if (!selectedSet) return;
    setSaving(true);
    try {
      // Build payload with only changed fields
      const body: Record<string, unknown> = {};
      if (editFields.image_url !== (selectedSet.image_url || "")) body.image_url = editFields.image_url || null;
      if (editFields.name !== (selectedSet.name || "")) body.name = editFields.name;
      if (editFields.theme !== (selectedSet.theme || "")) body.theme = editFields.theme;
      if (editFields.launch_date !== (selectedSet.launch_date || "")) body.launch_date = editFields.launch_date || null;
      const newPrice = editFields.retail_price ? parseFloat(editFields.retail_price) : null;
      if (newPrice !== selectedSet.retail_price) body.retail_price = newPrice;
      const newTag = editFields.set_tag || null;
      if (newTag !== (selectedSet.set_tag || null)) body.set_tag = newTag;

      if (Object.keys(body).length === 0) {
        toast.push("No changes to save", { type: "default" });
        setSaving(false);
        return;
      }

      const result = await apiFetch<{ ok: boolean; updated_fields: string[]; locked_fields: string[] }>(
        `/admin/sets/${selectedSet.set_num}`,
        { method: "PATCH", token, body },
      );

      toast.push(`Updated ${result.updated_fields.length} field(s)`, { type: "success" });
      revalidatePage("/new");

      // Refresh set data
      setSelectedSet((prev) => (prev ? { ...prev, ...body, locked_fields: result.locked_fields } : prev));
    } catch (e: unknown) {
      toast.push(e instanceof Error ? e.message : "Save failed", { type: "error" });
    } finally {
      setSaving(false);
    }
  }

  // Unlock a single field
  async function handleUnlock(field: string) {
    if (!selectedSet) return;
    try {
      const result = await apiFetch<{ ok: boolean; locked_fields: string[] }>(
        `/admin/sets/${selectedSet.set_num}/overrides`,
        { method: "DELETE", token, body: { fields: [field] } },
      );
      setSelectedSet((prev) => (prev ? { ...prev, locked_fields: result.locked_fields } : prev));
      toast.push(`Unlocked "${field}"`, { type: "success" });
    } catch (e: unknown) {
      toast.push(e instanceof Error ? e.message : "Unlock failed", { type: "error" });
    }
  }

  // Reset all overrides
  async function handleResetAll() {
    if (!selectedSet || !selectedSet.locked_fields.length) return;
    try {
      const result = await apiFetch<{ ok: boolean; locked_fields: string[] }>(
        `/admin/sets/${selectedSet.set_num}/overrides`,
        { method: "DELETE", token, body: { fields: selectedSet.locked_fields } },
      );
      setSelectedSet((prev) => (prev ? { ...prev, locked_fields: result.locked_fields } : prev));
      toast.push("All overrides cleared", { type: "success" });
    } catch (e: unknown) {
      toast.push(e instanceof Error ? e.message : "Reset failed", { type: "error" });
    }
  }

  // Reset to API data — clears all overrides AND restores original values
  const [resetting, setResetting] = useState(false);
  async function handleResetToApi() {
    if (!selectedSet) return;
    setResetting(true);
    try {
      await apiFetch<{ ok: boolean; restored_fields: string[]; locked_fields: string[] }>(
        `/admin/sets/${selectedSet.set_num}/reset`,
        { method: "POST", token },
      );
      toast.push("Set data restored from API", { type: "success" });
      // Re-fetch the set to get updated values
      await selectSet(selectedSet.set_num);
    } catch (e: unknown) {
      toast.push(e instanceof Error ? e.message : "Reset failed", { type: "error" });
    } finally {
      setResetting(false);
    }
  }

  const lockedSet = new Set(selectedSet?.locked_fields || []);

  return (
    <div>
      <h2 className="text-lg font-semibold">Set Editor</h2>
      <p className="mt-1 text-sm text-zinc-500">
        Search for a set and edit its data. Admin edits are locked and persist across syncs.
      </p>

      {/* Search */}
      <div ref={searchRef} className="relative mt-4">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={() => searchResults.length > 0 && setSearchOpen(true)}
          placeholder="Search by name or set number..."
          className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
        />
        {searchOpen && searchResults.length > 0 && (
          <div className="absolute z-10 mt-1 w-full rounded-xl border border-zinc-200 bg-white shadow-lg">
            {searchResults.map((r) => (
              <button
                key={r.set_num}
                type="button"
                onClick={() => selectSet(r.set_num)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm transition-colors hover:bg-zinc-50 first:rounded-t-xl last:rounded-b-xl"
              >
                <span className="shrink-0 font-mono text-xs text-zinc-400">{r.set_num}</span>
                <span className="min-w-0 flex-1 truncate font-medium text-zinc-900">{r.name}</span>
                <span className="shrink-0 text-xs text-zinc-400">{r.year}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Loading */}
      {loadingSet && <p className="mt-4 text-sm text-zinc-500">Loading set data...</p>}

      {/* Edit form */}
      {selectedSet && !loadingSet && (
        <div className="mt-4 rounded-2xl border border-zinc-200 bg-white shadow-sm">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
            <div>
              <span className="font-mono text-xs text-zinc-400">{selectedSet.set_num}</span>
              <h3 className="text-sm font-semibold text-zinc-900">{selectedSet.name}</h3>
              <div className="mt-0.5 flex items-center gap-2 text-xs text-zinc-500">
                {selectedSet.theme && <span>{selectedSet.theme}</span>}
                {selectedSet.year && <span>{selectedSet.year}</span>}
                {selectedSet.pieces && <span>{selectedSet.pieces} pcs</span>}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSelectedSet(null)}
              className="rounded-full p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="px-5 py-5">
            {/* Image preview + URL */}
            <div className="flex gap-4">
              <div className="h-28 w-28 shrink-0 overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50">
                {editFields.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={editFields.image_url}
                    alt="Preview"
                    className="h-full w-full object-contain p-2"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-zinc-300">No image</div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-3">
                  <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Image URL</label>
                  <LockIcon locked={lockedSet.has("image_url")} onClick={() => handleUnlock("image_url")} />
                </div>
                <input
                  type="text"
                  value={editFields.image_url}
                  onChange={(e) => setEditFields((p) => ({ ...p, image_url: e.target.value }))}
                  placeholder="https://..."
                  className="mt-1.5 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                />
                <p className="mt-1 text-xs text-zinc-400">
                  Paste a URL from lego.com, brickset.com, or any image host.
                </p>
              </div>
            </div>

            {/* Other fields */}
            <div className="mt-5 space-y-3">
              <FieldRow
                label="Name"
                value={editFields.name}
                onChange={(v) => setEditFields((p) => ({ ...p, name: v }))}
                locked={lockedSet.has("name")}
                onUnlock={() => handleUnlock("name")}
              />
              <FieldRow
                label="Theme"
                value={editFields.theme}
                onChange={(v) => setEditFields((p) => ({ ...p, theme: v }))}
                locked={lockedSet.has("theme")}
                onUnlock={() => handleUnlock("theme")}
              />
              <FieldRow
                label="Launch Date"
                value={editFields.launch_date}
                onChange={(v) => setEditFields((p) => ({ ...p, launch_date: v }))}
                locked={lockedSet.has("launch_date")}
                onUnlock={() => handleUnlock("launch_date")}
                placeholder="YYYY-MM-DD"
              />
              <FieldRow
                label="Retail Price"
                value={editFields.retail_price}
                onChange={(v) => setEditFields((p) => ({ ...p, retail_price: v }))}
                locked={lockedSet.has("retail_price")}
                onUnlock={() => handleUnlock("retail_price")}
                type="number"
                placeholder="49.99"
              />

              {/* Set Tag dropdown */}
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-3">
                    <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Set Tag</label>
                    <LockIcon locked={lockedSet.has("set_tag")} onClick={() => handleUnlock("set_tag")} />
                  </div>
                  <select
                    value={editFields.set_tag}
                    onChange={(e) => setEditFields((p) => ({ ...p, set_tag: e.target.value }))}
                    className="mt-1.5 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                  >
                    {SET_TAG_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-zinc-400">
                    Displays instead of price on set cards (e.g. for GWP or Insider Reward sets).
                  </p>
                </div>
              </div>
            </div>

            {/* Locked fields summary */}
            {selectedSet.locked_fields.length > 0 && (
              <div className="mt-4 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2">
                <p className="text-xs font-semibold text-amber-700">
                  Admin overrides active: {selectedSet.locked_fields.join(", ")}
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="rounded-full bg-amber-500 px-5 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-amber-400 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>

              <div className="flex items-center gap-3 ml-auto">
                {selectedSet.locked_fields.length > 0 && (
                  <button
                    type="button"
                    onClick={handleResetAll}
                    className="text-sm font-medium text-zinc-500 transition-colors hover:text-zinc-700"
                  >
                    Reset Overrides
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleResetToApi}
                  disabled={resetting}
                  className="rounded-full border border-red-200 px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
                >
                  {resetting ? "Resetting..." : "Reset to API Data"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page Controls Section (Spotlight + Featured Themes)
// ---------------------------------------------------------------------------

/** Trigger ISR revalidation for a given path so changes show up immediately. */
async function revalidatePage(path: string) {
  try {
    await fetch(`/api/revalidate?path=${encodeURIComponent(path)}`, { method: "POST" });
  } catch {
    // Best-effort — page will still update on next ISR cycle
  }
}

function PageControlsSection({ token }: { token: string }) {
  const toast = useToast();

  // Settings state
  const [spotlightSetNum, setSpotlightSetNum] = useState<string>("");
  const [spotlightName, setSpotlightName] = useState<string>("");
  const [featuredThemes, setFeaturedThemes] = useState<FeaturedThemesConfig>({});
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  // Spotlight search
  const [spotlightQuery, setSpotlightQuery] = useState("");
  const [spotlightResults, setSpotlightResults] = useState<SuggestResult[]>([]);
  const [spotlightOpen, setSpotlightOpen] = useState(false);
  const spotlightRef = useRef<HTMLDivElement>(null);
  const [savingSpotlight, setSavingSpotlight] = useState(false);

  // Featured themes editor
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [newTheme, setNewTheme] = useState("");
  const [themeResults, setThemeResults] = useState<{ theme: string; set_count: number }[]>([]);
  const [themeOpen, setThemeOpen] = useState(false);
  const themeRef = useRef<HTMLDivElement>(null);
  const [savingThemes, setSavingThemes] = useState(false);

  // Load current settings
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await apiFetch<Record<string, { value: string | null }>>(
          "/admin/settings",
          { token },
        );
        if (cancelled) return;

        // Spotlight
        const spotlightVal = data?.spotlight_set_num?.value;
        if (spotlightVal) {
          setSpotlightSetNum(spotlightVal);
          // Try to fetch the set name
          try {
            const results = await apiFetch<SuggestResult[]>(
              `/sets/suggest?q=${encodeURIComponent(spotlightVal)}&limit=1`,
              { token },
            );
            if (!cancelled && results?.[0]) setSpotlightName(results[0].name);
          } catch {
            // name lookup is optional
          }
        }

        // Featured themes
        const themesVal = data?.featured_themes?.value;
        if (themesVal) {
          try {
            const parsed = JSON.parse(themesVal);
            if (!cancelled && typeof parsed === "object") setFeaturedThemes(parsed);
          } catch {
            // ignore parse errors
          }
        }

        if (!cancelled) setSettingsLoaded(true);
      } catch {
        if (!cancelled) setSettingsLoaded(true);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [token]);

  // Generate month options (current month + next 3)
  const monthOptions = (() => {
    const now = new Date();
    const opts: { key: string; label: string }[] = [{ key: "default", label: "Default (fallback)" }];
    for (let i = 0; i < 4; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const key = `${y}-${m}`;
      const label = d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
      opts.push({ key, label });
    }
    return opts;
  })();

  // Set default selected month
  useEffect(() => {
    if (!selectedMonth && monthOptions.length > 1) {
      setSelectedMonth(monthOptions[1].key); // current month
    }
  }, [selectedMonth, monthOptions]);

  // Debounced spotlight search
  useEffect(() => {
    if (!spotlightQuery.trim() || spotlightQuery.trim().length < 2) {
      setSpotlightResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const results = await apiFetch<SuggestResult[]>(
          `/sets/suggest?q=${encodeURIComponent(spotlightQuery.trim())}&limit=6`,
          { token },
        );
        setSpotlightResults(Array.isArray(results) ? results : []);
        setSpotlightOpen(true);
      } catch {
        setSpotlightResults([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [spotlightQuery, token]);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (spotlightRef.current && !spotlightRef.current.contains(e.target as Node)) {
        setSpotlightOpen(false);
      }
      if (themeRef.current && !themeRef.current.contains(e.target as Node)) {
        setThemeOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Debounced theme search
  useEffect(() => {
    if (!newTheme.trim() || newTheme.trim().length < 1) {
      setThemeResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const results = await apiFetch<{ theme: string; set_count: number }[]>(
          `/themes?q=${encodeURIComponent(newTheme.trim())}&limit=10`,
          { token },
        );
        setThemeResults(Array.isArray(results) ? results : []);
        setThemeOpen(true);
      } catch {
        setThemeResults([]);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [newTheme, token]);

  // Save spotlight
  async function handleSaveSpotlight(setNum: string | null) {
    setSavingSpotlight(true);
    try {
      await apiFetch(`/admin/settings/spotlight_set_num`, {
        method: "PUT",
        token,
        body: { value: setNum },
      });
      await revalidatePage("/new");
      if (setNum) {
        setSpotlightSetNum(setNum);
        toast.push("Spotlight set updated", { type: "success" });
      } else {
        setSpotlightSetNum("");
        setSpotlightName("");
        toast.push("Spotlight cleared — will auto-pick", { type: "success" });
      }
    } catch (e: unknown) {
      toast.push(e instanceof Error ? e.message : "Failed to update spotlight", { type: "error" });
    } finally {
      setSavingSpotlight(false);
    }
  }

  function handleSelectSpotlight(r: SuggestResult) {
    setSpotlightOpen(false);
    setSpotlightQuery("");
    setSpotlightResults([]);
    setSpotlightName(r.name);
    handleSaveSpotlight(r.set_num);
  }

  // Featured themes helpers
  const currentThemes = featuredThemes[selectedMonth] || [];

  function addTheme(themeName?: string) {
    const t = (themeName || newTheme).trim();
    if (!t || currentThemes.includes(t)) return;
    setFeaturedThemes((prev) => ({
      ...prev,
      [selectedMonth]: [...(prev[selectedMonth] || []), t],
    }));
    setNewTheme("");
    setThemeResults([]);
    setThemeOpen(false);
  }

  function removeTheme(theme: string) {
    setFeaturedThemes((prev) => ({
      ...prev,
      [selectedMonth]: currentThemes.filter((t) => t !== theme),
    }));
  }

  async function handleSaveThemes() {
    setSavingThemes(true);
    try {
      // Clean up empty month entries
      const cleaned: FeaturedThemesConfig = {};
      for (const [k, v] of Object.entries(featuredThemes)) {
        if (v.length > 0) cleaned[k] = v;
      }
      await apiFetch(`/admin/settings/featured_themes`, {
        method: "PUT",
        token,
        body: { value: JSON.stringify(cleaned) },
      });
      await revalidatePage("/new");
      setFeaturedThemes(cleaned);
      toast.push("Featured themes saved", { type: "success" });
    } catch (e: unknown) {
      toast.push(e instanceof Error ? e.message : "Failed to save themes", { type: "error" });
    } finally {
      setSavingThemes(false);
    }
  }

  if (!settingsLoaded) return <p className="mt-8 text-sm text-zinc-500">Loading page controls...</p>;

  return (
    <div>
      <h2 className="text-lg font-semibold">New Releases</h2>
      <p className="mt-1 text-sm text-zinc-500">
        Control the /new page spotlight and featured themes.
      </p>

      {/* Spotlight Set */}
      <div className="mt-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-zinc-900">Spotlight Set</h3>
        <p className="mt-1 text-xs text-zinc-500">
          Pin a specific set as the hero spotlight on /new. Leave empty for auto-pick (biggest set from latest wave).
        </p>

        {/* Current spotlight */}
        {spotlightSetNum && (
          <div className="mt-3 flex items-center gap-3">
            <div className="flex-1 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
              <span className="font-mono text-xs text-amber-600">{spotlightSetNum}</span>
              {spotlightName && (
                <span className="ml-2 text-sm font-medium text-amber-800">{spotlightName}</span>
              )}
            </div>
            <button
              type="button"
              onClick={() => handleSaveSpotlight(null)}
              disabled={savingSpotlight}
              className="shrink-0 rounded-full border border-zinc-200 px-3 py-1.5 text-xs font-semibold text-zinc-600 transition-colors hover:bg-zinc-100 disabled:opacity-50"
            >
              Clear
            </button>
          </div>
        )}

        {/* Spotlight search */}
        <div ref={spotlightRef} className="relative mt-3">
          <input
            type="text"
            value={spotlightQuery}
            onChange={(e) => setSpotlightQuery(e.target.value)}
            onFocus={() => spotlightResults.length > 0 && setSpotlightOpen(true)}
            placeholder="Search for a set to pin..."
            className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
          />
          {spotlightOpen && spotlightResults.length > 0 && (
            <div className="absolute z-10 mt-1 w-full rounded-xl border border-zinc-200 bg-white shadow-lg">
              {spotlightResults.map((r) => (
                <button
                  key={r.set_num}
                  type="button"
                  onClick={() => handleSelectSpotlight(r)}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors hover:bg-zinc-50 first:rounded-t-xl last:rounded-b-xl"
                >
                  <span className="shrink-0 font-mono text-xs text-zinc-400">{r.set_num}</span>
                  <span className="min-w-0 flex-1 truncate text-zinc-900">{r.name}</span>
                  <span className="shrink-0 text-xs text-zinc-400">{r.year}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Featured Themes */}
      <div className="mt-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-zinc-900">Featured Themes</h3>
        <p className="mt-1 text-xs text-zinc-500">
          Choose which themes are highlighted on /new. Set themes per month or a default fallback.
        </p>

        {/* Month selector */}
        <div className="mt-3">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-amber-500"
          >
            {monthOptions.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {/* Theme pills */}
        <div className="mt-3 flex flex-wrap gap-2">
          {currentThemes.map((theme) => (
            <span
              key={theme}
              className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-sm font-medium text-zinc-700"
            >
              {theme}
              <button
                type="button"
                onClick={() => removeTheme(theme)}
                className="ml-0.5 rounded-full p-0.5 text-zinc-400 transition-colors hover:text-red-500"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </span>
          ))}
          {currentThemes.length === 0 && (
            <span className="text-xs text-zinc-400">No themes set for this month</span>
          )}
        </div>

        {/* Add theme (autocomplete) */}
        <div ref={themeRef} className="relative mt-3">
          <input
            type="text"
            value={newTheme}
            onChange={(e) => setNewTheme(e.target.value)}
            onFocus={() => themeResults.length > 0 && setThemeOpen(true)}
            placeholder="Search for a theme..."
            className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
          />
          {themeOpen && themeResults.length > 0 && (
            <div className="absolute z-10 mt-1 w-full rounded-xl border border-zinc-200 bg-white shadow-lg">
              {themeResults
                .filter((r) => !currentThemes.includes(r.theme))
                .map((r) => (
                  <button
                    key={r.theme}
                    type="button"
                    onClick={() => addTheme(r.theme)}
                    className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm transition-colors hover:bg-zinc-50 first:rounded-t-xl last:rounded-b-xl"
                  >
                    <span className="text-zinc-900">{r.theme}</span>
                    <span className="text-xs text-zinc-400">{r.set_count} sets</span>
                  </button>
                ))}
            </div>
          )}
        </div>

        {/* Save */}
        <div className="mt-4">
          <button
            type="button"
            onClick={handleSaveThemes}
            disabled={savingThemes}
            className="rounded-full bg-amber-500 px-5 py-2 text-sm font-semibold text-black transition-colors hover:bg-amber-400 disabled:opacity-50"
          >
            {savingThemes ? "Saving..." : "Save Themes"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Retiring Soon Controls Section
// ---------------------------------------------------------------------------

function RetiringSoonControlsSection({ token }: { token: string }) {
  const toast = useToast();

  // Settings state
  const [hiddenSets, setHiddenSets] = useState<string[]>([]);
  const [excludedThemes, setExcludedThemes] = useState<string[]>([]);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  // Hide set search
  const [hideQuery, setHideQuery] = useState("");
  const [hideResults, setHideResults] = useState<SuggestResult[]>([]);
  const [hideOpen, setHideOpen] = useState(false);
  const hideRef = useRef<HTMLDivElement>(null);
  const [savingHidden, setSavingHidden] = useState(false);

  // Excluded themes
  const [newExcludedTheme, setNewExcludedTheme] = useState("");
  const [themeResults, setThemeResults] = useState<{ theme: string; set_count: number }[]>([]);
  const [themeOpen, setThemeOpen] = useState(false);
  const themeRef = useRef<HTMLDivElement>(null);
  const [savingThemes, setSavingThemes] = useState(false);

  // Load current settings
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await apiFetch<Record<string, { value: string | null }>>(
          "/admin/settings",
          { token },
        );
        if (cancelled) return;

        // Hidden sets
        const hiddenVal = data?.retiring_hidden_sets?.value;
        if (hiddenVal) {
          try {
            const parsed = JSON.parse(hiddenVal);
            if (!cancelled && Array.isArray(parsed)) setHiddenSets(parsed);
          } catch { /* ignore */ }
        }

        // Excluded themes
        const themesVal = data?.retiring_excluded_themes?.value;
        if (themesVal) {
          try {
            const parsed = JSON.parse(themesVal);
            if (!cancelled && Array.isArray(parsed)) setExcludedThemes(parsed);
          } catch { /* ignore */ }
        }

        if (!cancelled) setSettingsLoaded(true);
      } catch {
        if (!cancelled) setSettingsLoaded(true);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [token]);

  // Debounced hide search
  useEffect(() => {
    if (!hideQuery.trim() || hideQuery.trim().length < 2) {
      setHideResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const results = await apiFetch<SuggestResult[]>(
          `/sets/suggest?q=${encodeURIComponent(hideQuery.trim())}&limit=6`,
          { token },
        );
        setHideResults(Array.isArray(results) ? results : []);
        setHideOpen(true);
      } catch {
        setHideResults([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [hideQuery, token]);

  // Debounced theme search
  useEffect(() => {
    if (!newExcludedTheme.trim() || newExcludedTheme.trim().length < 1) {
      setThemeResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const results = await apiFetch<{ theme: string; set_count: number }[]>(
          `/themes?q=${encodeURIComponent(newExcludedTheme.trim())}&limit=10`,
          { token },
        );
        setThemeResults(Array.isArray(results) ? results : []);
        setThemeOpen(true);
      } catch {
        setThemeResults([]);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [newExcludedTheme, token]);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (hideRef.current && !hideRef.current.contains(e.target as Node)) setHideOpen(false);
      if (themeRef.current && !themeRef.current.contains(e.target as Node)) setThemeOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Hidden sets helpers
  async function addHiddenSet(r: SuggestResult) {
    setHideOpen(false);
    setHideQuery("");
    setHideResults([]);
    if (hiddenSets.includes(r.set_num)) return;
    const updated = [...hiddenSets, r.set_num];
    setHiddenSets(updated);
    await saveHiddenSets(updated);
  }

  async function removeHiddenSet(setNum: string) {
    const updated = hiddenSets.filter((s) => s !== setNum);
    setHiddenSets(updated);
    await saveHiddenSets(updated);
  }

  async function saveHiddenSets(sets: string[]) {
    setSavingHidden(true);
    try {
      await apiFetch(`/admin/settings/retiring_hidden_sets`, {
        method: "PUT",
        token,
        body: { value: JSON.stringify(sets) },
      });
      await revalidatePage("/retiring-soon");
      toast.push(`Hidden sets updated (${sets.length})`, { type: "success" });
    } catch (e: unknown) {
      toast.push(e instanceof Error ? e.message : "Failed to save", { type: "error" });
    } finally {
      setSavingHidden(false);
    }
  }

  // Excluded themes helpers
  function addExcludedTheme(themeName?: string) {
    const t = (themeName || newExcludedTheme).trim();
    if (!t || excludedThemes.includes(t)) return;
    setExcludedThemes((prev) => [...prev, t]);
    setNewExcludedTheme("");
    setThemeResults([]);
    setThemeOpen(false);
  }

  function removeExcludedTheme(theme: string) {
    setExcludedThemes((prev) => prev.filter((t) => t !== theme));
  }

  async function handleSaveExcludedThemes() {
    setSavingThemes(true);
    try {
      await apiFetch(`/admin/settings/retiring_excluded_themes`, {
        method: "PUT",
        token,
        body: { value: JSON.stringify(excludedThemes) },
      });
      await revalidatePage("/retiring-soon");
      toast.push("Excluded themes saved", { type: "success" });
    } catch (e: unknown) {
      toast.push(e instanceof Error ? e.message : "Failed to save themes", { type: "error" });
    } finally {
      setSavingThemes(false);
    }
  }

  if (!settingsLoaded) return <p className="mt-8 text-sm text-zinc-500">Loading retiring controls...</p>;

  return (
    <div>
      <h2 className="text-lg font-semibold">Retiring Soon</h2>
      <p className="mt-1 text-sm text-zinc-500">
        Hide sets and manage excluded themes on the /retiring-soon page.
      </p>

      {/* Hidden Sets */}
      <div className="mt-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-zinc-900">Hidden Sets</h3>
        <p className="mt-1 text-xs text-zinc-500">
          Remove specific sets from the retiring page. Search and add sets to hide them.
        </p>

        {/* Current hidden set pills */}
        <div className="mt-3 flex flex-wrap gap-2">
          {hiddenSets.map((sn) => (
            <span
              key={sn}
              className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-sm font-medium text-red-700"
            >
              {sn}
              <button
                type="button"
                onClick={() => removeHiddenSet(sn)}
                disabled={savingHidden}
                className="ml-0.5 rounded-full p-0.5 text-red-400 transition-colors hover:text-red-600"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </span>
          ))}
          {hiddenSets.length === 0 && (
            <span className="text-xs text-zinc-400">No sets hidden</span>
          )}
        </div>

        {/* Search to add */}
        <div ref={hideRef} className="relative mt-3">
          <input
            type="text"
            value={hideQuery}
            onChange={(e) => setHideQuery(e.target.value)}
            onFocus={() => hideResults.length > 0 && setHideOpen(true)}
            placeholder="Search for a set to hide..."
            className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
          />
          {hideOpen && hideResults.length > 0 && (
            <div className="absolute z-10 mt-1 w-full rounded-xl border border-zinc-200 bg-white shadow-lg">
              {hideResults
                .filter((r) => !hiddenSets.includes(r.set_num))
                .map((r) => (
                  <button
                    key={r.set_num}
                    type="button"
                    onClick={() => addHiddenSet(r)}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors hover:bg-zinc-50 first:rounded-t-xl last:rounded-b-xl"
                  >
                    <span className="shrink-0 font-mono text-xs text-zinc-400">{r.set_num}</span>
                    <span className="min-w-0 flex-1 truncate text-zinc-900">{r.name}</span>
                    <span className="shrink-0 text-xs text-zinc-400">{r.year}</span>
                  </button>
                ))}
            </div>
          )}
        </div>
      </div>

      {/* Excluded Themes */}
      <div className="mt-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-zinc-900">Excluded Themes</h3>
        <p className="mt-1 text-xs text-zinc-500">
          Entire themes to hide from the retiring page (e.g. minifigures, education kits).
        </p>

        {/* Theme pills */}
        <div className="mt-3 flex flex-wrap gap-2">
          {excludedThemes.map((theme) => (
            <span
              key={theme}
              className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-sm font-medium text-zinc-700"
            >
              {theme}
              <button
                type="button"
                onClick={() => removeExcludedTheme(theme)}
                className="ml-0.5 rounded-full p-0.5 text-zinc-400 transition-colors hover:text-red-500"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </span>
          ))}
          {excludedThemes.length === 0 && (
            <span className="text-xs text-zinc-400">No themes excluded (defaults: SPIKE, LEGO Exclusive, Seasonal, *Minifigure*)</span>
          )}
        </div>

        {/* Add theme (autocomplete) */}
        <div ref={themeRef} className="relative mt-3">
          <input
            type="text"
            value={newExcludedTheme}
            onChange={(e) => setNewExcludedTheme(e.target.value)}
            onFocus={() => themeResults.length > 0 && setThemeOpen(true)}
            placeholder="Search for a theme to exclude..."
            className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
          />
          {themeOpen && themeResults.length > 0 && (
            <div className="absolute z-10 mt-1 w-full rounded-xl border border-zinc-200 bg-white shadow-lg">
              {themeResults
                .filter((r) => !excludedThemes.includes(r.theme))
                .map((r) => (
                  <button
                    key={r.theme}
                    type="button"
                    onClick={() => addExcludedTheme(r.theme)}
                    className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm transition-colors hover:bg-zinc-50 first:rounded-t-xl last:rounded-b-xl"
                  >
                    <span className="text-zinc-900">{r.theme}</span>
                    <span className="text-xs text-zinc-400">{r.set_count} sets</span>
                  </button>
                ))}
            </div>
          )}
        </div>

        {/* Save */}
        <div className="mt-4">
          <button
            type="button"
            onClick={handleSaveExcludedThemes}
            disabled={savingThemes}
            className="rounded-full bg-amber-500 px-5 py-2 text-sm font-semibold text-black transition-colors hover:bg-amber-400 disabled:opacity-50"
          >
            {savingThemes ? "Saving..." : "Save Excluded Themes"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Quick Explore card types & presets
// ---------------------------------------------------------------------------

type QuickExploreCard = {
  label: string;
  href: string;
  icon: string;
  color: string;
};

const COLOR_PRESETS: { id: string; label: string; value: string }[] = [
  { id: "green", label: "Green", value: "from-green-50 to-emerald-50 border-green-200 hover:border-green-300" },
  { id: "blue", label: "Blue", value: "from-blue-50 to-sky-50 border-blue-200 hover:border-blue-300" },
  { id: "amber", label: "Amber", value: "from-amber-50 to-yellow-50 border-amber-200 hover:border-amber-300" },
  { id: "purple", label: "Purple", value: "from-purple-50 to-violet-50 border-purple-200 hover:border-purple-300" },
  { id: "orange", label: "Orange", value: "from-orange-50 to-red-50 border-orange-200 hover:border-orange-300" },
  { id: "teal", label: "Teal", value: "from-teal-50 to-cyan-50 border-teal-200 hover:border-teal-300" },
  { id: "rose", label: "Rose", value: "from-rose-50 to-pink-50 border-rose-200 hover:border-rose-300" },
  { id: "zinc", label: "Gray", value: "from-zinc-50 to-slate-50 border-zinc-200 hover:border-zinc-300" },
];

function colorPresetId(colorValue: string): string {
  const match = COLOR_PRESETS.find((p) => p.value === colorValue);
  return match ? match.id : COLOR_PRESETS[0].id;
}

const DEFAULT_QUICK_EXPLORE_CARDS: QuickExploreCard[] = [
  { label: "Under $30", href: "/search?max_price=30", icon: "💰", color: "from-green-50 to-emerald-50 border-green-200 hover:border-green-300" },
  { label: "500+ Pieces", href: "/search?min_pieces=500", icon: "🧱", color: "from-blue-50 to-sky-50 border-blue-200 hover:border-blue-300" },
  { label: "Top Rated", href: "/search?sort=rating&order=desc", icon: "⭐", color: "from-amber-50 to-yellow-50 border-amber-200 hover:border-amber-300" },
  { label: "Display Sets", href: "/themes/Icons", icon: "🏛️", color: "from-purple-50 to-violet-50 border-purple-200 hover:border-purple-300" },
  { label: "For Kids", href: "/themes/City", icon: "👦", color: "from-orange-50 to-red-50 border-orange-200 hover:border-orange-300" },
  { label: "Most Pieces", href: "/pieces/most", icon: "🏗️", color: "from-teal-50 to-cyan-50 border-teal-200 hover:border-teal-300" },
];

// ---------------------------------------------------------------------------
// Discover Controls Section
// ---------------------------------------------------------------------------

const DISCOVER_SECTIONS = [
  { id: "quick_explore", label: "Quick Explore", hasLimit: false, defaultTitle: "Quick explore" },
  { id: "new_releases", label: "New Releases", hasLimit: true, defaultTitle: "New Releases", defaultSubtitle: "Recently launched sets", defaultLimit: 14 },
  { id: "retiring_soon", label: "Retiring Soon", hasLimit: true, defaultTitle: "Retiring Soon", defaultSubtitle: "Get them before they're gone", defaultLimit: 14 },
  { id: "best_deals", label: "Best Deals", hasLimit: false, defaultTitle: "Best Deals", defaultSubtitle: "Sets with price drops" },
  { id: "coming_soon", label: "Coming Soon", hasLimit: true, defaultTitle: "Coming Soon", defaultSubtitle: "Upcoming releases", defaultLimit: 14 },
  { id: "browse_by_theme", label: "Browse by Theme", hasLimit: true, defaultTitle: "Browse by Theme", defaultSubtitle: "Explore your favorite worlds", defaultLimit: 12 },
  { id: "top_rated", label: "Top Rated", hasLimit: true, hasMinRating: true, defaultTitle: "Top Rated by Community", defaultSubtitle: "Highest-rated sets", defaultLimit: 14, defaultMinRating: 4.0 },
  { id: "featured_lists", label: "Featured Lists", hasLimit: true, defaultTitle: "Featured Lists", defaultSubtitle: "Curated by the community", defaultLimit: 6 },
  { id: "social", label: "Social", hasLimit: false, defaultTitle: "Social" },
  { id: "guides", label: "Guides & Articles", hasLimit: false, defaultTitle: "Guides & Articles" },
] as const;

type SectionConfigEntry = { title?: string; subtitle?: string; limit?: number; min_rating?: number };
type SectionConfigMap = Record<string, SectionConfigEntry>;

function DiscoverControlsSection({ token }: { token: string }) {
  const toast = useToast();

  const [hiddenSections, setHiddenSections] = useState<string[]>([]);
  const [sectionConfig, setSectionConfig] = useState<SectionConfigMap>({});
  const [quickExploreCards, setQuickExploreCards] = useState<QuickExploreCard[]>(DEFAULT_QUICK_EXPLORE_CARDS);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  // Load current settings
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await apiFetch<Record<string, { value: string | null }>>(
          "/admin/settings",
          { token },
        );
        if (cancelled) return;

        const hiddenVal = data?.discover_hidden_sections?.value;
        if (hiddenVal) {
          try {
            const parsed = JSON.parse(hiddenVal);
            if (!cancelled && Array.isArray(parsed)) setHiddenSections(parsed);
          } catch { /* ignore */ }
        }

        const configVal = data?.discover_section_config?.value;
        if (configVal) {
          try {
            const parsed = JSON.parse(configVal);
            if (!cancelled && typeof parsed === "object" && parsed !== null) setSectionConfig(parsed);
          } catch { /* ignore */ }
        }

        const cardsVal = data?.quick_explore_cards?.value;
        if (cardsVal) {
          try {
            const parsed = JSON.parse(cardsVal);
            if (!cancelled && Array.isArray(parsed) && parsed.length > 0) {
              setQuickExploreCards(parsed.filter((c: unknown) =>
                typeof c === "object" && c !== null &&
                typeof (c as QuickExploreCard).label === "string" &&
                typeof (c as QuickExploreCard).href === "string"
              ));
            }
          } catch { /* ignore */ }
        }

        if (!cancelled) setSettingsLoaded(true);
      } catch {
        if (!cancelled) setSettingsLoaded(true);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [token]);

  function toggleSection(sectionId: string) {
    setHiddenSections((prev) =>
      prev.includes(sectionId)
        ? prev.filter((s) => s !== sectionId)
        : [...prev, sectionId],
    );
  }

  function updateSectionField(sectionId: string, field: keyof SectionConfigEntry, value: string | number | undefined) {
    setSectionConfig((prev) => {
      const entry = { ...prev[sectionId] };
      if (value === undefined || value === "") {
        delete entry[field];
      } else {
        (entry as Record<string, string | number>)[field] = value;
      }
      // Remove entry entirely if empty
      if (Object.keys(entry).length === 0) {
        const next = { ...prev };
        delete next[sectionId];
        return next;
      }
      return { ...prev, [sectionId]: entry };
    });
  }

  async function handleSave() {
    setSaving(true);
    try {
      await Promise.all([
        apiFetch(`/admin/settings/discover_hidden_sections`, {
          method: "PUT",
          token,
          body: { value: JSON.stringify(hiddenSections) },
        }),
        apiFetch(`/admin/settings/discover_section_config`, {
          method: "PUT",
          token,
          body: { value: JSON.stringify(sectionConfig) },
        }),
        apiFetch(`/admin/settings/quick_explore_cards`, {
          method: "PUT",
          token,
          body: { value: JSON.stringify(quickExploreCards) },
        }),
      ]);
      await revalidatePage("/discover");
      toast.push("Discover settings saved", { type: "success" });
    } catch (e: unknown) {
      toast.push(e instanceof Error ? e.message : "Failed to save", { type: "error" });
    } finally {
      setSaving(false);
    }
  }

  if (!settingsLoaded) return <p className="mt-8 text-sm text-zinc-500">Loading discover controls...</p>;

  return (
    <div>
      <h2 className="text-lg font-semibold">Discover</h2>
      <p className="mt-1 text-sm text-zinc-500">
        Control which sections appear on the /discover page and customize their settings.
      </p>

      <div className="mt-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-zinc-900">Sections</h3>
        <p className="mt-1 text-xs text-zinc-500">
          Toggle visibility and click a section to customize its title, subtitle, and limits.
        </p>

        <div className="mt-4 space-y-2">
          {DISCOVER_SECTIONS.map((section) => {
            const isVisible = !hiddenSections.includes(section.id);
            const isExpanded = expandedSection === section.id;
            const cfg = sectionConfig[section.id] || {};

            return (
              <div key={section.id} className={`rounded-xl border transition-colors ${
                isVisible ? "border-emerald-200 bg-emerald-50/50" : "border-zinc-200 bg-zinc-50"
              }`}>
                {/* Section header row */}
                <div className="flex items-center gap-2 px-4 py-3">
                  {/* Expand/collapse button */}
                  <button
                    type="button"
                    onClick={() => setExpandedSection(isExpanded ? null : section.id)}
                    className="shrink-0 text-zinc-400 hover:text-zinc-600 transition-colors"
                    aria-label={isExpanded ? "Collapse" : "Expand"}
                  >
                    <svg className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-90" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>

                  {/* Section name */}
                  <button
                    type="button"
                    onClick={() => setExpandedSection(isExpanded ? null : section.id)}
                    className="flex-1 text-left"
                  >
                    <span className={`text-sm font-medium ${isVisible ? "text-emerald-800" : "text-zinc-400 line-through"}`}>
                      {section.label}
                    </span>
                    {cfg.title && cfg.title !== section.defaultTitle && (
                      <span className="ml-2 text-xs text-zinc-400">
                        &ldquo;{cfg.title}&rdquo;
                      </span>
                    )}
                  </button>

                  {/* Visibility toggle */}
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); toggleSection(section.id); }}
                    className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                      isVisible
                        ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                        : "bg-zinc-200 text-zinc-500 hover:bg-zinc-300"
                    }`}
                  >
                    {isVisible ? "Visible" : "Hidden"}
                  </button>
                </div>

                {/* Expanded config panel */}
                {isExpanded && (
                  <div className="border-t border-zinc-200/60 px-4 py-4 space-y-3">
                    {/* Title */}
                    <div>
                      <label className="block text-xs font-medium text-zinc-600 mb-1">Title</label>
                      <input
                        type="text"
                        value={cfg.title ?? ""}
                        onChange={(e) => updateSectionField(section.id, "title", e.target.value)}
                        placeholder={section.defaultTitle}
                        className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
                      />
                    </div>

                    {/* Subtitle */}
                    {"defaultSubtitle" in section && (
                      <div>
                        <label className="block text-xs font-medium text-zinc-600 mb-1">Subtitle</label>
                        <input
                          type="text"
                          value={cfg.subtitle ?? ""}
                          onChange={(e) => updateSectionField(section.id, "subtitle", e.target.value)}
                          placeholder={section.defaultSubtitle}
                          className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
                        />
                      </div>
                    )}

                    {/* Limit */}
                    {section.hasLimit && (
                      <div>
                        <label className="block text-xs font-medium text-zinc-600 mb-1">
                          Items to show <span className="text-zinc-400">(default: {section.defaultLimit})</span>
                        </label>
                        <input
                          type="number"
                          min={2}
                          max={30}
                          value={cfg.limit ?? ""}
                          onChange={(e) => {
                            const v = e.target.value;
                            updateSectionField(section.id, "limit", v === "" ? undefined : Math.max(2, Math.min(30, parseInt(v, 10) || 2)));
                          }}
                          placeholder={String(section.defaultLimit)}
                          className="w-32 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
                        />
                      </div>
                    )}

                    {/* Min Rating (Top Rated only) */}
                    {"hasMinRating" in section && section.hasMinRating && (
                      <div>
                        <label className="block text-xs font-medium text-zinc-600 mb-1">
                          Minimum rating <span className="text-zinc-400">(default: {section.defaultMinRating})</span>
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={5}
                          step={0.1}
                          value={cfg.min_rating ?? ""}
                          onChange={(e) => {
                            const v = e.target.value;
                            updateSectionField(section.id, "min_rating", v === "" ? undefined : Math.max(1, Math.min(5, parseFloat(v) || 1)));
                          }}
                          placeholder={String(section.defaultMinRating)}
                          className="w-32 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
                        />
                      </div>
                    )}

                    {/* Quick Explore cards editor */}
                    {section.id === "quick_explore" && (
                      <div>
                        <label className="block text-xs font-medium text-zinc-600 mb-2">Cards</label>
                        <div className="space-y-2">
                          {quickExploreCards.map((card, idx) => (
                            <div key={idx} className="flex flex-wrap items-start gap-2 rounded-lg border border-zinc-200 bg-zinc-50/50 p-3">
                              <div className="flex items-center gap-2 w-full sm:w-auto">
                                <span className="text-lg">{card.icon}</span>
                                <input
                                  type="text"
                                  value={card.icon}
                                  onChange={(e) => {
                                    const next = [...quickExploreCards];
                                    next[idx] = { ...next[idx], icon: e.target.value };
                                    setQuickExploreCards(next);
                                  }}
                                  placeholder="Icon"
                                  className="w-14 rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-sm text-center focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
                                />
                                <input
                                  type="text"
                                  value={card.label}
                                  onChange={(e) => {
                                    const next = [...quickExploreCards];
                                    next[idx] = { ...next[idx], label: e.target.value };
                                    setQuickExploreCards(next);
                                  }}
                                  placeholder="Label"
                                  className="flex-1 min-w-[100px] rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-sm focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
                                />
                              </div>
                              <input
                                type="text"
                                value={card.href}
                                onChange={(e) => {
                                  const next = [...quickExploreCards];
                                  next[idx] = { ...next[idx], href: e.target.value };
                                  setQuickExploreCards(next);
                                }}
                                placeholder="/search?..."
                                className="flex-1 min-w-[160px] rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-sm font-mono focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
                              />
                              <select
                                value={colorPresetId(card.color)}
                                onChange={(e) => {
                                  const preset = COLOR_PRESETS.find((p) => p.id === e.target.value);
                                  if (!preset) return;
                                  const next = [...quickExploreCards];
                                  next[idx] = { ...next[idx], color: preset.value };
                                  setQuickExploreCards(next);
                                }}
                                className="rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-sm focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
                              >
                                {COLOR_PRESETS.map((p) => (
                                  <option key={p.id} value={p.id}>{p.label}</option>
                                ))}
                              </select>
                              <button
                                type="button"
                                onClick={() => {
                                  const next = quickExploreCards.filter((_, i) => i !== idx);
                                  setQuickExploreCards(next);
                                }}
                                className="shrink-0 rounded-lg p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                                title="Remove card"
                              >
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                          ))}
                        </div>
                        {quickExploreCards.length < 12 && (
                          <button
                            type="button"
                            onClick={() => setQuickExploreCards([...quickExploreCards, { label: "", href: "/", icon: "🔗", color: COLOR_PRESETS[0].value }])}
                            className="mt-2 text-sm font-semibold text-amber-600 hover:text-amber-700 hover:underline"
                          >
                            + Add card
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setQuickExploreCards([...DEFAULT_QUICK_EXPLORE_CARDS])}
                          className="mt-2 ml-4 text-sm text-zinc-400 hover:text-zinc-600 hover:underline"
                        >
                          Reset to defaults
                        </button>
                        <button
                          type="button"
                          onClick={() => setQuickExploreCards([])}
                          className="mt-2 ml-4 text-sm text-zinc-400 hover:text-zinc-600 hover:underline"
                        >
                          Use auto-generated
                        </button>
                      </div>
                    )}

                    {/* No configurable fields hint */}
                    {!section.hasLimit && !("defaultSubtitle" in section) && !("hasMinRating" in section) && section.id !== "quick_explore" && (
                      <p className="text-xs text-zinc-400 italic">Only title customization is available for this section.</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Save */}
        <div className="mt-4">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded-full bg-amber-500 px-5 py-2 text-sm font-semibold text-black transition-colors hover:bg-amber-400 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Themes Controls Section
// ---------------------------------------------------------------------------

function ThemesControlsSection({ token }: { token: string }) {
  const toast = useToast();

  // Excluded themes
  const [excludedThemes, setExcludedThemes] = useState<string[]>([]);
  // Custom images: theme name → image URL
  const [customImages, setCustomImages] = useState<Record<string, string>>({});
  // All themes for the autocomplete
  const [allThemes, setAllThemes] = useState<{ theme: string; set_count: number; image_url: string | null }[]>([]);

  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  // Search for excluding themes
  const [excludeQuery, setExcludeQuery] = useState("");
  const [excludeResults, setExcludeResults] = useState<{ theme: string; set_count: number }[]>([]);
  const [excludeOpen, setExcludeOpen] = useState(false);
  const excludeRef = useRef<HTMLDivElement>(null);

  // Search for custom image themes
  const [imageQuery, setImageQuery] = useState("");
  const [imageResults, setImageResults] = useState<{ theme: string; set_count: number }[]>([]);
  const [imageOpen, setImageOpen] = useState(false);
  const imageRef = useRef<HTMLDivElement>(null);
  const [editingImageTheme, setEditingImageTheme] = useState<string | null>(null);
  const [editingImageUrl, setEditingImageUrl] = useState("");

  // Load settings + all themes
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [data, themes] = await Promise.all([
          apiFetch<Record<string, { value: string | null }>>("/admin/settings", { token }),
          apiFetch<{ theme: string; set_count: number; image_url: string | null }[]>("/themes?limit=200", { token }),
        ]);
        if (cancelled) return;

        if (Array.isArray(themes)) setAllThemes(themes);

        const exVal = data?.themes_excluded?.value;
        if (exVal) {
          try {
            const parsed = JSON.parse(exVal);
            if (Array.isArray(parsed)) setExcludedThemes(parsed);
          } catch { /* ignore */ }
        }

        const imgVal = data?.themes_custom_images?.value;
        if (imgVal) {
          try {
            const parsed = JSON.parse(imgVal);
            if (typeof parsed === "object" && parsed !== null) setCustomImages(parsed);
          } catch { /* ignore */ }
        }

        setSettingsLoaded(true);
      } catch {
        if (!cancelled) setSettingsLoaded(true);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [token]);

  // Debounced exclude search
  useEffect(() => {
    if (!excludeQuery.trim() || excludeQuery.trim().length < 1) {
      setExcludeResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const results = await apiFetch<{ theme: string; set_count: number }[]>(
          `/themes?q=${encodeURIComponent(excludeQuery.trim())}&limit=10`,
          { token },
        );
        setExcludeResults(Array.isArray(results) ? results : []);
        setExcludeOpen(true);
      } catch {
        setExcludeResults([]);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [excludeQuery, token]);

  // Debounced image theme search
  useEffect(() => {
    if (!imageQuery.trim() || imageQuery.trim().length < 1) {
      setImageResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const results = await apiFetch<{ theme: string; set_count: number }[]>(
          `/themes?q=${encodeURIComponent(imageQuery.trim())}&limit=10`,
          { token },
        );
        setImageResults(Array.isArray(results) ? results : []);
        setImageOpen(true);
      } catch {
        setImageResults([]);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [imageQuery, token]);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (excludeRef.current && !excludeRef.current.contains(e.target as Node)) setExcludeOpen(false);
      if (imageRef.current && !imageRef.current.contains(e.target as Node)) setImageOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function addExcluded(theme: string) {
    if (!excludedThemes.includes(theme)) {
      setExcludedThemes((prev) => [...prev, theme]);
    }
    setExcludeQuery("");
    setExcludeResults([]);
    setExcludeOpen(false);
  }

  function removeExcluded(theme: string) {
    setExcludedThemes((prev) => prev.filter((t) => t !== theme));
  }

  function startEditImage(theme: string) {
    setEditingImageTheme(theme);
    setEditingImageUrl(customImages[theme] || "");
    setImageQuery("");
    setImageResults([]);
    setImageOpen(false);
  }

  function saveImageUrl() {
    if (!editingImageTheme) return;
    if (editingImageUrl.trim()) {
      setCustomImages((prev) => ({ ...prev, [editingImageTheme]: editingImageUrl.trim() }));
    } else {
      setCustomImages((prev) => {
        const next = { ...prev };
        delete next[editingImageTheme];
        return next;
      });
    }
    setEditingImageTheme(null);
    setEditingImageUrl("");
  }

  function removeCustomImage(theme: string) {
    setCustomImages((prev) => {
      const next = { ...prev };
      delete next[theme];
      return next;
    });
  }

  async function handleSave() {
    setSaving(true);
    try {
      await Promise.all([
        apiFetch("/admin/settings/themes_excluded", {
          method: "PUT",
          token,
          body: { value: JSON.stringify(excludedThemes) },
        }),
        apiFetch("/admin/settings/themes_custom_images", {
          method: "PUT",
          token,
          body: { value: JSON.stringify(customImages) },
        }),
      ]);
      await revalidatePage("/themes");
      toast.push("Theme settings saved", { type: "success" });
    } catch (e: unknown) {
      toast.push(e instanceof Error ? e.message : "Failed to save", { type: "error" });
    } finally {
      setSaving(false);
    }
  }

  if (!settingsLoaded) return <p className="mt-8 text-sm text-zinc-500">Loading theme controls...</p>;

  return (
    <div>
      <h2 className="text-lg font-semibold">Themes</h2>
      <p className="mt-1 text-sm text-zinc-500">
        Customize theme card images and exclude themes from the /themes page.
      </p>

      {/* Custom Images */}
      <div className="mt-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-zinc-900">Custom Theme Images</h3>
        <p className="mt-1 text-xs text-zinc-500">
          Override the auto-selected image for a theme card. Paste an image URL for any theme.
        </p>

        {/* Current custom image entries */}
        <div className="mt-3 space-y-2">
          {Object.entries(customImages).map(([theme, url]) => (
            <div
              key={theme}
              className="flex items-center gap-3 rounded-xl border border-zinc-100 bg-zinc-50 px-3 py-2"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={theme}
                className="h-10 w-10 shrink-0 rounded-lg border border-zinc-200 bg-white object-contain p-0.5"
              />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-zinc-900">{theme}</div>
                <div className="truncate text-xs text-zinc-400">{url}</div>
              </div>
              <button
                type="button"
                onClick={() => startEditImage(theme)}
                className="shrink-0 rounded-full px-2 py-1 text-xs font-medium text-amber-600 transition-colors hover:bg-amber-50"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => removeCustomImage(theme)}
                className="shrink-0 rounded-full p-1 text-zinc-400 transition-colors hover:text-red-500"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
          {Object.keys(customImages).length === 0 && (
            <span className="text-xs text-zinc-400">No custom images set — using auto-selected images</span>
          )}
        </div>

        {/* Editing inline */}
        {editingImageTheme && (
          <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
            <div className="text-sm font-medium text-zinc-900">{editingImageTheme}</div>
            <div className="mt-2 flex gap-2">
              <input
                type="text"
                value={editingImageUrl}
                onChange={(e) => setEditingImageUrl(e.target.value)}
                placeholder="https://example.com/image.jpg"
                className="min-w-0 flex-1 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
              />
              <button
                type="button"
                onClick={saveImageUrl}
                className="shrink-0 rounded-full bg-amber-500 px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-amber-400"
              >
                Set
              </button>
              <button
                type="button"
                onClick={() => { setEditingImageTheme(null); setEditingImageUrl(""); }}
                className="shrink-0 rounded-full border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Search to add a new custom image */}
        {!editingImageTheme && (
          <div ref={imageRef} className="relative mt-3">
            <input
              type="text"
              value={imageQuery}
              onChange={(e) => setImageQuery(e.target.value)}
              onFocus={() => imageResults.length > 0 && setImageOpen(true)}
              placeholder="Search for a theme to set a custom image..."
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
            />
            {imageOpen && imageResults.length > 0 && (
              <div className="absolute z-10 mt-1 w-full rounded-xl border border-zinc-200 bg-white shadow-lg">
                {imageResults.map((r) => (
                  <button
                    key={r.theme}
                    type="button"
                    onClick={() => startEditImage(r.theme)}
                    className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm transition-colors hover:bg-zinc-50 first:rounded-t-xl last:rounded-b-xl"
                  >
                    <span className="text-zinc-900">{r.theme}</span>
                    <span className="text-xs text-zinc-400">{r.set_count} sets</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Excluded Themes */}
      <div className="mt-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-zinc-900">Excluded Themes</h3>
        <p className="mt-1 text-xs text-zinc-500">
          Themes to hide from the /themes browse page entirely.
        </p>

        {/* Theme pills */}
        <div className="mt-3 flex flex-wrap gap-2">
          {excludedThemes.map((theme) => (
            <span
              key={theme}
              className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-sm font-medium text-red-700"
            >
              {theme}
              <button
                type="button"
                onClick={() => removeExcluded(theme)}
                className="ml-0.5 rounded-full p-0.5 text-red-400 transition-colors hover:text-red-600"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </span>
          ))}
          {excludedThemes.length === 0 && (
            <span className="text-xs text-zinc-400">No themes excluded</span>
          )}
        </div>

        {/* Search to add */}
        <div ref={excludeRef} className="relative mt-3">
          <input
            type="text"
            value={excludeQuery}
            onChange={(e) => setExcludeQuery(e.target.value)}
            onFocus={() => excludeResults.length > 0 && setExcludeOpen(true)}
            placeholder="Search for a theme to exclude..."
            className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
          />
          {excludeOpen && excludeResults.length > 0 && (
            <div className="absolute z-10 mt-1 w-full rounded-xl border border-zinc-200 bg-white shadow-lg">
              {excludeResults
                .filter((r) => !excludedThemes.includes(r.theme))
                .map((r) => (
                  <button
                    key={r.theme}
                    type="button"
                    onClick={() => addExcluded(r.theme)}
                    className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm transition-colors hover:bg-zinc-50 first:rounded-t-xl last:rounded-b-xl"
                  >
                    <span className="text-zinc-900">{r.theme}</span>
                    <span className="text-xs text-zinc-400">{r.set_count} sets</span>
                  </button>
                ))}
            </div>
          )}
        </div>
      </div>

      {/* Save */}
      <div className="mt-4">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded-full bg-amber-500 px-5 py-2 text-sm font-semibold text-black transition-colors hover:bg-amber-400 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Theme Settings"}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Admin Component
// ---------------------------------------------------------------------------

const ADMIN_PAGES = [
  { id: "discover", label: "Discover", description: "Section visibility & layout" },
  { id: "new", label: "New Releases", description: "Spotlight & featured themes" },
  { id: "retiring", label: "Retiring Soon", description: "Hidden sets & excluded themes" },
  { id: "themes", label: "Themes", description: "Custom images & excluded themes" },
  { id: "editor", label: "Set Editor", description: "Edit individual set data" },
  { id: "blog", label: "Blog", description: "Write & manage blog articles" },
] as const;

export default function AdminClient() {
  const { token, hydrated } = useAuth();
  const toast = useToast();
  const [activePage, setActivePage] = useState<string | null>(null);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [refreshResult, setRefreshResult] = useState("");

  // Reports
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [reportsError, setReportsError] = useState("");
  const [actioningId, setActioningId] = useState<number | null>(null);

  const fetchReports = useCallback(async () => {
    if (!token) return;
    setReportsLoading(true);
    setReportsError("");
    try {
      const data = await apiFetch<ReportItem[]>("/admin/reports?report_status=pending&limit=50", { token });
      setReports(Array.isArray(data) ? data : []);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!msg.includes("403")) setReportsError(msg);
    } finally {
      setReportsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!hydrated || !token) return;
    let cancelled = false;

    (async () => {
      try {
        const data = await apiFetch<AdminStats>("/admin/stats", { token });
        if (!cancelled) setStats(data);
      } catch (e: unknown) {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : String(e);
          setError(
            msg.includes("403")
              ? "You do not have admin access."
              : `Error loading stats: ${msg}`,
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [hydrated, token]);

  // Fetch reports after stats load
  useEffect(() => {
    if (stats && token) fetchReports();
  }, [stats, token, fetchReports]);

  async function handleRefresh() {
    setRefreshing(true);
    setRefreshResult("");
    try {
      const data = await apiFetch<{
        ok: boolean;
        total?: number;
        inserted?: number;
        updated?: number;
      }>("/admin/sets/refresh", { method: "POST", token });
      setRefreshResult(
        `Refreshed: ${data.total ?? 0} total, ${data.inserted ?? 0} new, ${data.updated ?? 0} updated`,
      );
      const fresh = await apiFetch<AdminStats>("/admin/stats", { token });
      setStats(fresh);
    } catch (e: unknown) {
      setRefreshResult(
        `Refresh failed: ${e instanceof Error ? e.message : String(e)}`,
      );
    } finally {
      setRefreshing(false);
    }
  }

  async function handleSync() {
    setRefreshing(true);
    setRefreshResult("");
    try {
      const data = await apiFetch<{
        ok: boolean;
        total?: number;
        inserted?: number;
        updated?: number;
      }>("/admin/sets/sync", { method: "POST", token });
      setRefreshResult(
        `Synced: ${data.total ?? 0} total, ${data.inserted ?? 0} new, ${data.updated ?? 0} updated`,
      );
      const fresh = await apiFetch<AdminStats>("/admin/stats", { token });
      setStats(fresh);
    } catch (e: unknown) {
      setRefreshResult(
        `Sync failed: ${e instanceof Error ? e.message : String(e)}`,
      );
    } finally {
      setRefreshing(false);
    }
  }

  async function handleReportAction(reportId: number, action: "resolved" | "dismissed") {
    if (actioningId !== null) return;
    setActioningId(reportId);
    try {
      await apiFetch(`/admin/reports/${reportId}`, {
        method: "PATCH",
        token,
        body: { status: action },
      });
      toast.push(`Report ${action}`, { type: "success" });
      setReports((prev) => prev.filter((r) => r.id !== reportId));
    } catch (e: unknown) {
      toast.push(e instanceof Error ? e.message : "Action failed", { type: "error" });
    } finally {
      setActioningId(null);
    }
  }

  return (
    <RequireAuth>
      <div className="mx-auto max-w-3xl px-6 pb-16">
        <h1 className="mt-10 text-2xl font-semibold">Admin Dashboard</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Manage your BrickTrack data and view platform stats.
        </p>

        {loading ? (
          <p className="mt-6 text-sm text-zinc-500">Loading stats...</p>
        ) : error ? (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4">
            <p className="text-sm font-semibold text-red-700">{error}</p>
          </div>
        ) : stats ? (
          <div className="mt-6">
            {/* ─── Home view (no page selected) ─── */}
            {!activePage && (
              <>
                {/* Stats cards */}
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
                  <StatCard label="Total Sets" value={stats.set_count} />
                  <StatCard label="Users" value={stats.user_count} />
                  <StatCard label="Email Signups" value={stats.email_signup_count} />
                  <StatCard label="Reviews" value={stats.review_count} />
                  <StatCard label="Affiliate Clicks" value={stats.affiliate_click_count} />
                </div>

                {/* Page cards */}
                <h2 className="mt-10 text-lg font-semibold">Page Settings</h2>
                <p className="mt-1 text-sm text-zinc-500">
                  Click a page to customize its content and behavior.
                </p>
                <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {ADMIN_PAGES.map((page) => (
                    <button
                      key={page.id}
                      type="button"
                      onClick={() => setActivePage(page.id)}
                      className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm text-left transition-all hover:border-amber-300 hover:shadow-md"
                    >
                      <div className="text-sm font-bold text-zinc-900">{page.label}</div>
                      <div className="mt-1 text-xs text-zinc-500">{page.description}</div>
                    </button>
                  ))}
                </div>

                {/* Content Moderation */}
                <div className="mt-10">
                  <h2 className="text-lg font-semibold">Content Moderation</h2>
                  <p className="mt-1 text-sm text-zinc-500">
                    Review and manage user-submitted reports.
                  </p>

                  {reportsLoading ? (
                    <p className="mt-4 text-sm text-zinc-500">Loading reports...</p>
                  ) : reportsError ? (
                    <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3">
                      <p className="text-sm text-red-700">{reportsError}</p>
                      <button
                        type="button"
                        onClick={() => void fetchReports()}
                        className="mt-2 text-sm font-semibold text-red-700 underline"
                      >
                        Retry
                      </button>
                    </div>
                  ) : reports.length === 0 ? (
                    <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 p-6 text-center">
                      <p className="text-sm text-zinc-500">No pending reports</p>
                    </div>
                  ) : (
                    <div className="mt-4 space-y-3">
                      {reports.map((r) => (
                        <div
                          key={r.id}
                          className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-xs font-semibold uppercase text-zinc-400">
                                  {r.target_type}
                                </span>
                                <ReasonBadge reason={r.reason} />
                                <span className="text-xs text-zinc-400">by {r.reporter}</span>
                              </div>
                              <p className="mt-1 truncate text-sm text-zinc-700">
                                {r.target_snippet || "[content deleted]"}
                              </p>
                              {r.notes ? (
                                <p className="mt-1 text-xs italic text-zinc-500">
                                  &ldquo;{r.notes}&rdquo;
                                </p>
                              ) : null}
                              <p className="mt-1 text-xs text-zinc-400">
                                {new Date(r.created_at).toLocaleDateString()}
                              </p>
                            </div>
                            <div className="flex shrink-0 gap-2">
                              <button
                                type="button"
                                onClick={() => handleReportAction(r.id, "resolved")}
                                disabled={actioningId !== null}
                                className="rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-emerald-500 disabled:opacity-50"
                              >
                                Resolve
                              </button>
                              <button
                                type="button"
                                onClick={() => handleReportAction(r.id, "dismissed")}
                                disabled={actioningId !== null}
                                className="rounded-full border border-zinc-200 px-3 py-1.5 text-xs font-semibold text-zinc-600 transition-colors hover:bg-zinc-100 disabled:opacity-50"
                              >
                                Dismiss
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Data Management */}
                <div className="mt-10">
                  <h2 className="text-lg font-semibold">Data Management</h2>
                  <p className="mt-1 text-sm text-zinc-500">
                    Refresh sets from Rebrickable or sync the local cache to the database.
                  </p>

                  <div className="mt-4 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={handleRefresh}
                      disabled={refreshing}
                      className="rounded-full bg-amber-500 px-5 py-2.5 text-sm font-semibold text-black hover:bg-amber-400 disabled:opacity-50"
                    >
                      {refreshing ? "Working..." : "Refresh Sets from Rebrickable"}
                    </button>

                    <button
                      type="button"
                      onClick={handleSync}
                      disabled={refreshing}
                      className="rounded-full border border-zinc-200 bg-white px-5 py-2.5 text-sm font-semibold hover:bg-zinc-100 disabled:opacity-50"
                    >
                      {refreshing ? "Working..." : "Sync Cache to DB"}
                    </button>
                  </div>

                  {refreshResult && (
                    <p
                      className={`mt-3 text-sm ${
                        refreshResult.includes("failed") ? "text-red-600" : "text-green-700"
                      }`}
                    >
                      {refreshResult}
                    </p>
                  )}
                </div>
              </>
            )}

            {/* ─── Subpage views ─── */}
            {activePage && (
              <>
                <button
                  type="button"
                  onClick={() => setActivePage(null)}
                  className="flex items-center gap-1 text-sm font-medium text-zinc-500 transition-colors hover:text-zinc-800"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                  Back
                </button>

                <div className="mt-4">
                  {activePage === "discover" && token && <DiscoverControlsSection token={token} />}
                  {activePage === "new" && token && <PageControlsSection token={token} />}
                  {activePage === "retiring" && token && <RetiringSoonControlsSection token={token} />}
                  {activePage === "themes" && token && <ThemesControlsSection token={token} />}
                  {activePage === "editor" && token && <SetEditorSection token={token} />}
                  {activePage === "blog" && token && <BlogEditor token={token} />}
                </div>
              </>
            )}
          </div>
        ) : null}
      </div>
    </RequireAuth>
  );
}
