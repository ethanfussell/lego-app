// frontend/src/AccountPage.js
import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "./auth";
import { apiFetch } from "./lib/api";
import Login from "./Login";
import RatingHistogram from "./RatingHistogram";

/* ---------- utils ---------- */

function readSavedListIds() {
  try {
    const raw = localStorage.getItem("saved_list_ids");
    const arr = JSON.parse(raw || "[]");
    return Array.isArray(arr) ? arr.map(String).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function formatRating(rating) {
  if (rating === null || rating === undefined) return "—";
  const n = Number(rating);
  if (Number.isNaN(n)) return "—";
  return n.toFixed(1);
}

/* ---------- small UI bits ---------- */

function StatCard({ label, value, sub, to, children }) {
  const [hover, setHover] = React.useState(false);

  const base = (
    <div
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 16,
        padding: "0.95rem",
        background: "white",
        boxShadow: hover ? "0 10px 22px rgba(15,23,42,0.10)" : "0 1px 2px rgba(15,23,42,0.04)",
        transform: hover ? "translateY(-1px)" : "translateY(0px)",
        transition: "transform 120ms ease, box-shadow 120ms ease",
        display: "grid",
        gap: 6,
        minHeight: 90,
      }}
    >
      <div
        style={{
          fontSize: 12,
          color: "#6b7280",
          fontWeight: 800,
          letterSpacing: "0.03em",
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>

      {children ? (
        children
      ) : (
        <div style={{ fontSize: "1.6rem", fontWeight: 950, lineHeight: "1.1em", color: "#111827" }}>{value}</div>
      )}

      {sub ? <div style={{ fontSize: 13, color: "#6b7280" }}>{sub}</div> : null}
    </div>
  );

  if (!to) return base;

  return (
    <Link
      to={to}
      style={{ textDecoration: "none", color: "inherit", display: "block", cursor: "pointer" }}
      aria-label={label}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setHover(true)}
      onBlur={() => setHover(false)}
      onMouseDown={(e) => e.currentTarget.blur?.()}
    >
      {base}
    </Link>
  );
}

function ActionTile({ title, desc, to }) {
  const [hover, setHover] = React.useState(false);

  return (
    <Link
      to={to}
      style={{
        textDecoration: "none",
        color: "inherit",
        border: "1px solid #e5e7eb",
        borderRadius: 16,
        padding: "1rem",
        background: "white",
        boxShadow: hover ? "0 10px 22px rgba(15,23,42,0.10)" : "0 1px 2px rgba(15,23,42,0.04)",
        transform: hover ? "translateY(-1px)" : "translateY(0px)",
        transition: "transform 120ms ease, box-shadow 120ms ease",
        display: "grid",
        gap: 6,
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setHover(true)}
      onBlur={() => setHover(false)}
      onMouseDown={(e) => e.currentTarget.blur?.()}
    >
      <div style={{ fontWeight: 900, fontSize: "1.05rem" }}>{title}</div>
      <div style={{ color: "#6b7280", fontSize: 14, lineHeight: "1.35em" }}>{desc}</div>
    </Link>
  );
}

function ThemeRow({ theme, count, to }) {
  const [hover, setHover] = React.useState(false);

  return (
    <Link
      to={to}
      style={{ textDecoration: "none", color: "inherit", display: "block", outline: "none" }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setHover(true)}
      onBlur={() => setHover(false)}
      onMouseDown={(e) => e.currentTarget.blur?.()}
    >
      <div
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 14,
          padding: "0.8rem 0.9rem",
          background: "white",
          display: "flex",
          justifyContent: "space-between",
          gap: 10,
          alignItems: "center",
          boxShadow: hover ? "0 10px 22px rgba(15,23,42,0.10)" : "0 1px 2px rgba(15,23,42,0.04)",
          transform: hover ? "translateY(-1px)" : "translateY(0px)",
          transition: "transform 120ms ease, box-shadow 120ms ease",
        }}
      >
        <div style={{ fontWeight: 850, color: "#111827" }}>{theme}</div>
        <div style={{ color: "#6b7280", fontWeight: 800 }}>{count}</div>
      </div>
    </Link>
  );
}

function RecentMiniReviewCard({ r }) {
  const [hover, setHover] = React.useState(false);
  if (!r) return null;

  const setNum = r?.set_num || "";
  const setName = r?.set_name || setNum;
  const rating = formatRating(r?.rating);
  const text = String(r?.text || "").trim();

  const imageUrl = r?.image_url || r?.imageUrl || r?.set_image_url || r?.setImageUrl || null;

  return (
    <Link
      to={`/sets/${encodeURIComponent(setNum)}`}
      style={{ textDecoration: "none", color: "inherit", display: "block", outline: "none" }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setHover(true)}
      onBlur={() => setHover(false)}
      onMouseDown={(e) => e.currentTarget.blur?.()}
    >
      <div
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 16,
          padding: "0.9rem",
          background: "white",
          boxShadow: hover ? "0 10px 22px rgba(15,23,42,0.10)" : "0 1px 2px rgba(15,23,42,0.04)",
          transform: hover ? "translateY(-1px)" : "translateY(0px)",
          transition: "transform 120ms ease, box-shadow 120ms ease",
          display: "grid",
          gridTemplateColumns: "80px 1fr",
          gap: 12,
          alignItems: "start",
        }}
      >
        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: 12,
            overflow: "hidden",
            border: "1px solid #e5e7eb",
            background: "white",
            display: "grid",
            placeItems: "center",
          }}
          aria-hidden
        >
          {imageUrl ? (
            <img
              src={imageUrl}
              alt=""
              style={{
                width: "100%",
                height: "100%",
                objectFit: "contain",
                display: "block",
                background: "white",
              }}
              loading="lazy"
            />
          ) : (
            <div style={{ fontSize: 12, color: "#9ca3af", fontWeight: 800 }}>—</div>
          )}
        </div>

        <div style={{ display: "grid", gap: 6 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10, alignItems: "start" }}>
            <div
              style={{
                fontWeight: 950,
                lineHeight: "1.15em",
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
                minHeight: "2.3em",
              }}
            >
              {setName}
            </div>

            <div style={{ fontWeight: 950, color: "#111827", whiteSpace: "nowrap", fontSize: 16 }}>
              {rating} <span style={{ fontSize: 12, fontWeight: 900 }}>★</span>
            </div>
          </div>

          <div style={{ color: "#6b7280", fontSize: 13 }}>{setNum}</div>

          {text ? (
            <div
              style={{
                color: "#111827",
                fontSize: 14,
                lineHeight: "1.35em",
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {text}
            </div>
          ) : (
            <div style={{ color: "#9ca3af", fontSize: 13 }}>No review text</div>
          )}
        </div>
      </div>
    </Link>
  );
}

/* ---------- page ---------- */

export default function AccountPage() {
  const navigate = useNavigate();
  const { token, me, logout } = useAuth();
  const isLoggedIn = !!token;

  const username = useMemo(() => me?.username || me?.email || "Account", [me]);

  const [owned, setOwned] = useState([]);
  const [wishlist, setWishlist] = useState([]);
  const [customLists, setCustomLists] = useState([]);
  const [publicLists, setPublicLists] = useState([]);

  const [reviewStats, setReviewStats] = useState(null);
  const [reviewStatsLoading, setReviewStatsLoading] = useState(false);
  const [reviewStatsErr, setReviewStatsErr] = useState("");

  const [recentEnriched, setRecentEnriched] = useState([]);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const totalReviews = reviewStats?.total_reviews ?? null;
  const ratedReviews = reviewStats?.rated_reviews ?? null;
  const avgRating = reviewStats?.avg_rating ?? null;
  const recentReviewsRaw = Array.isArray(reviewStats?.recent) ? reviewStats.recent.slice(0, 6) : [];

  const [savedCount, setSavedCount] = useState(() => readSavedListIds().length);

  // update savedCount when localStorage changes (other tabs) AND when this tab dispatches a custom event
  useEffect(() => {
    function refresh() {
      setSavedCount(readSavedListIds().length);
    }

    refresh();
    window.addEventListener("storage", refresh);
    window.addEventListener("saved_lists_updated", refresh);

    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("saved_lists_updated", refresh);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadAll() {
      if (!isLoggedIn) {
        setOwned([]);
        setWishlist([]);
        setCustomLists([]);
        setPublicLists([]);
        setReviewStats(null);
        setReviewStatsErr("");
        setErr("");
        return;
      }

      setLoading(true);
      setErr("");
      setReviewStatsLoading(true);
      setReviewStatsErr("");

      try {
        const [ownedData, wishlistData, custom, pub, stats] = await Promise.all([
          apiFetch("/collections/me/owned", { token }),
          apiFetch("/collections/me/wishlist", { token }),
          apiFetch("/lists/me?include_system=false", { token }),
          apiFetch(`/lists/public?owner=${encodeURIComponent(username)}`),
          apiFetch("/reviews/me/stats", { token }),
        ]);

        if (cancelled) return;

        setOwned(Array.isArray(ownedData) ? ownedData : []);
        setWishlist(Array.isArray(wishlistData) ? wishlistData : []);
        setCustomLists(Array.isArray(custom) ? custom : []);
        setPublicLists(Array.isArray(pub) ? pub : []);
        setReviewStats(stats || null);
      } catch (e) {
        if (cancelled) return;
        const msg = e?.message || String(e);
        setErr(msg);
        setReviewStats(null);
        setReviewStatsErr(msg);
      } finally {
        if (cancelled) return;
        setLoading(false);
        setReviewStatsLoading(false);
      }
    }

    loadAll();
    return () => {
      cancelled = true;
    };
  }, [isLoggedIn, token, username]);

  // enrich recent review cards with images (fallback if stats.recent doesn't include image_url)
  useEffect(() => {
    let cancelled = false;

    async function enrichRecent() {
      if (!token) {
        setRecentEnriched([]);
        return;
      }

      if (!recentReviewsRaw.length) {
        setRecentEnriched([]);
        return;
      }

      const need = recentReviewsRaw
        .filter((r) => !(r?.image_url || r?.imageUrl || r?.set_image_url || r?.setImageUrl))
        .map((r) => r?.set_num)
        .filter(Boolean);

      if (!need.length) {
        setRecentEnriched(recentReviewsRaw);
        return;
      }

      try {
        const qs = encodeURIComponent([...new Set(need)].join(","));
        const sets = await apiFetch(`/sets/bulk?set_nums=${qs}`, { token });

        if (cancelled) return;

        const byNum = new Map((Array.isArray(sets) ? sets : []).map((s) => [s?.set_num, s]));

        const merged = recentReviewsRaw.map((r) => {
          const s = byNum.get(r?.set_num);
          return {
            ...r,
            image_url:
              r?.image_url ||
              r?.imageUrl ||
              r?.set_image_url ||
              r?.setImageUrl ||
              s?.image_url ||
              s?.imageUrl ||
              s?.set_image_url ||
              s?.setImageUrl ||
              null,
          };
        });

        setRecentEnriched(merged);
      } catch {
        if (!cancelled) setRecentEnriched(recentReviewsRaw);
      }
    }

    enrichRecent();
    return () => {
      cancelled = true;
    };
  }, [token, recentReviewsRaw]);

  const ownedCount = owned.length;
  const wishlistCount = wishlist.length;

  const piecesOwned = useMemo(() => {
    let total = 0;
    for (const s of owned) total += Number(s?.pieces || 0);
    return total;
  }, [owned]);

  const avgPieces = ownedCount > 0 ? Math.round(piecesOwned / ownedCount) : 0;

  const topThemes = useMemo(() => {
    const freq = new Map();
    for (const s of owned) {
      const t = String(s?.theme || "").trim();
      if (!t) continue;
      freq.set(t, (freq.get(t) || 0) + 1);
    }
    return [...freq.entries()]
      .sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])))
      .slice(0, 3);
  }, [owned]);

  const recentToShow = recentEnriched.length ? recentEnriched : recentReviewsRaw;

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "1.5rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0 }}>Account</h1>
          <p style={{ marginTop: 6, color: "#666" }}>
            {isLoggedIn ? (
              <>
                Signed in as <strong>{username}</strong>
              </>
            ) : (
              "Log in to see your stats."
            )}
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => navigate("/collection")}
            style={{
              padding: "0.45rem 0.9rem",
              borderRadius: 999,
              border: "1px solid #ddd",
              background: "white",
              cursor: "pointer",
              fontWeight: 800,
            }}
          >
            My Collection
          </button>

          <button
            type="button"
            onClick={() => {
              logout?.();
              navigate("/");
            }}
            style={{
              padding: "0.45rem 0.9rem",
              borderRadius: 999,
              border: "1px solid #ddd",
              background: "white",
              cursor: "pointer",
              fontWeight: 800,
              color: "#b91c1c",
            }}
          >
            Logout
          </button>
        </div>
      </div>

      {!token && (
        <div style={{ marginTop: 14 }}>
          <p style={{ color: "#666" }}>Log in with your fake user (ethan / lego123).</p>
          <Login />
        </div>
      )}

      {token && (
        <>
          <div style={{ marginTop: 18 }}>
            {loading && <p>Loading your stats…</p>}
            {err && <p style={{ color: "red" }}>Error: {err}</p>}
          </div>

          {/* ===================== SUMMARY STATS (8 cards) ===================== */}
          <section style={{ marginTop: 10 }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 12,
              }}
            >
              <StatCard label="Owned sets" value={ownedCount} to="/collection/owned" />
              <StatCard label="Wishlist" value={wishlistCount} to="/collection/wishlist" />

              <StatCard
                label="Pieces owned"
                value={piecesOwned.toLocaleString()}
                sub={ownedCount ? `≈ ${avgPieces.toLocaleString()} pieces / set` : ""}
              />

              <StatCard label="Custom lists" value={customLists.length} sub={`${publicLists.length} public`} to="/account/lists" />

              <StatCard label="Saved lists" value={savedCount} sub="Lists you bookmarked" to="/account/saved-lists" />

              <StatCard
                label="Reviews"
                value={totalReviews == null ? "—" : totalReviews}
                sub={
                  reviewStatsLoading
                    ? "Loading…"
                    : reviewStatsErr
                    ? "Error loading"
                    : `Rated: ${ratedReviews == null ? "—" : ratedReviews} · Avg: ${
                        avgRating == null ? "—" : Number(avgRating).toFixed(2)
                      }`
                }
                to="/account/reviews"
              />

              <StatCard label="Followers" value="0" sub="Coming soon" />
              <StatCard label="Following" value="0" sub="Coming soon" />
            </div>
          </section>

          {/* ===================== REVIEW STATS ===================== */}
          <section style={{ marginTop: "1.75rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
              <div>
                <div style={{ fontWeight: 900 }}>Review stats</div>
                <div style={{ color: "#6b7280", fontSize: 14, marginTop: 4 }}>
                  Your ratings breakdown and recent reviews.
                </div>
              </div>

              <button
                type="button"
                onClick={() => navigate("/account/reviews")}
                style={{
                  padding: "0.35rem 0.9rem",
                  borderRadius: "999px",
                  border: "1px solid #ddd",
                  background: "white",
                  cursor: "pointer",
                  fontWeight: 800,
                }}
              >
                View all reviews
              </button>
            </div>

            {reviewStatsLoading && <p style={{ marginTop: 10 }}>Loading review stats…</p>}
            {reviewStatsErr && <p style={{ marginTop: 10, color: "red" }}>Error: {reviewStatsErr}</p>}

            {!reviewStatsLoading && !reviewStatsErr && reviewStats && (
              <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
                {/* top row */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: 12,
                    alignItems: "stretch",
                  }}
                >
                  <StatCard
                    label="Total reviews"
                    value={totalReviews == null ? "—" : totalReviews}
                    sub="Click to view all"
                    to="/account/reviews"
                  />

                  <StatCard
                    label="Rated reviews"
                    value={ratedReviews == null ? "—" : ratedReviews}
                    sub="Click to view rated"
                    to="/account/reviews?filter=rated"
                  />

                  <div
                    style={{
                      border: "1px solid #e5e7eb",
                      borderRadius: 16,
                      padding: "0.95rem",
                      background: "white",
                      boxShadow: "0 1px 2px rgba(15,23,42,0.04)",
                      minHeight: 90,
                      display: "flex",
                      flexDirection: "column",
                      gap: 8,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
                      <div
                        style={{
                          fontSize: 12,
                          color: "#6b7280",
                          fontWeight: 800,
                          letterSpacing: "0.03em",
                          textTransform: "uppercase",
                        }}
                      >
                        Ratings breakdown
                      </div>

                      <div style={{ fontSize: 13, fontWeight: 900, color: "#111827" }}>
                        Avg {avgRating == null ? "—" : Number(avgRating).toFixed(2)}
                      </div>
                    </div>

                    <div
                      style={{
                        flex: 1,
                        display: "flex",
                        alignItems: "flex-end",
                        justifyContent: "center",
                        paddingBottom: 2,
                        overflow: "hidden",
                      }}
                    >
                      <RatingHistogram
                        histogram={reviewStats.rating_histogram}
                        height={34}
                        barWidth={14}
                        gap={8}
                        showLabels={false}
                        maxWidth={320}
                        paddingY={0}
                        paddingX={0}
                      />
                    </div>
                  </div>
                </div>

                {/* recent reviews */}
                <div>
                  <div style={{ fontWeight: 900, marginBottom: 10 }}>Recent reviews</div>
                  {recentToShow.length === 0 ? (
                    <p style={{ color: "#777", marginTop: 0 }}>No recent reviews.</p>
                  ) : (
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
                        gap: 12,
                      }}
                    >
                      {recentToShow.map((r) => (
                        <RecentMiniReviewCard key={`${r.set_num}-${r.created_at}`} r={r} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>

          {/* ===================== THEMES ===================== */}
          <section style={{ marginTop: "1.75rem" }}>
            <div style={{ fontWeight: 900, marginBottom: 10 }}>Top themes (owned)</div>

            {topThemes.length === 0 ? (
              <p style={{ color: "#777", marginTop: 0 }}>No owned sets yet.</p>
            ) : (
              <div style={{ display: "grid", gap: 8, maxWidth: 520 }}>
                {topThemes.map(([theme, count]) => (
                  <ThemeRow
                    key={theme}
                    theme={theme}
                    count={count}
                    to={`/collection/owned?theme=${encodeURIComponent(theme)}`}
                  />
                ))}
              </div>
            )}
          </section>

          {/* ===================== QUICK ACTIONS ===================== */}
          <section style={{ marginTop: "1.75rem" }}>
            <div style={{ fontWeight: 900, marginBottom: 10 }}>Quick actions</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
              <ActionTile title="Manage my lists" desc="Create + edit your lists." to="/account/lists" />
              <ActionTile
                title="Browse community lists"
                desc="See what other users are building and tracking."
                to="/discover/lists"
              />
              <ActionTile title="Find sets" desc="Search and explore new sets to add." to="/search" />
              <ActionTile title="My reviews" desc="See every set you reviewed (rating + text)." to="/account/reviews" />
            </div>
          </section>
        </>
      )}
    </div>
  );
}