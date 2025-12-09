// frontend/src/SetDetailPage.js
import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import SetCard from "./SetCard";

const API_BASE = "http://localhost:8000";

// Helper: derive username from our fake token format
function getUsernameFromToken(token) {
  if (!token) return null;
  if (token.startsWith("fake-token-for-")) {
    return token.replace("fake-token-for-", "");
  }
  // fallback: sometimes the token might literally be the username
  return token;
}

function SetDetailPage({
  token,
  ownedSetNums,
  wishlistSetNums,
  onMarkOwned,
  onAddWishlist,
  onEnsureOwned,
  myLists,
}) {
  const { setNum } = useParams();
  const navigate = useNavigate();

  const storedToken = localStorage.getItem("lego_token") || "";
  const effectiveToken = token || storedToken || "";
  const isLoggedIn = !!effectiveToken;
  const currentUsername = getUsernameFromToken(effectiveToken);

  // -------------------------------
  // Basic set + reviews state
  // -------------------------------
  const [setDetail, setSetDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [reviews, setReviews] = useState([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewsError, setReviewsError] = useState(null);

  // -------------------------------
  // Rating state
  // -------------------------------
  const [userRating, setUserRating] = useState(null);
  const [hoverRating, setHoverRating] = useState(null);
  const [savingRating, setSavingRating] = useState(false);
  const [ratingError, setRatingError] = useState(null);

  // Global rating summary
  const [avgRating, setAvgRating] = useState(null);
  const [ratingCount, setRatingCount] = useState(0);
  const [ratingSummaryLoading, setRatingSummaryLoading] = useState(false);
  const [ratingSummaryError, setRatingSummaryError] = useState(null);

  // Review text
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewText, setReviewText] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewSubmitError, setReviewSubmitError] = useState(null);

  // Similar sets
  const [similarSets, setSimilarSets] = useState([]);
  const [similarLoading, setSimilarLoading] = useState(false);
  const [similarError, setSimilarError] = useState(null);

  // Ref for horizontal scroll of similar sets
  const similarScrollRef = useRef(null);

  function scrollSimilar(direction) {
    const node = similarScrollRef.current;
    if (!node) return;

    const cardWidth = 240; // approx width of one card + gap
    const delta = direction === "left" ? -cardWidth : cardWidth;

    node.scrollBy({
      left: delta,
      behavior: "smooth",
    });
  }

  // Derived collection state from parent
  const isOwned = ownedSetNums ? ownedSetNums.has(setNum) : false;
  const isInWishlist = wishlistSetNums ? wishlistSetNums.has(setNum) : false;

  // -------------------------------
  // Load set detail + reviews
  // -------------------------------
  useEffect(() => {
    if (!setNum) return;

    async function fetchData() {
      try {
        setLoading(true);
        setError(null);
        setUserRating(null);

        // detail
        const detailResp = await fetch(`${API_BASE}/sets/${setNum}`);
        if (!detailResp.ok) {
          throw new Error(`Failed to load set (status ${detailResp.status})`);
        }
        const detailData = await detailResp.json();
        setSetDetail(detailData);

        // reviews
        setReviewsLoading(true);
        setReviewsError(null);
        const reviewsResp = await fetch(
          `${API_BASE}/sets/${setNum}/reviews?limit=50`
        );
        if (!reviewsResp.ok) {
          throw new Error(
            `Failed to load reviews (status ${reviewsResp.status})`
          );
        }
        const reviewsData = await reviewsResp.json();
        setReviews(reviewsData);

        // If logged in, try to find *your* review and set the stars to match it
        if (currentUsername && Array.isArray(reviewsData)) {
          const mine = reviewsData.find(
            (r) => (r.user || r.username) === currentUsername
          );
          if (mine && typeof mine.rating === "number") {
            setUserRating(mine.rating);
          }
        }
      } catch (err) {
        console.error("Error loading set detail:", err);
        setError(err.message || String(err));
      } finally {
        setLoading(false);
        setReviewsLoading(false);
      }
    }

    fetchData();
  }, [setNum, currentUsername]);

  // -------------------------------
  // Rating summary (avg + count)
  // -------------------------------
  useEffect(() => {
    if (!setNum) return;

    let cancelled = false;

    async function fetchRatingSummary() {
      try {
        setRatingSummaryLoading(true);
        setRatingSummaryError(null);

        const resp = await fetch(`${API_BASE}/sets/${setNum}/rating`);

        if (!resp.ok) {
          if (resp.status === 404) {
            if (!cancelled) {
              setAvgRating(null);
              setRatingCount(0);
            }
            return;
          }
          const text = await resp.text();
          throw new Error(`Rating summary failed (${resp.status}): ${text}`);
        }

        const data = await resp.json(); // { set_num, average, count }
        if (!cancelled) {
          setAvgRating(data.average);
          setRatingCount(data.count);
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Error loading rating summary:", err);
          setRatingSummaryError(err.message || String(err));
        }
      } finally {
        if (!cancelled) {
          setRatingSummaryLoading(false);
        }
      }
    }

    fetchRatingSummary();

    return () => {
      cancelled = true;
    };
  }, [setNum]);

  // -------------------------------
  // Similar sets (by theme)
  // -------------------------------
  useEffect(() => {
    if (!setDetail || !setDetail.theme) {
      setSimilarSets([]);
      return;
    }

    let cancelled = false;

    async function fetchSimilar() {
      try {
        setSimilarLoading(true);
        setSimilarError(null);

        const params = new URLSearchParams();
        // Use theme text as the search query
        params.set("q", setDetail.theme);
        params.set("sort", "rating");
        params.set("order", "desc");
        params.set("page", "1");
        params.set("limit", "24");

        const resp = await fetch(`${API_BASE}/sets?${params.toString()}`);

        if (!resp.ok) {
          const text = await resp.text();
          throw new Error(`Similar sets failed (${resp.status}): ${text}`);
        }

        const data = await resp.json();
        let items = Array.isArray(data) ? data : data.results || [];

        // Filter out the current set
        items = items.filter((s) => s.set_num !== setNum);

        if (!cancelled) {
          setSimilarSets(items.slice(0, 12));
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Error loading similar sets:", err);
          setSimilarError(err.message || String(err));
        }
      } finally {
        if (!cancelled) {
          setSimilarLoading(false);
        }
      }
    }

    fetchSimilar();

    return () => {
      cancelled = true;
    };
  }, [setDetail, setNum]);

  // -------------------------------
  // Handlers: Owned / Wishlist
  // -------------------------------
  function handleMarkOwnedClick() {
    if (!isLoggedIn) {
      alert("Please log in to track your collection.");
      navigate("/login");
      return;
    }
    if (typeof onMarkOwned === "function") {
      onMarkOwned(setNum);
    }
  }

  function handleAddWishlistClick() {
    if (!isLoggedIn) {
      alert("Please log in to track your collection.");
      navigate("/login");
      return;
    }
    if (typeof onAddWishlist === "function") {
      onAddWishlist(setNum);
    }
  }

  // -------------------------------
  // Clear rating
  // -------------------------------
  async function clearRating() {
    if (!isLoggedIn) {
      alert("Please log in to rate this set.");
      navigate("/login");
      return;
    }

    try {
      setSavingRating(true);
      setRatingError(null);

      const resp = await fetch(`${API_BASE}/sets/${setNum}/reviews/me`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${effectiveToken}`,
        },
      });

      if (!resp.ok && resp.status !== 404) {
        const text = await resp.text();
        throw new Error(`Failed to clear rating (${resp.status}): ${text}`);
      }

      setUserRating(null);
      if (currentUsername) {
        setReviews((prev) =>
          prev.filter((r) => (r.user || r.username) !== currentUsername)
        );
      }
    } catch (err) {
      console.error("Error clearing rating:", err);
      setRatingError(err.message || String(err));
    } finally {
      setSavingRating(false);
    }
  }

  // -------------------------------
  // Save rating
  // -------------------------------
  async function saveRating(newRating) {
    if (!isLoggedIn) {
      alert("Please log in to rate this set.");
      navigate("/login");
      return;
    }

    if (newRating == null) return;
    const numericRating = Number(newRating);

    try {
      setSavingRating(true);
      setRatingError(null);

      const payload = {
        rating: numericRating,
        text: null,
      };

      const resp = await fetch(`${API_BASE}/sets/${setNum}/reviews`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${effectiveToken}`,
        },
        body: JSON.stringify(payload),
      });

      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Failed to save rating (${resp.status}): ${text}`);
      }

      const created = await resp.json();

      setReviews((prev) => {
        const others = prev.filter(
          (r) => (r.user || r.username) !== currentUsername
        );
        return [created, ...others];
      });

      setUserRating(numericRating);

      if (typeof onMarkOwned === "function" && !isOwned) {
        onMarkOwned(setNum);
      }
      if (typeof onEnsureOwned === "function") {
        onEnsureOwned(setNum);
      }
    } catch (err) {
      console.error("Error saving rating:", err);
      setRatingError(err.message || String(err));
    } finally {
      setSavingRating(false);
    }
  }

  async function handleStarClick(value) {
    if (!isLoggedIn) {
      alert("Please log in to rate this set.");
      navigate("/login");
      return;
    }

    if (userRating != null && Number(userRating) === Number(value)) {
      await clearRating();
      return;
    }

    setUserRating(value);
    await saveRating(value);
  }

  // -------------------------------
  // Review submit
  // -------------------------------
  async function handleReviewSubmit(e) {
    e.preventDefault();

    if (!isLoggedIn) {
      alert("Please log in to leave a review.");
      navigate("/login");
      return;
    }

    if (!reviewText.trim() && userRating == null) {
      setReviewSubmitError("Please provide a rating, some text, or both.");
      return;
    }

    const numericRating = userRating == null ? null : Number(userRating);

    try {
      setReviewSubmitting(true);
      setReviewSubmitError(null);

      const payload = {
        rating: numericRating,
        text: reviewText.trim() || null,
      };

      const resp = await fetch(`${API_BASE}/sets/${setNum}/reviews`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${effectiveToken}`,
        },
        body: JSON.stringify(payload),
      });

      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Failed to submit review (${resp.status}): ${text}`);
      }

      const created = await resp.json();
      setReviews((prev) => {
        const others = prev.filter(
          (r) => (r.user || r.username) !== currentUsername
        );
        return [created, ...others];
      });

      setReviewText("");
      setShowReviewForm(false);
    } catch (err) {
      console.error("Error submitting review:", err);
      setReviewSubmitError(err.message || String(err));
    } finally {
      setReviewSubmitting(false);
    }
  }

  // -------------------------------
  // Loading / error / not found
  // -------------------------------
  if (loading) {
    return <p style={{ padding: "1.5rem" }}>Loading set…</p>;
  }

  if (error) {
    return (
      <div style={{ padding: "1.5rem" }}>
        <p style={{ color: "red" }}>Error: {error}</p>
        <button onClick={() => navigate(-1)}>← Back</button>
      </div>
    );
  }

  if (!setDetail) {
    return (
      <div style={{ padding: "1.5rem" }}>
        <p>Set not found.</p>
        <button onClick={() => navigate(-1)}>← Back</button>
      </div>
    );
  }

  const { name, year, theme, pieces, image_url, description } = setDetail;
  const isRetired =
    setDetail.status === "retired" ||
    setDetail.is_retired === true ||
    setDetail.retired === true;

  const textReviews = Array.isArray(reviews)
    ? reviews.filter(
        (r) => typeof r.text === "string" && r.text.trim() !== ""
      )
    : [];

  // -------------------------------
  // Render
  // -------------------------------
  return (
    <div style={{ padding: "1.5rem", maxWidth: "1000px", margin: "0 auto" }}>
      {/* Back link */}
      <button
        onClick={() => navigate(-1)}
        style={{
          marginBottom: "1.25rem",
          padding: "0.35rem 0.75rem",
          borderRadius: "999px",
          border: "1px solid #ddd",
          background: "white",
          cursor: "pointer",
          fontSize: "0.9rem",
        }}
      >
        ← Back to results
      </button>

      {/* HERO: image + meta + actions */}
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 360px) minmax(0, 1fr)",
          gap: "2rem",
          alignItems: "flex-start",
        }}
      >
        {/* Left: image in a fixed white box */}
        <div style={{ maxWidth: "360px" }}>
          <div
            style={{
              borderRadius: "16px",
              border: "1px solid #eee",
              background: "white",
              padding: "1.25rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              minHeight: "260px",
            }}
          >
            {image_url ? (
              <img
                src={image_url}
                alt={name || setNum}
                style={{
                  maxWidth: "100%",
                  maxHeight: "320px",
                  objectFit: "contain",
                  display: "block",
                }}
              />
            ) : (
              <div
                style={{
                  width: "100%",
                  paddingTop: "70%",
                  borderRadius: "8px",
                  background:
                    "repeating-linear-gradient(45deg, #eee, #eee 10px, #f8f8f8 10px, #f8f8f8 20px)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#999",
                  fontSize: "0.9rem",
                }}
              >
                No image available
              </div>
            )}
          </div>
        </div>

        {/* Right: title, meta, actions, rating */}
        <div>
          {/* Title + meta */}
          <h1 style={{ margin: "0 0 0.25rem 0" }}>{name || "Unknown set"}</h1>
          <p style={{ margin: 0, color: "#555" }}>
            <strong>{setNum}</strong>
            {year && <> · {year}</>}
          </p>
          {theme && (
            <p style={{ margin: "0.25rem 0 0 0", color: "#777" }}>{theme}</p>
          )}
          {pieces && (
            <p style={{ margin: "0.1rem 0 0 0", color: "#777" }}>
              {pieces} pieces
            </p>
          )}
          {isRetired && (
            <p
              style={{
                marginTop: "0.35rem",
                fontSize: "0.85rem",
                color: "#b45309",
              }}
            >
              ⏳ This set is retired
            </p>
          )}

          {/* Global rating summary */}
          {(ratingSummaryLoading ||
            ratingSummaryError ||
            ratingCount > 0) && (
            <p
              style={{
                marginTop: "0.6rem",
                color: "#444",
                fontSize: "0.9rem",
              }}
            >
              ⭐{" "}
              <strong>
                {ratingSummaryLoading
                  ? "Loading…"
                  : avgRating !== null
                  ? avgRating.toFixed(1)
                  : "—"}
              </strong>{" "}
              {ratingSummaryError ? (
                <span style={{ color: "red" }}>(error loading ratings)</span>
              ) : (
                <span style={{ color: "#777" }}>
                  (
                  {ratingCount === 0
                    ? "no ratings yet"
                    : `${ratingCount} rating${
                        ratingCount === 1 ? "" : "s"
                      }`}
                  )
                </span>
              )}
            </p>
          )}

          {/* Main interaction panel */}
          <section
            style={{
              marginTop: "1rem",
              padding: "0.9rem 1rem",
              borderRadius: "12px",
              border: "1px solid #e0e0e0",
              background: "#fafafa",
              display: "flex",
              flexDirection: "column",
              gap: "0.9rem",
            }}
          >
            {/* OWNED / WISHLIST */}
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "0.5rem",
              }}
            >
              <button
                onClick={handleMarkOwnedClick}
                style={{
                  padding: "0.45rem 0.9rem",
                  borderRadius: "999px",
                  border: isOwned ? "none" : "1px solid #ccc",
                  backgroundColor: isOwned ? "#1f883d" : "#f5f5f5",
                  color: isOwned ? "white" : "#222",
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                {isOwned ? "Owned ✓" : "Mark Owned"}
              </button>

              <button
                onClick={handleAddWishlistClick}
                style={{
                  padding: "0.45rem 0.9rem",
                  borderRadius: "999px",
                  border: isInWishlist ? "none" : "1px solid #ccc",
                  backgroundColor: isInWishlist ? "#b16be3" : "#f5f5f5",
                  color: isInWishlist ? "white" : "#222",
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                {isInWishlist ? "In Wishlist ★" : "Add to Wishlist"}
              </button>
            </div>

            {/* YOUR RATING */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                flexWrap: "wrap",
              }}
            >
              <span style={{ fontSize: "0.9rem", color: "#444" }}>
                Your rating:
              </span>

              <div
                style={{
                  position: "relative",
                  display: "inline-block",
                  fontSize: "1.8rem",
                  cursor: savingRating ? "default" : "pointer",
                  lineHeight: 1,
                  opacity: savingRating ? 0.7 : 1,
                }}
                onMouseMove={(e) => {
                  if (savingRating) return;
                  const rect = e.currentTarget.getBoundingClientRect();
                  const x = e.clientX - rect.left;
                  const relative = x / rect.width;
                  let value = relative * 5;
                  value = Math.round(value * 2) / 2;
                  if (value < 0.5) value = 0.5;
                  if (value > 5) value = 5;
                  setHoverRating(value);
                }}
                onMouseLeave={() => setHoverRating(null)}
                onClick={async (e) => {
                  if (savingRating) return;
                  const rect = e.currentTarget.getBoundingClientRect();
                  const x = e.clientX - rect.left;
                  const relative = x / rect.width;
                  let value = relative * 5;
                  value = Math.round(value * 2) / 2;
                  if (value < 0.5) value = 0.5;
                  if (value > 5) value = 5;
                  await handleStarClick(value);
                }}
              >
                <div style={{ color: "#ccc" }}>★★★★★</div>
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    overflow: "hidden",
                    whiteSpace: "nowrap",
                    color: "#f39c12",
                    width: `${(((hoverRating ?? userRating) || 0) / 5) * 100}%`,
                    pointerEvents: "none",
                  }}
                >
                  ★★★★★
                </div>
              </div>

              {userRating != null && (
                <span style={{ fontSize: "0.9rem", color: "#555" }}>
                  {userRating.toFixed(1)}
                </span>
              )}

              {ratingError && (
                <span style={{ fontSize: "0.85rem", color: "red" }}>
                  {ratingError}
                </span>
              )}
            </div>

            {/* REVIEW TOGGLE + HINT */}
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "0.5rem",
                alignItems: "center",
              }}
            >
              <button
                type="button"
                onClick={() => setShowReviewForm((prev) => !prev)}
                style={{
                  padding: "0.4rem 0.9rem",
                  borderRadius: "999px",
                  border: "1px solid #222",
                  backgroundColor: "#222",
                  color: "white",
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                {showReviewForm ? "Cancel review" : "✍️ Leave a review"}
              </button>

              {!effectiveToken && (
                <span style={{ fontSize: "0.85rem", color: "#777" }}>
                  Log in to rate or review this set.
                </span>
              )}
            </div>
          </section>
        </div>
      </section>

      {/* PRICE COMPARISON SECTION */}
      <section style={{ marginTop: "2rem" }}>
        <h2
          style={{
            margin: 0,
            marginBottom: "0.5rem",
            fontSize: "1.1rem",
          }}
        >
          Shop & price comparison
        </h2>
        <div
          style={{
            borderRadius: "12px",
            border: "1px dashed #d4d4d4",
            padding: "0.9rem 1rem",
            background: "#fafafa",
            fontSize: "0.9rem",
          }}
        >
          {isRetired ? (
            <>
              <p
                style={{ marginTop: 0, marginBottom: "0.5rem", color: "#555" }}
              >
                This set is retired, so live retail prices are limited.
              </p>
              <p style={{ margin: 0, color: "#777" }}>
                Later this section will show secondary-market and used prices
                with affiliate links.
              </p>
            </>
          ) : (
            <>
              <p
                style={{ marginTop: 0, marginBottom: "0.5rem", color: "#555" }}
              >
                Soon you&apos;ll see real-time prices from LEGO, Amazon, and
                other shops right here.
              </p>
              <button
                type="button"
                disabled
                style={{
                  padding: "0.45rem 0.9rem",
                  borderRadius: "999px",
                  border: "none",
                  backgroundColor: "#111827",
                  color: "white",
                  fontWeight: 600,
                  cursor: "not-allowed",
                  fontSize: "0.9rem",
                }}
              >
                Shop now (coming soon)
              </button>
            </>
          )}
        </div>
      </section>

      {/* ABOUT THIS SET */}
      <section style={{ marginTop: "2rem" }}>
        <h2
          style={{
            marginTop: 0,
            marginBottom: "0.5rem",
            fontSize: "1.1rem",
          }}
        >
          About this set
        </h2>
        {description ? (
          <p style={{ marginTop: 0, color: "#444" }}>{description}</p>
        ) : (
          <p style={{ marginTop: 0, color: "#777" }}>
            No description available yet.
          </p>
        )}

        <ul
          style={{
            listStyle: "none",
            padding: 0,
            marginTop: "0.75rem",
            fontSize: "0.9rem",
            color: "#555",
          }}
        >
          {theme && (
            <li>
              <strong>Theme:</strong> {theme}
            </li>
          )}
          {year && (
            <li>
              <strong>Year:</strong> {year}
            </li>
          )}
          {pieces && (
            <li>
              <strong>Pieces:</strong> {pieces}
            </li>
          )}
          <li>
            <strong>Status:</strong> {isRetired ? "Retired" : "Available"}
          </li>
        </ul>
      </section>

      {/* YOUR ACTIVITY */}
      <section style={{ marginTop: "1.75rem" }}>
        <h2
          style={{
            marginTop: 0,
            marginBottom: "0.5rem",
            fontSize: "1.1rem",
          }}
        >
          Your activity
        </h2>

        <div
          style={{
            borderRadius: "12px",
            border: "1px solid #eee",
            padding: "0.9rem 1rem",
            background: "#fafafa",
            fontSize: "0.9rem",
          }}
        >
          <p style={{ marginTop: 0, marginBottom: "0.35rem" }}>
            {isLoggedIn ? (
              <>
                Signed in as <strong>{currentUsername}</strong>.
              </>
            ) : (
              <>You&apos;re browsing as a guest.</>
            )}
          </p>

          <ul
            style={{
              listStyle: "none",
              padding: 0,
              margin: 0,
              color: "#555",
            }}
          >
            <li>
              Collection:{" "}
              {isOwned ? (
                <span>✅ Marked as Owned</span>
              ) : (
                <span>Not in your Owned list yet.</span>
              )}
            </li>
            <li>
              Wishlist:{" "}
              {isInWishlist ? (
                <span>★ In your Wishlist</span>
              ) : (
                <span>Not on your Wishlist.</span>
              )}
            </li>
            <li>
              Rating:{" "}
              {userRating != null ? (
                <span>
                  {userRating.toFixed(1)} ★ (you can update it any time)
                </span>
              ) : (
                <span>You haven&apos;t rated this set yet.</span>
              )}
            </li>
          </ul>

          {isLoggedIn && myLists && myLists.length > 0 && (
            <p
              style={{
                marginTop: "0.7rem",
                marginBottom: 0,
                color: "#666",
              }}
            >
              Later, you&apos;ll be able to add this set to your custom lists
              (you currently have {myLists.length}).
            </p>
          )}
        </div>
      </section>

      {/* REVIEWS */}
      <section style={{ marginTop: "2.5rem" }}>
        <h2
          style={{
            marginBottom: "0.75rem",
            fontSize: "1.1rem",
          }}
        >
          Reviews
        </h2>

        {showReviewForm && (
          <form
            onSubmit={handleReviewSubmit}
            style={{
              marginBottom: "1rem",
              borderRadius: "8px",
              border: "1px solid #e0e0e0",
              padding: "0.75rem 0.9rem",
              background: "#fafafa",
            }}
          >
            <textarea
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
              placeholder="What did you think of this set?"
              style={{
                width: "100%",
                minHeight: "80px",
                padding: "0.5rem",
                borderRadius: "6px",
                border: "1px solid #ccc",
                fontFamily: "inherit",
                fontSize: "0.95rem",
              }}
            />

            {reviewSubmitError && (
              <p style={{ color: "red", marginTop: "0.35rem" }}>
                {reviewSubmitError}
              </p>
            )}

            <button
              type="submit"
              disabled={reviewSubmitting}
              style={{
                marginTop: "0.5rem",
                padding: "0.45rem 0.9rem",
                borderRadius: "999px",
                border: "none",
                backgroundColor: reviewSubmitting ? "#888" : "#1f883d",
                color: "white",
                fontWeight: 600,
                cursor: reviewSubmitting ? "default" : "pointer",
              }}
            >
              {reviewSubmitting ? "Posting…" : "Post review"}
            </button>
          </form>
        )}

        {reviewsLoading && <p>Loading reviews…</p>}
        {reviewsError && (
          <p style={{ color: "red" }}>Error loading reviews: {reviewsError}</p>
        )}

        {!reviewsLoading && !reviewsError && textReviews.length === 0 && (
          <p style={{ color: "#666" }}>No reviews yet. Be the first!</p>
        )}

        {!reviewsLoading && !reviewsError && textReviews.length > 0 && (
          <ul
            style={{
              listStyle: "none",
              padding: 0,
              display: "flex",
              flexDirection: "column",
              gap: "0.75rem",
            }}
          >
            {textReviews.map((r) => (
              <li
                key={r.id ?? `${r.username}-${r.created_at ?? Math.random()}`}
                style={{
                  border: "1px solid #e0e0e0",
                  borderRadius: "8px",
                  padding: "0.75rem 0.9rem",
                  background: "white",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "0.25rem",
                  }}
                >
                  <div style={{ fontSize: "0.9rem", color: "#555" }}>
                    <strong>{r.username || "Anonymous"}</strong>
                  </div>
                  {typeof r.rating === "number" && (
                    <div style={{ fontSize: "0.9rem", color: "#f39c12" }}>
                      {r.rating.toFixed(1)} ★
                    </div>
                  )}
                </div>
                {r.text && (
                  <p
                    style={{
                      margin: 0,
                      fontSize: "0.95rem",
                      color: "#333",
                    }}
                  >
                    {r.text}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* SIMILAR SETS */}
      {(similarLoading ||
        similarError ||
        (similarSets && similarSets.length > 0)) && (
        <section style={{ marginTop: "2.5rem", marginBottom: "1rem" }}>
          <h2
            style={{
              marginTop: 0,
              marginBottom: "0.5rem",
              fontSize: "1.1rem",
            }}
          >
            Similar sets you might like
          </h2>

          {similarLoading && <p>Loading similar sets…</p>}
          {similarError && (
            <p style={{ color: "red" }}>
              Error loading similar sets: {similarError}
            </p>
          )}

          {!similarLoading &&
            !similarError &&
            similarSets &&
            similarSets.length === 0 && (
              <p style={{ color: "#777" }}>
                No similar sets found yet. We&apos;ll improve this later.
              </p>
            )}

          {!similarLoading &&
            !similarError &&
            similarSets &&
            similarSets.length > 0 && (
              <div
                style={{
                  position: "relative",
                  padding: "0 2rem", // space for arrows
                }}
              >
                {/* Left arrow */}
                <button
                  type="button"
                  onClick={() => scrollSimilar("left")}
                  aria-label="Scroll similar sets left"
                  style={{
                    position: "absolute",
                    left: 0,
                    top: "50%",
                    transform: "translateY(-50%)",
                    width: "28px",
                    height: "28px",
                    borderRadius: "999px",
                    border: "1px solid #ddd",
                    background: "white",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                  }}
                >
                  ◀
                </button>

                {/* Scroll container */}
                <div
                  ref={similarScrollRef}
                  style={{
                    overflowX: "auto",
                    paddingBottom: "0.5rem",
                  }}
                >
                  <ul
                    style={{
                      display: "flex",
                      gap: "0.75rem",
                      listStyle: "none",
                      padding: 0,
                      margin: 0,
                    }}
                  >
                    {similarSets.map((s) => (
                      <li
                        key={s.set_num}
                        style={{
                          minWidth: "220px",
                          maxWidth: "220px",
                          flex: "0 0 auto",
                        }}
                      >
                          <SetCard
                            set={s}
                            isOwned={
                              ownedSetNums ? ownedSetNums.has(s.set_num) : false
                            }
                            isInWishlist={
                              wishlistSetNums
                                ? wishlistSetNums.has(s.set_num)
                                : false
                            }
                            onMarkOwned={onMarkOwned}
                            onAddWishlist={onAddWishlist}
                            variant="default"
                          />
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Right arrow */}
                <button
                  type="button"
                  onClick={() => scrollSimilar("right")}
                  aria-label="Scroll similar sets right"
                  style={{
                    position: "absolute",
                    right: 0,
                    top: "50%",
                    transform: "translateY(-50%)",
                    width: "28px",
                    height: "28px",
                    borderRadius: "999px",
                    border: "1px solid #ddd",
                    background: "white",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                  }}
                >
                  ▶
                </button>
              </div>
            )}
        </section>
      )}
    </div>
  );
}

export default SetDetailPage;