LEGO API — Contract Notes (v0.1)

Auth
	•	Endpoints marked “(auth)” require Authorization: Bearer <token>.
	•	In local/dev, a fake token like Bearer fake-token-for-ethan is accepted.

Set number normalization
	•	Many endpoints accept either:
	•	base: "10305"
	•	full: "10305-1"
	•	When an endpoint needs a canonical set, the server resolves to a real sets.set_num (typically preferring <base>-1).

Sets
	•	GET /sets/{set_num}
	•	Accepts base or full; returns canonical set_num in response.
	•	If Authorization is provided, may include user-specific fields like user_rating.
	•	GET /sets/bulk?set_nums=10305-1,21354-1
	•	Returns an array of set objects with cached fields + rating stats.
	•	Ratings summary / offers are read-only helper endpoints:
	•	GET /sets/{set_num}/rating
	•	GET /sets/{set_num}/offers

Reviews (auth)
	•	POST /sets/{set_num}/reviews
	•	Create or update your review for that set.
	•	Accepts base or full; stored against canonical set_num.
	•	DELETE /sets/{set_num}/reviews/me
	•	Idempotent: always returns 204.
	•	If review exists → delete + 204
	•	If already deleted → 204
	•	If set doesn’t exist → 204 (treat as already gone)

System collections: Owned + Wishlist (auth)

These are system lists keyed by owned and wishlist.

Add
	•	POST /collections/wishlist body: {"set_num":"10305"}
	•	Resolves to canonical set and adds to wishlist.
	•	Idempotent: duplicate adds do not create duplicates.
	•	POST /collections/owned body: {"set_num":"10305"}
	•	Resolves to canonical set and adds to owned.
	•	Also removes from wishlist (idempotent), using base semantics (removes any 10305-* in wishlist).

List
	•	GET /collections/me/wishlist
	•	GET /collections/me/owned
	•	Returns arrays of set objects in list order.

Delete (idempotent)
	•	DELETE /collections/wishlist/{set_num}
	•	DELETE /collections/owned/{set_num}
	•	Always returns 204.
	•	Does not create system lists on delete.
	•	Accepts base or full:
	•	If {set_num} includes - → deletes exact match in that list.
	•	If base-only → deletes any variant matching the base (e.g., 10305-*) in that list.

Reorder (exact-match contract)
	•	PUT /collections/wishlist/order body: {"set_nums":["A","B",...]}
	•	PUT /collections/owned/order body: {"set_nums":["A","B",...]}
	•	Payload must contain exactly the current items:
	•	Same length
	•	Same set (after canonicalization)
	•	Unique
	•	Errors:
	•	400 set_nums_must_be_unique
	•	400 set_nums_must_match_all_items
	•	Successful reorder updates parent list updated_at (used for “recent activity” / sorting).

Custom lists (/lists) (auth unless noted)
	•	Supports creating/updating/deleting lists, adding/removing items, and reordering:
	•	Reorder list items uses the same exact-match + unique rules and bumps updated_at.
	•	Removing an item returns 404 set_not_in_list if nothing was removed (non-idempotent for custom lists).

