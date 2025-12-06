// frontend/src/SetDetailPage.js
import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";

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
}) {
  const { setNum } = useParams();
  const navigate = useNavigate();


  // Prefer prop token, fall back to localStorage
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
  const [ratingSaveMessage, setRatingSaveMessage] = useState("");

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
  }, [setNum]);

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
  // Handlers: Owned / Wishlist
  // -------------------------------
  function handleMarkOwnedClick() {
    if (!isLoggedIn) {
      alert("Please log in to track your collection.");
      navigate("/login");
      return;
    }
    if (typeof onEnsureOwned === "function") {
      onEnsureOwned(setNum);
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
  // Rating-only handler
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
        text: null, // rating-only here
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

      // Update local reviews so your own review stays in sync
      setReviews((prev) => {
        const others = prev.filter(
          (r) => (r.user || r.username) !== currentUsername
        );
        return [created, ...others];
      });

      // ✅ Only ensure it's owned; do NOT toggle
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
  // -------------------------------
  // Review handler (rating + text)
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
      setReviews((prev) => [created, ...prev]);

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

  // Only show reviews that have text
  const textReviews = Array.isArray(reviews)
    ? reviews.filter(
        (r) => typeof r.text === "string" && r.text.trim() !== ""
      )
    : [];

  // -------------------------------
  // Render
  // -------------------------------
  return (
    <div style={{ padding: "1.5rem", maxWidth: "900px", margin: "0 auto" }}>
      <button
        onClick={() => navigate(-1)}
        style={{
          marginBottom: "1rem",
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

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 280px) minmax(0, 1fr)",
          gap: "1.5rem",
          alignItems: "flex-start",
        }}
      >
        {/* Left: image */}
        <div>
          {image_url ? (
            <img
              src={image_url}
              alt={name || setNum}
              style={{
                width: "100%",
                borderRadius: "8px",
                objectFit: "cover",
                background: "#f5f5f5",
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

        {/* Right: meta + collection + rating/review */}
        <div>
          <h1 style={{ margin: "0 0 0.25rem 0" }}>
            {name || "Unknown set"}
          </h1>
          <p style={{ margin: 0, color: "#555" }}>
            <strong>{setNum}</strong>
            {year && <> · {year}</>}
          </p>
          {theme && (
            <p style={{ margin: "0.25rem 0 0 0", color: "#777" }}>
              {theme}
            </p>
          )}
          {pieces && (
            <p style={{ margin: "0.25rem 0 0 0", color: "#777" }}>
              {pieces} pieces
            </p>
          )}

          {/* Global rating summary */}
          {(ratingSummaryLoading ||
            ratingSummaryError ||
            ratingCount > 0) && (
            <p style={{ marginTop: "0.75rem", color: "#444" }}>
              ⭐{" "}
              <strong>
                {ratingSummaryLoading
                  ? "Loading…"
                  : avgRating !== null
                  ? avgRating.toFixed(1)
                  : "—"}
              </strong>{" "}
              {ratingSummaryError ? (
                <span style={{ color: "red" }}>
                  (error loading ratings)
                </span>
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

          {/* Letterboxd-style panel */}
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
                type="button"
                onClick={handleMarkOwnedClick}
                style={{
                  padding: "0.45rem 0.9rem",
                  borderRadius: "999px",
                  border: isOwned ? "none" : "1px solid #ccc",
                  backgroundColor: isOwned ? "#1f883d" : "white",
                  color: isOwned ? "white" : "#222",
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                {isOwned ? "Owned ✓" : "Mark Owned"}
              </button>

              <button
                type="button"
                onClick={handleAddWishlistClick}
                style={{
                  padding: "0.45rem 0.9rem",
                  borderRadius: "999px",
                  border: isInWishlist ? "none" : "1px solid #ccc",
                  backgroundColor: isInWishlist ? "#b16be3" : "white",
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

              {/* 5-star bar with 0.5 increments via mouse position */}
              <div
                style={{
                  position: "relative",
                  display: "inline-block",
                  fontSize: "1.8rem",
                  cursor: "pointer",
                  lineHeight: 1,
                }}
                onMouseMove={(e) => {
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
                  const rect = e.currentTarget.getBoundingClientRect();
                  const x = e.clientX - rect.left;
                  const relative = x / rect.width;
                  let value = relative * 5;

                  value = Math.round(value * 2) / 2;
                  if (value < 0.5) value = 0.5;
                  if (value > 5) value = 5;

                  // 🔁 Clicking the same value again clears your rating (but NOT owned)
                  if (userRating != null && Math.abs(userRating - value) < 0.01) {
                    setUserRating(null);

                    // delete just your review
                    if (isLoggedIn) {
                      try {
                        const resp = await fetch(
                          `${API_BASE}/sets/${setNum}/reviews/me`,
                          {
                            method: "DELETE",
                            headers: {
                              Authorization: `Bearer ${effectiveToken}`,
                            },
                          }
                        );

                        if (!resp.ok && resp.status !== 404) {
                          const text = await resp.text();
                          throw new Error(
                            `Failed to clear rating (${resp.status}): ${text}`
                          );
                        }

                        // remove from local reviews
                        setReviews((prev) =>
                          prev.filter((r) => (r.user || r.username) !== currentUsername)
                        );
                      } catch (err) {
                        console.error("Error clearing rating:", err);
                        setRatingError(err.message || String(err));
                      }
                    }

                    return;
                  }

                  // Normal path: update rating
                  setUserRating(value);
                  await saveRating(value);
                }}
              >
                {/* grey base */}
                <div style={{ color: "#ccc" }}>★★★★★</div>

                {/* gold overlay */}
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


            {/* REVIEW TOGGLE + FORM */}
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

            {showReviewForm && (
              <form onSubmit={handleReviewSubmit}>
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
          </section>

          {description && (
            <p style={{ marginTop: "1rem", color: "#444" }}>
              {description}
            </p>
          )}
        </div>
      </div>

      {/* Reviews list */}
      <section style={{ marginTop: "2rem" }}>
        <h2
          style={{
            marginBottom: "0.75rem",
            fontSize: "1.1rem",
          }}
        >
          Reviews
        </h2>

        {reviewsLoading && <p>Loading reviews…</p>}
        {reviewsError && (
          <p style={{ color: "red" }}>
            Error loading reviews: {reviewsError}
          </p>
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
    </div>
  );
}

export default SetDetailPage;