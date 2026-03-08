// frontend_next/app/api/revalidate/route.ts
import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/revalidate?path=/new
 *
 * Triggers on-demand ISR revalidation for a given path.
 * Called by the admin panel after saving page settings.
 */
export async function POST(req: NextRequest) {
  const path = req.nextUrl.searchParams.get("path");

  if (!path) {
    return NextResponse.json({ error: "Missing ?path= parameter" }, { status: 400 });
  }

  try {
    revalidatePath(path);
    return NextResponse.json({ revalidated: true, path });
  } catch {
    return NextResponse.json({ error: "Revalidation failed" }, { status: 500 });
  }
}
