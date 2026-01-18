// frontend/src/MyReviewsPage.js
import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "./auth";
import { apiFetch } from "./lib/api";
import Login from "./Login";
import RatingHistogram from "./RatingHistogram";

function formatRating(rating) {
  if (rating === null || rating === undefined) return "—";
  const n = Number(rating);
  if (Number.isNaN(n)) return "—";
  return n.toFixed(1);
}

function formatDate(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString();
  } catch {
    return "";
  }
}

function MiniStat({ label, value, sub, to }) {
  const base = (
    <div
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 14,
        padding: "0.75rem 0.85rem",
        background: "white",
        boxShadow: "0 1px 2px rgba(15,23,42,0.04)",
        display: "grid",
        gap: 4,
        minHeight: 70,
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
      <div style={{ fontSize: 18, fontWeight: 950, lineHeight: "1.1em", color: "#111827" }}>
        {value}
      </div>
      {sub ? <div style={{ fontSize: 12, color: "#6b7280" }}>{sub}</div> : null}
    </div>
  );

  if (!to) return base;

  return (
    <Link
      to={to}
      style={{
        textDecoration: "none",
        color: "inherit",
        display: "block",
        outline: "none",
      }}
      onMouseDown={(e) => e.currentTarget.blur?.()}
    >
      {base}
    </Link>
  );
}

function MiniSetReviewCard({ r }) {
  const setNum = r?.set_num || "";
  const setName = r?.set_name || "Unknown set";
  const rating = formatRating(r?.rating);
  const text = String(r?.text || "").trim();
  const when = formatDate(r?.updated_at || r?.created_at);

  const imageUrl = r?.image_url || r?.imageUrl || r?.set_image_url || r?.setImageUrl || null;

  return (
    <Link
      to={`/sets/${encodeURIComponent(setNum)}`}
      style={{
        textDecoration: "none",
        color: "inherit",
        display: "block",
        outline: "none",
      }}
      onMouseDown={(e) => e.currentTarget.blur?.()}
    >
      <div
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 16,
          padding: "0.9rem",
          background: "white",
          boxShadow: "0 1px 2px rgba(15,23,42,0.04)",
          display: "grid",
          gridTemplateColumns: "72px 1fr",
          gap: 12,
          alignItems: "start",
          transition: "transform 120ms ease, box-shadow 120ms ease",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.boxShadow = "0 10px 22px rgba(15,23,42,0.10)";
          e.currentTarget.style.transform = "translateY(-1px)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.boxShadow = "0 1px 2px rgba(15,23,42,0.04)";
          e.currentTarget.style.transform = "translateY(0px)";
        }}
      >
        {/* thumbnail */}
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: 12,
            overflow: "hidden",
            border: "1px solid #e5e7eb",
            background: "#white",
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
                background: "#white",
              }}
              loading="lazy"
            />
          ) : (
            <div style={{ fontSize: 12, color: "#9ca3af", fontWeight: 800 }}>—</div>
          )}
        </div>

        {/* content */}
        <div style={{ display: "grid", gap: 6 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
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

            <div style={{ fontWeight: 950, color: "#111827", whiteSpace: "nowrap" }}>
              {rating} <span style={{ fontSize: 12, fontWeight: 900 }}>★</span>
            </div>
          </div>

          <div style={{ color: "#6b7280", fontSize: 13 }}>
            {setNum} {when ? `• ${when}` : ""}
          </div>

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

export default function MyReviewsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const { token, me } = useAuth();
  const isLoggedIn = !!token;

  const username = useMemo(() => me?.username || me?.email || "Account", [me]);

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const [stats, setStats] = useState(null);
  const [statsErr, setStatsErr] = useState("");

  // URL-driven filters
  const filterParam = (searchParams.get("filter") || "").toLowerCase();
  const [onlyRated, setOnlyRated] = useState(filterParam.includes("rated"));
  const [onlyWithText, setOnlyWithText] = useState(filterParam.includes("text"));

  useEffect(() => {
    setOnlyRated(filterParam.includes("rated"));
    setOnlyWithText(filterParam.includes("text"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterParam]);

  function pushFilterParams(nextOnlyRated, nextOnlyWithText) {
    let f = "";
    if (nextOnlyRated && nextOnlyWithText) f = "rated_text";
    else if (nextOnlyRated) f = "rated";
    else if (nextOnlyWithText) f = "text";
    else f = "";

    const next = new URLSearchParams(searchParams);
    if (!f) next.delete("filter");
    else next.set("filter", f);

    setSearchParams(next, { replace: true });
  }

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!isLoggedIn) {
        setRows([]);
        setStats(null);
        setErr("");
        setStatsErr("");
        return;
      }

      setLoading(true);
      setErr("");
      setStatsErr("");

      try {
        const [reviewsData, statsData] = await Promise.all([
          apiFetch("/sets/reviews/me?limit=200", { token }),
          apiFetch("/reviews/me/stats", { token }),
        ]);

        if (cancelled) return;

        setRows(Array.isArray(reviewsData) ? reviewsData : []);
        setStats(statsData || null);
      } catch (e) {
        if (cancelled) return;
        const msg = e?.message || String(e);
        setErr(msg);
        setStats(null);
        setStatsErr(msg);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [isLoggedIn, token]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (onlyRated && (r?.rating === null || r?.rating === undefined)) return false;
      if (onlyWithText && !String(r?.text || "").trim()) return false;
      return true;
    });
  }, [rows, onlyRated, onlyWithText]);

  const totalReviews = stats?.total_reviews ?? rows.length ?? 0;
  const ratedReviews = stats?.rated_reviews ?? null;
  const avgRating = stats?.avg_rating ?? null;

  // Total reviews should ALWAYS be clickable:
  // - If any filter is active -> clicking clears filters (goes to base page)
  // - If no filter is active -> clicking still “does something” (goes to base page)
  const totalReviewsTo = "?";

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "1.5rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0 }}>My Reviews</h1>
          <p style={{ marginTop: 6, color: "#666" }}>
            {isLoggedIn ? (
              <>
                Reviews by <strong>{username}</strong>
              </>
            ) : (
              "Log in to see your reviews."
            )}
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => navigate("/account")}
            style={{
              padding: "0.45rem 0.9rem",
              borderRadius: 999,
              border: "1px solid #ddd",
              background: "white",
              cursor: "pointer",
              fontWeight: 800,
            }}
          >
            ← Back to Account
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
        {/* Mini review stats + breakdown */}
        <section style={{ marginTop: 14 }}>
          <div
            style={{
              display: "flex",
              gap: 12,
              flexWrap: "wrap",
              alignItems: "stretch",
            }}
          >
            {/* Total reviews (always clickable) */}
            <div style={{ flex: "1 1 220px", minWidth: 220 }}>
              <MiniStat
                label="Total reviews"
                value={totalReviews}
                sub={(onlyRated || onlyWithText) ? "Click to clear filters" : "Click to view all"}
                to="/account/reviews"
              />
            </div>

            {/* Rated reviews (toggle) */}
            <div style={{ flex: "1 1 220px", minWidth: 220 }}>
              <MiniStat
                label="Rated reviews"
                value={ratedReviews == null ? "—" : ratedReviews}
                sub={onlyRated && !onlyWithText ? "Click to clear filter" : "Click to filter"}
                to={onlyRated && !onlyWithText ? "/account/reviews" : "?filter=rated"}
              />
            </div>

            {/* Ratings (wide) */}
            <div style={{ flex: "2 1 360px", minWidth: 320 }}>
              <div
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: 14,
                  padding: "0.75rem 0.85rem",
                  background: "white",
                  boxShadow: "0 1px 2px rgba(15,23,42,0.04)",
                  display: "grid",
                  gridTemplateColumns: "140px 1fr",
                  gap: 12,
                  alignItems: "center",
                  minHeight: 70,
                }}
              >
                {/* left: label + avg */}
                <div style={{ display: "grid", gap: 6 }}>
                  <div
                    style={{
                      fontSize: 12,
                      color: "#6b7280",
                      fontWeight: 800,
                      letterSpacing: "0.03em",
                      textTransform: "uppercase",
                    }}
                  >
                    Ratings
                  </div>

                  <div style={{ fontSize: 18, fontWeight: 950, color: "#111827", lineHeight: "1.1em" }}>
                    {avgRating == null ? "—" : Number(avgRating).toFixed(2)}
                    <span style={{ fontSize: 12, fontWeight: 800, color: "#6b7280", marginLeft: 6 }}>avg</span>
                  </div>
                </div>

                {/* right: histogram centered */}
                <div style={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
                  {statsErr ? (
                    <div style={{ color: "red", fontSize: 13 }}>Error loading</div>
                  ) : stats?.rating_histogram ? (
                    <RatingHistogram
                      histogram={stats.rating_histogram}
                      height={52}
                      barWidth={18}
                      gap={8}
                      showLabels={false}
                      maxWidth={420}
                      
                    />
                  ) : (
                    <div style={{ color: "#6b7280", fontSize: 13 }}>Loading…</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

          {/* Filters */}
          <section
            style={{
              marginTop: 14,
              display: "flex",
              gap: 10,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <label style={{ display: "flex", gap: 8, alignItems: "center", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={onlyRated}
                onChange={(e) => {
                  const next = e.target.checked;
                  setOnlyRated(next);
                  pushFilterParams(next, onlyWithText);
                }}
              />
              <span style={{ fontWeight: 800, color: "#111827" }}>Only rated</span>
            </label>

            <label style={{ display: "flex", gap: 8, alignItems: "center", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={onlyWithText}
                onChange={(e) => {
                  const next = e.target.checked;
                  setOnlyWithText(next);
                  pushFilterParams(onlyRated, next);
                }}
              />
              <span style={{ fontWeight: 800, color: "#111827" }}>Only with text</span>
            </label>

            <div style={{ marginLeft: "auto", color: "#6b7280", fontWeight: 800 }}>
              Showing <strong>{filtered.length}</strong> of <strong>{rows.length}</strong>
            </div>
          </section>

          <div style={{ marginTop: 14 }}>
            {loading && <p>Loading your reviews…</p>}
            {err && <p style={{ color: "red" }}>Error: {err}</p>}
          </div>

          {!loading && !err && filtered.length === 0 && (
            <p style={{ color: "#777" }}>No reviews yet (or filters removed them).</p>
          )}

          {!loading && !err && filtered.length > 0 && (
            <div
              style={{
                marginTop: 12,
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
                gap: 12,
              }}
            >
              {filtered.map((r) => (
                <MiniSetReviewCard key={(r?.set_num || "") + (r?.created_at || "")} r={r} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}