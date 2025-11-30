// frontend/src/SetDetailPage.js
import React, { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";

const API_BASE = "http://localhost:8000";

function SetDetailPage({ token }) {
  const { setNum } = useParams();
  const navigate = useNavigate();

  const [setDetail, setSetDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Collection state for THIS set
  const [isOwned, setIsOwned] = useState(false);
  const [isInWishlist, setIsInWishlist] = useState(false);

  // Reviews state
  const [reviews, setReviews] = useState([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewsError, setReviewsError] = useState(null);

  // New: review form + “Letterboxd-style” panel UI
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [newRating, setNewRating] = useState(5);
  const [newText, setNewText] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewSubmitError, setReviewSubmitError] = useState(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        setError(null);

        // 1) Fetch set details
        const detailResp = await fetch(`${API_BASE}/sets/${setNum}`);
        if (!detailResp.ok) {
          throw new Error(`Failed to load set (status ${detailResp.status})`);
        }
        const detailData = await detailResp.json();
        setSetDetail(detailData);

        // 2) Fetch reviews
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

        // 3) If logged in, check if this set is in Owned / Wishlist
        if (token) {
          try {
            const ownedResp = await fetch(
              `${API_BASE}/collections/me/owned`,
              {
                headers: { Authorization: `Bearer ${token}` },
              }
            );
            if (ownedResp.ok) {
              const ownedData = await ownedResp.json();
              const ownedNums = new Set(
                ownedData.map((item) => item.set_num)
              );
              setIsOwned(ownedNums.has(setNum));
            }

            const wishlistResp = await fetch(
              `${API_BASE}/collections/me/wishlist`,
              {
                headers: { Authorization: `Bearer ${token}` },
              }
            );
            if (wishlistResp.ok) {
              const wishlistData = await wishlistResp.json();
              const wishlistNums = new Set(
                wishlistData.map((item) => item.set_num)
              );
              setIsInWishlist(wishlistNums.has(setNum));
            }
          } catch (innerErr) {
            console.warn("Error checking collections state:", innerErr);
          }
        } else {
          setIsOwned(false);
          setIsInWishlist(false);
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
  }, [setNum, token]);

  // -------------------------------
  // Collection handlers
  // -------------------------------
  async function handleMarkOwned() {
    if (!token) {
      alert("Please log in to track your collection.");
      navigate("/login");
      return;
    }

    try {
      const resp = await fetch(`${API_BASE}/collections/owned`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ set_num: setNum }),
      });

      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Failed to mark owned (${resp.status}): ${text}`);
      }

      setIsOwned(true);
    } catch (err) {
      console.error("Error marking owned:", err);
      alert(err.message);
    }
  }

  async function handleAddWishlist() {
    if (!token) {
      alert("Please log in to track your collection.");
      navigate("/login");
      return;
    }

    try {
      const resp = await fetch(`${API_BASE}/collections/wishlist`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ set_num: setNum }),
      });

      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(
          `Failed to add to wishlist (${resp.status}): ${text}`
        );
      }

      setIsInWishlist(true);
    } catch (err) {
      console.error("Error adding to wishlist:", err);
      alert(err.message);
    }
  }

  // -------------------------------
  // Review submit handler
  // -------------------------------
  async function handleReviewSubmit(e) {
    e.preventDefault();

    if (!token) {
      alert("Please log in to leave a review.");
      navigate("/login");
      return;
    }

    if (!newText.trim()) {
      setReviewSubmitError("Please write something in your review.");
      return;
    }

    try {
      setReviewSubmitting(true);
      setReviewSubmitError(null);

      const payload = {
        rating: newRating,
        text: newText.trim(),
      };

      const resp = await fetch(`${API_BASE}/sets/${setNum}/reviews`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Failed to submit review (${resp.status}): ${text}`);
      }

      const created = await resp.json();

      // Prepend new review to list
      setReviews((prev) => [created, ...prev]);

      // Reset form
      setNewRating(5);
      setNewText("");
      setShowReviewForm(false);
    } catch (err) {
      console.error("Error submitting review:", err);
      setReviewSubmitError(err.message || String(err));
    } finally {
      setReviewSubmitting(false);
    }
  }

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

  // Basic stats
  const {
    name,
    year,
    theme,
    pieces,
    image_url,
    description,
    avg_rating,
    num_reviews,
  } = setDetail;

  return (
    <div style={{ padding: "1.5rem", maxWidth: "900px", margin: "0 auto" }}>
      {/* Top meta bar */}
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
        {/* Left: Image */}
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

        {/* Right: Title + meta + collection/review panel */}
        <div>
          <h1 style={{ margin: "0 0 0.25rem 0" }}>
            {name || "Unknown set"}
          </h1>
          <p style={{ margin: 0, color: "#555" }}>
            <strong>{setNum}</strong>
            {year && <> · {year}</>}
          </p>
          {theme && (
            <p style={{ margin: "0.25rem 0 0 0", color: "#777" }}>{theme}</p>
          )}
          {pieces && (
            <p style={{ margin: "0.25rem 0 0 0", color: "#777" }}>
              {pieces} pieces
            </p>
          )}

          {/* Average rating summary */}
          {(avg_rating || num_reviews > 0) && (
            <p style={{ marginTop: "0.75rem", color: "#444" }}>
              ⭐{" "}
              <strong>
                {avg_rating ? avg_rating.toFixed(1) : "—"}
              </strong>{" "}
              {num_reviews ? (
                <span style={{ color: "#777" }}>
                  ({num_reviews} review{num_reviews === 1 ? "" : "s"})
                </span>
              ) : (
                <span style={{ color: "#777" }}>(no reviews yet)</span>
              )}
            </p>
          )}

          {/* Letterboxd-style collection & review panel */}
          <section
            style={{
              marginTop: "1rem",
              padding: "0.9rem 1rem",
              borderRadius: "12px",
              border: "1px solid #e0e0e0",
              background: "#fafafa",
              display: "flex",
              flexDirection: "column",
              gap: "0.75rem",
            }}
          >
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "0.5rem",
              }}
            >
              {/* Owned pill */}
              <button
                onClick={handleMarkOwned}
                disabled={isOwned}
                style={{
                  padding: "0.45rem 0.9rem",
                  borderRadius: "999px",
                  border: isOwned ? "none" : "1px solid #ccc",
                  backgroundColor: isOwned ? "#1f883d" : "white",
                  color: isOwned ? "white" : "#222",
                  fontWeight: 500,
                  cursor: isOwned ? "default" : "pointer",
                }}
              >
                {isOwned ? "Owned ✓" : "Mark Owned"}
              </button>

              {/* Wishlist pill */}
              <button
                onClick={handleAddWishlist}
                disabled={isInWishlist}
                style={{
                  padding: "0.45rem 0.9rem",
                  borderRadius: "999px",
                  border: isInWishlist ? "none" : "1px solid #ccc",
                  backgroundColor: isInWishlist ? "#b16be3" : "white",
                  color: isInWishlist ? "white" : "#222",
                  fontWeight: 500,
                  cursor: isInWishlist ? "default" : "pointer",
                }}
              >
                {isInWishlist ? "In Wishlist ★" : "Add to Wishlist"}
              </button>

              {/* Add to List… (UI only for now) */}
              <button
                type="button"
                style={{
                  padding: "0.45rem 0.9rem",
                  borderRadius: "999px",
                  border: "1px solid #ccc",
                  backgroundColor: "white",
                  color: "#222",
                  fontWeight: 500,
                  cursor: "pointer",
                }}
                onClick={() => {
                  alert(
                    "Add to List… coming soon! (We’ll hook this up to your lists next.)"
                  );
                }}
              >
                ➕ Add to List…
              </button>
            </div>

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

              {!token && (
                <span style={{ fontSize: "0.85rem", color: "#777" }}>
                  Log in to rate or review this set.
                </span>
              )}
            </div>

            {showReviewForm && (
              <form onSubmit={handleReviewSubmit} style={{ marginTop: "0.5rem" }}>
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "0.75rem",
                    alignItems: "center",
                    marginBottom: "0.5rem",
                  }}
                >
                  <label style={{ fontSize: "0.9rem" }}>
                    Rating:{" "}
                    <select
                      value={newRating}
                      onChange={(e) => setNewRating(Number(e.target.value))}
                      style={{ padding: "0.2rem 0.4rem", marginLeft: "0.25rem" }}
                    >
                      {[1, 2, 3, 4, 5].map((n) => (
                        <option key={n} value={n}>
                          {n} star{n === 1 ? "" : "s"}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <textarea
                  value={newText}
                  onChange={(e) => setNewText(e.target.value)}
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
                  {reviewSubmitting ? "Submitting…" : "Post review"}
                </button>
              </form>
            )}
          </section>

          {description && (
            <p style={{ marginTop: "1rem", color: "#444" }}>{description}</p>
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
          <p style={{ color: "red" }}>Error loading reviews: {reviewsError}</p>
        )}

        {!reviewsLoading && !reviewsError && reviews.length === 0 && (
          <p style={{ color: "#666" }}>No reviews yet. Be the first!</p>
        )}

        {!reviewsLoading && !reviewsError && reviews.length > 0 && (
          <ul
            style={{
              listStyle: "none",
              padding: 0,
              display: "flex",
              flexDirection: "column",
              gap: "0.75rem",
            }}
          >
            {reviews.map((r) => (
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
                      {"⭐".repeat(r.rating)}
                    </div>
                  )}
                </div>
                {r.text && (
                  <p style={{ margin: 0, fontSize: "0.95rem", color: "#333" }}>
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