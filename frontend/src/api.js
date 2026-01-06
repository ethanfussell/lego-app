export async function addToList({ token, listId, setNum, systemLists }) {
  // systemLists looks like: { owned: {id: 1}, wishlist: {id: 2} }
  const ownedId = systemLists?.owned?.id;
  const wishlistId = systemLists?.wishlist?.id;

  let url;
  if (listId === ownedId) url = "/collections/owned";
  else if (listId === wishlistId) url = "/collections/wishlist";
  else url = `/lists/${listId}/items`; // keep for later when custom-list endpoint exists

  return apiFetch(url, {
    method: "POST",
    token,
    json: { set_num: setNum },
  });
}