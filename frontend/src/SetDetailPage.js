// frontend/src/SetDetailPage.js
import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";

const API_BASE = "http://localhost:8000";

// 5-star rating with half-star support
function StarRating({ value = 0, editable = false, onChange }) {
  const starSlots = [1, 2, 3, 4, 5];

  const handleClick = (slot, half) => {
    if (!editable || !onChange) return;
    const newVal = half ? slot - 0.5 : slot;
    onChange(newVal);
  };

  return (
    <div style={{ display: "inline-flex", gap: "2px" }}>
      {starSlots.map((slot) => {
        const full = value >= slot;
        const half = !full && value >= slot - 0.5;

        return (
          <div
            key={slot}
            style={{
              position: "relative",
              width: "22px",
              height: "22px",
              fontSize: "22px",
              lineHeight: "22px",
              color: "#ccc",
              cursor: editable ? "pointer" : "default",
              display: "inline-block",
            }}
          >
            {/* empty star */}
            <span
              style={{
                position: "absolute",
                inset: 0,
                textAlign: "center",
              }}
            >
              ☆
            </span>

            {/* full star */}
            {full && (
              <span
                style={{
                  position: "absolute",
                  inset: 0,
                  textAlign: "center",
                  color: "#f5a623",
                }}
              >
                ★
              </span>
            )}

            {/* half star */}
            {half && (
              <span
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "50%",
                  overflow: "hidden",
                  color: "#f5a623",
                }}
              >
                ★
              </span>
            )}

            {/* click targets: left = half, right = full */}
            {editable && (
              <>
                <div
                  onClick={() => handleClick(slot, true)}
                  style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    width: "50%",
                    height: "100%",
                  }}
                />
                <div
                  onClick={() => handleClick(slot, false)}
                  style={{
                    position: "absolute",
                    right: 0,
                    top: 0,
                    width: "50%",
                    height: "100%",
                  }}
                />
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

function SetDetailPage({ token, ownedSetNums, wishlistSetNums, onMarkOwned, onAddWishlist }) {
  const { setNum } = useParams();
  const navigate = useNavigate();
  const effectiveToken = token || localStorage.getItem("lego_token") || "";

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

  // Rating is separate from review text
  const [userRating, setUserRating] = useState(null); // "" = no selection yet
  const [savingRating, setSavingRating] = useState(false);
  const [ratingError, setRatingError] = useState(null);
  const [hoverRating, setHoverRating] = useState(null);

  // Average + count from backend rating summary
  const [avgRating, setAvgRating] = useState(null); // e.g. 4.3
  const [ratingCount, setRatingCount] = useState(0); // how many ratings
  const [ratingSummaryLoading, setRatingSummaryLoading] = useState(false);
  const [ratingSummaryError, setRatingSummaryError] = useState(null);

  // Review text (optional)
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewText, setReviewText] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewSubmitError, setReviewSubmitError] = useState(null);

  // Add-to-list UI state
  const [showAddToList, setShowAddToList] = useState(false);
  const [selectedListId, setSelectedListId] = useState("");
  const [addingToList, setAddingToList] = useState(false);
  const [addToListError, setAddToListError] = useState(null);
  const [addToListSuccess, setAddToListSuccess] = useState("");

  // -------------------------------
  // Initial load: set detail + reviews + owned/wishlist state
  // -------------------------------
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

    if (setNum) {
      fetchData();
    }
  }, [setNum, token]);

  // -------------------------------
  // Rating summary (average + count)
  // -------------------------------
  useEffect(() => {
    if (!setNum) return;

    let cancelled = false;

    async function fetchRatingSummary() {
      try {
        setRatingSummaryLoading(true);
        setRatingSummaryError(null);

        const resp = await fetch(`${API_BASE}/sets/${setNum}/rating`);

        // If backend returns 404 when there are no ratings yet,
        // just treat it as "no ratings".
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
  // Add to List handler
  // -------------------------------
  async function handleAddToListSubmit(e) {
    e.preventDefault();

    if (!token) {
      alert("Please log in to modify your lists.");
      navigate("/login");
      return;
    }

    if (!selectedListId) {
      setAddToListError("Please choose a list first.");
      return;
    }

    try {
      setAddingToList(true);
      setAddToListError(null);
      setAddToListSuccess("");

      const resp = await fetch(
        `${API_BASE}/lists/${selectedListId}/items`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ set_num: setNum }),
        }
      );

      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Failed to add to list (${resp.status}): ${text}`);
      }

      await resp.json(); // we don't actually need the body right now
      setAddToListSuccess("Added to list!");
    } catch (err) {
      console.error("Error adding to list:", err);
      setAddToListError(err.message || String(err));
    } finally {
      setAddingToList(false);
    }
  }

  // -------------------------------
  // Rating-only handler
  // -------------------------------
  async function handleSaveRating(e) {
    e.preventDefault();
  
    if (!effectiveToken) {
      alert("Please log in to rate this set.");
      navigate("/login");
      return;
    }
  
    if (userRating == null || userRating === "") {
      setRatingError("Please choose a rating first.");
      return;
    }
  
    const numericRating = Number(userRating);
  
    try {
      setSavingRating(true);
      setRatingError(null);
  
      const payload = {
        // TEMP until real auth wiring – your backend ReviewCreate still expects `user`
        user: "ethan",
        rating: numericRating,
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
      setReviews((prev) => [created, ...prev]);
    } catch (err) {
      console.error("Error saving rating:", err);
      setRatingError(err.message || String(err));
    } finally {
      setSavingRating(false);
    }
  }

  // -------------------------------
  // Review handler (rating + text, but rating still optional)
  // -------------------------------
  async function handleReviewSubmit(e) {
    e.preventDefault();

    if (!token) {
      alert("Please log in to leave a review.");
      navigate("/login");
      return;
    }

    if (!reviewText.trim() && userRating === "") {
      setReviewSubmitError(
        "Please provide a rating, some text, or both."
      );
      return;
    }

    const numericRating =
      userRating === "" ? null : Number(userRating);

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
          Authorization: `Bearer ${token}`,
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

  const {
    name,
    year,
    theme,
    pieces,
    image_url,
    description,
  } = setDetail;

  const ratingOptions = [
    0.5, 1.0, 1.5, 2.0, 2.5,
    3.0, 3.5, 4.0, 4.5, 5.0,
  ];

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
          {(ratingSummaryLoading || ratingSummaryError || ratingCount > 0) && (
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
                    : `${ratingCount} rating${ratingCount === 1 ? "" : "s"}`}
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
            {/* OWNED / WISHLIST / ADD TO LIST */}
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "0.5rem",
              }}
            >
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

              <button
                type="button"
                onClick={() => {
                  if (!token) {
                    alert("Log in to add this set to a list.");
                    navigate("/login");
                    return;
                  }
                  setShowAddToList((prev) => !prev);
                  setAddToListError(null);
                  setAddToListSuccess("");
                }}
                style={{
                  padding: "0.45rem 0.9rem",
                  borderRadius: "999px",
                  border: "1px solid #ccc",
                  backgroundColor: "white",
                  color: "#222",
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                ➕ Add to List…
              </button>
            </div>

            {/* ADD-TO-LIST PANEL */}
            {showAddToList && (
              <form
                onSubmit={handleAddToListSubmit}
                style={{
                  marginTop: "0.25rem",
                  padding: "0.5rem 0.75rem",
                  borderRadius: "10px",
                  background: "white",
                  border: "1px solid #e0e0e0",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.5rem",
                }}
              >
                  <>
                    <label
                      style={{
                        fontSize: "0.85rem",
                        color: "#444",
                      }}
                    >
                      Choose a list:
                      <select
                        value={selectedListId}
                        onChange={(e) => setSelectedListId(e.target.value)}
                        style={{
                          display: "block",
                          marginTop: "0.3rem",
                          padding: "0.35rem 0.4rem",
                          borderRadius: "6px",
                          border: "1px solid #ccc",
                          width: "100%",
                        }}
                      >
                        <option value="">Select a list…</option>
                      </select>
                    </label>

                    {addToListError && (
                      <p
                        style={{
                          margin: 0,
                          color: "red",
                          fontSize: "0.85rem",
                        }}
                      >
                        {addToListError}
                      </p>
                    )}

                    {addToListSuccess && (
                      <p
                        style={{
                          margin: 0,
                          color: "green",
                          fontSize: "0.85rem",
                        }}
                      >
                        {addToListSuccess}
                      </p>
                    )}

                    <button
                      type="submit"
                      disabled={addingToList}
                      style={{
                        alignSelf: "flex-start",
                        padding: "0.4rem 0.9rem",
                        borderRadius: "999px",
                        border: "none",
                        backgroundColor: addingToList ? "#888" : "#1f883d",
                        color: "white",
                        fontWeight: 500,
                        fontSize: "0.9rem",
                        cursor: addingToList ? "default" : "pointer",
                      }}
                    >
                      {addingToList ? "Adding…" : "Add to list"}
                    </button>
                  </>
                )}
              </form>
            )}

            {/* YOUR RATING */}
            <form
            onSubmit={handleSaveRating}
            style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                flexWrap: "wrap",
            }}
            >
            <span style={{ fontSize: "0.9rem", color: "#444" }}>Your rating:</span>

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
                const relative = x / rect.width; // 0–1 across the 5 stars
                let value = relative * 5;        // 0–5

                // snap to nearest 0.5
                value = Math.round(value * 2) / 2;

                // clamp between 0.5 and 5
                if (value < 0.5) value = 0.5;
                if (value > 5) value = 5;

                setHoverRating(value);
                }}
                onMouseLeave={() => setHoverRating(null)}
                onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const relative = x / rect.width;
                let value = relative * 5;

                value = Math.round(value * 2) / 2;
                if (value < 0.5) value = 0.5;
                if (value > 5) value = 5;

                setUserRating(value);
                }}
            >
                {/* Grey base row */}
                <div style={{ color: "#ccc" }}>★★★★★</div>

                {/* Gold overlay row, clipped to rating percentage */}
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

            <button
                type="submit"
                disabled={savingRating || userRating == null}
                style={{
                marginLeft: "0.5rem",
                padding: "0.35rem 0.8rem",
                borderRadius: "999px",
                border: "none",
                backgroundColor:
                    savingRating || userRating == null ? "#888" : "#1f883d",
                color: "white",
                fontWeight: 500,
                cursor:
                    savingRating || userRating == null ? "default" : "pointer",
                }}
            >
                {savingRating ? "Saving…" : "Save"}
            </button>
            </form>

            {/* REVIEW TOGGLE */}
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

            {/* REVIEW FORM (uses same rating, but adds text) */}
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
                      {r.rating.toFixed(1)} ★
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