"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/app/providers";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/app/ui-providers/ToastProvider";
import RequireAuth from "@/app/components/RequireAuth";

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
// Discover Controls Section
// ---------------------------------------------------------------------------

const DISCOVER_SECTIONS = [
  { id: "quick_explore", label: "Quick Explore" },
  { id: "new_releases", label: "New Releases" },
  { id: "retiring_soon", label: "Retiring Soon" },
  { id: "best_deals", label: "Best Deals" },
  { id: "coming_soon", label: "Coming Soon" },
  { id: "browse_by_theme", label: "Browse by Theme" },
  { id: "top_rated", label: "Top Rated" },
  { id: "featured_lists", label: "Featured Lists" },
  { id: "social", label: "Social" },
  { id: "guides", label: "Guides & Articles" },
] as const;

function DiscoverControlsSection({ token }: { token: string }) {
  const toast = useToast();

  const [hiddenSections, setHiddenSections] = useState<string[]>([]);
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

  async function handleSave() {
    setSaving(true);
    try {
      await apiFetch(`/admin/settings/discover_hidden_sections`, {
        method: "PUT",
        token,
        body: { value: JSON.stringify(hiddenSections) },
      });
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
        Control which sections appear on the /discover page.
      </p>

      {/* Section toggles */}
      <div className="mt-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-zinc-900">Section Visibility</h3>
        <p className="mt-1 text-xs text-zinc-500">
          Toggle sections on or off. Hidden sections won&apos;t appear on the discover page.
        </p>

        <div className="mt-4 space-y-2">
          {DISCOVER_SECTIONS.map((section) => {
            const isVisible = !hiddenSections.includes(section.id);
            return (
              <button
                key={section.id}
                type="button"
                onClick={() => toggleSection(section.id)}
                className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left text-sm transition-colors ${
                  isVisible
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : "border-zinc-200 bg-zinc-50 text-zinc-400"
                }`}
              >
                <span className={`font-medium ${isVisible ? "" : "line-through"}`}>
                  {section.label}
                </span>
                <span className={`text-xs font-semibold ${isVisible ? "text-emerald-600" : "text-zinc-400"}`}>
                  {isVisible ? "Visible" : "Hidden"}
                </span>
              </button>
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
            {saving ? "Saving..." : "Save Visibility"}
          </button>
        </div>
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
  { id: "editor", label: "Set Editor", description: "Edit individual set data" },
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
                  {activePage === "editor" && token && <SetEditorSection token={token} />}
                </div>
              </>
            )}
          </div>
        ) : null}
      </div>
    </RequireAuth>
  );
}
