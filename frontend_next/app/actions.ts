"use server";

import { redirect } from "next/navigation";

export async function goToSet(formData: FormData) {
  const raw = String(formData.get("setNum") || "").trim();
  if (!raw) return;
  redirect(`/sets/${encodeURIComponent(raw)}`);
}