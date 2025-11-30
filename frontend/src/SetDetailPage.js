// frontend/src/SetDetailPage.js
import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";

const API_BASE = "http://localhost:8000";

function SetDetailPage({
  token,
  ownedSetNums,
  wishlistSetNums,
  onMarkOwned,
  onAddWishlist,
}) {
  const { setNum } = useParams();
  const navigate = useNavigate();

  const [setData, setSetData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Reviews state
  const [reviews, setReviews] = useState([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewsError, setReviewsError] = useState(null);

  // -----------------------------------
  // Fetch the set details when setNum changes
  // -----------------------------------
  useEffect(() => {
    async function fetchSet() {
      try {
        setLoading(true);
        setError(null);

        const resp = await fetch(
          `${API_BASE}/sets/${encodeURIComponent(setNum)}`
        );

        if (!resp.ok) {
          const text = await resp.text();
          throw new Error(`Failed to load set (${resp.status}): ${text}`);
        }

        const data = await resp.json();
        setSetData(data);
      } catch (err) {
        console.error("Error loading set details:", err);
        setError(err.message || "Failed to load set details.");
      } finally {
        setLoading(false);
      }
    }

    fetchSet();
  }, [setNum]);

  // -----------------------------------
  // Fetch reviews for this set
  // -----------------------------------
  useEffect(() => {
    async function fetchReviews() {
      try {
        setReviewsLoading(true);
        setReviewsError(null);

        const resp = await fetch(
          `${API_BASE}/sets/${encodeURIComponent(setNum)}/reviews`
        );

        if (!resp.ok) {
          // If your API returns 404 when no reviews, you can treat that as "no reviews yet"
          if (resp.status === 404) {
            setReviews([]);
            return;
          }

          const text = await resp.text();
          throw new Error(`Failed to load reviews (${resp.status}): ${text}`);
        }

        const data = await resp.json();
        // Expecting an array; if not, fall back gracefully
        setReviews(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Error loading reviews:", err);
        setReviewsError(err.message || "Failed to load reviews.");
        setReviews([]);
      } finally {
        setReviewsLoading(false);
      }
    }

    fetchReviews();
  }, [setNum]);

  // -----------------------------------
  // Simple loading / error states
  // -----------------------------------
  if (loading) {
    return (
      <div style={{ padding: "1.5rem" }}>
        <p>Loading set details…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: "1.5rem" }}>
        <p style={{ color: "red" }}>Error: {error}</p>
        <button
          onClick={() => navigate(-1)}
          style={{ marginTop: "0.75rem", padding: "0.4rem 0.8rem" }}
        >
          ← Back
        </button>
      </div>
    );
  }

  if (!setData) {
    return (
      <div style={{ padding: "1.5rem" }}>
        <p>Set not found.</p>
        <button
          onClick={() => navigate(-1)}
          style={{ marginTop: "0.75rem", padding: "0.4rem 0.8rem" }}
        >
          ← Back
        </button>
      </div>
    );
  }

  // Destructure the fields we care about
  const {
    name,
    set_num,
    year,
    pieces,
    theme,
    image_url,
    minifigs,
    rating,
    review_count,
  } = setData;

  // Owned / wishlist flags (based on what App passes in)
  const isOwned =
    ownedSetNums && typeof ownedSetNums.has === "function"
      ? ownedSetNums.has(set_num)
      : false;

  const isInWishlist =
    wishlistSetNums && typeof wishlistSetNums.has === "function"
      ? wishlistSetNums.has(set_num)
      : false;

  // -----------------------------------
  // Render
  // -----------------------------------
  return (
    <div style={{ padding: "1.5rem", maxWidth: "900px", margin: "0 auto" }}>
      <button
        onClick={() => navigate(-1)}
        style={{
          marginBottom: "1rem",
          padding: "0.35rem 0.8rem",
          borderRadius: "999px",
          border: "1px solid #ccc",
          background: "#f9f9f9",
          cursor: "pointer",
          fontSize: "0.9rem",
        }}
      >
        ← Back to results
      </button>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "1.5rem",
          alignItems: "flex-start",
        }}
      >
        {/* Left: image */}
        <div style={{ flex: "0 0 260px", maxWidth: "100%" }}>
          {image_url ? (
            <img
              src={image_url}
              alt={name || set_num}
              style={{
                width: "100%",
                height: "auto",
                borderRadius: "8px",
                border: "1px solid #ddd",
                objectFit: "cover",
              }}
            />
          ) : (
            <div
              style={{
                width: "100%",
                height: "220px",
                borderRadius: "8px",
                border: "1px dashed #ccc",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#888",
                fontSize: "0.9rem",
              }}
            >
              No image available
            </div>
          )}
        </div>

        {/* Right: details */}
        <div style={{ flex: "1 1 260px" }}>
          <h1 style={{ marginTop: 0, marginBottom: "0.25rem" }}>
            {name || "Unknown set"}
          </h1>

          <p style={{ margin: 0, color: "#555", fontSize: "1rem" }}>
            <strong>{set_num}</strong>
            {year && <> · {year}</>}
          </p>

          {theme && (
            <p style={{ margin: "0.5rem 0 0 0", color: "#777" }}>{theme}</p>
          )}

          {/* Little pill stats row */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "0.75rem",
              marginTop: "1rem",
            }}
          >
            {typeof pieces === "number" && (
              <div
                style={{
                  padding: "0.4rem 0.75rem",
                  borderRadius: "999px",
                  background: "#f3f4f6",
                  fontSize: "0.9rem",
                }}
              >
                🧱 {pieces} pieces
              </div>
            )}

            {typeof minifigs === "number" && (
              <div
                style={{
                  padding: "0.4rem 0.75rem",
                  borderRadius: "999px",
                  background: "#f3f4f6",
                  fontSize: "0.9rem",
                }}
              >
                🙂 {minifigs} minifigs
              </div>
            )}

            {typeof rating === "number" && (
              <div
                style={{
                  padding: "0.4rem 0.75rem",
                  borderRadius: "999px",
                  background: "#fef3c7",
                  fontSize: "0.9rem",
                }}
              >
                ⭐ {rating.toFixed(1)}
                {typeof review_count === "number" && (
                  <span style={{ color: "#6b7280", marginLeft: "0.35rem" }}>
                    ({review_count} reviews)
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Your collection actions */}
          <div style={{ marginTop: "1.5rem" }}>
            <h2
              style={{
                margin: 0,
                marginBottom: "0.5rem",
                fontSize: "1.05rem",
              }}
            >
              Your collection
            </h2>

            {!token && (
              <p style={{ marginTop: 0, color: "#666", fontSize: "0.9rem" }}>
                Log in to track this set in your Owned / Wishlist.
              </p>
            )}

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "0.5rem",
                marginTop: "0.25rem",
              }}
            >
              <button
                onClick={() =>
                  token &&
                  onMarkOwned &&
                  typeof onMarkOwned === "function" &&
                  onMarkOwned(set_num)
                }
                disabled={!token || !onMarkOwned || isOwned}
                style={{
                  flex: "0 0 auto",
                  padding: "0.4rem 0.8rem",
                  borderRadius: "999px",
                  border: isOwned ? "none" : "1px solid #ccc",
                  backgroundColor: isOwned ? "#1f883d" : "#f5f5f5",
                  color: isOwned ? "white" : "#333",
                  fontWeight: isOwned ? 600 : 500,
                  cursor: !token || !onMarkOwned || isOwned ? "default" : "pointer",
                }}
              >
                {isOwned ? "Owned ✓" : "Mark Owned"}
              </button>

              <button
                onClick={() =>
                  token &&
                  onAddWishlist &&
                  typeof onAddWishlist === "function" &&
                  onAddWishlist(set_num)
                }
                disabled={!token || !onAddWishlist || isInWishlist}
                style={{
                  flex: "0 0 auto",
                  padding: "0.4rem 0.8rem",
                  borderRadius: "999px",
                  border: isInWishlist ? "none" : "1px solid #ccc",
                  backgroundColor: isInWishlist ? "#b16be3" : "#f5f5f5",
                  color: isInWishlist ? "white" : "#333",
                  fontWeight: isInWishlist ? 600 : 500,
                  cursor:
                    !token || !onAddWishlist || isInWishlist
                      ? "default"
                      : "pointer",
                }}
              >
                {isInWishlist ? "In Wishlist ★" : "Add to Wishlist"}
              </button>
            </div>
          </div>

          {/* Reviews section */}
          <div style={{ marginTop: "2rem" }}>
            <h2
              style={{
                marginTop: 0,
                marginBottom: "0.5rem",
                fontSize: "1.05rem",
              }}
            >
              Reviews
            </h2>

            {reviewsLoading && <p>Loading reviews…</p>}

            {reviewsError && (
              <p style={{ color: "red" }}>Error: {reviewsError}</p>
            )}

            {!reviewsLoading &&
              !reviewsError &&
              reviews.length === 0 && <p>No reviews yet.</p>}

            {!reviewsLoading && !reviewsError && reviews.length > 0 && (
              <ul
                style={{
                  listStyle: "none",
                  padding: 0,
                  margin: 0,
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.75rem",
                }}
              >
                {reviews.map((review, index) => {
                  const key =
                    review.id ||
                    review.review_id ||
                    `${review.set_num || set_num}-${index}`;

                  const author =
                    review.user ||
                    review.username ||
                    review.author ||
                    "Anonymous";

                  const ratingValue =
                    typeof review.rating === "number" ? review.rating : null;

                  const text =
                    review.comment ||
                    review.text ||
                    review.body ||
                    review.content ||
                    "";

                  const created =
                    review.created_at ||
                    review.date ||
                    review.created ||
                    null;

                  return (
                    <li
                      key={key}
                      style={{
                        border: "1px solid #e5e7eb",
                        borderRadius: "8px",
                        padding: "0.75rem",
                        background: "#fafafa",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: "0.5rem",
                          marginBottom: text ? "0.35rem" : 0,
                        }}
                      >
                        <div
                          style={{
                            fontWeight: 500,
                            fontSize: "0.95rem",
                          }}
                        >
                          {author}
                        </div>

                        <div
                          style={{
                            fontSize: "0.9rem",
                            color: "#f59e0b",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {ratingValue !== null
                            ? "⭐".repeat(Math.round(ratingValue)) ||
                              `${ratingValue}/5`
                            : null}
                        </div>
                      </div>

                      {created && (
                        <div
                          style={{
                            fontSize: "0.8rem",
                            color: "#9ca3af",
                            marginBottom: text ? "0.35rem" : 0,
                          }}
                        >
                          {String(created).slice(0, 10)}
                        </div>
                      )}

                      {text && (
                        <p
                          style={{
                            margin: 0,
                            fontSize: "0.9rem",
                            color: "#374151",
                          }}
                        >
                          {text}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default SetDetailPage;