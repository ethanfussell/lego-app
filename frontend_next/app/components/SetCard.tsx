"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import AddToListMenu from "@/app/components/AddToListMenu";

export type SetLite = {
  set_num: string;
  name?: string;
  year?: number;
  theme?: string;

  // API variations
  pieces?: number | string;
  num_parts?: number | string;

  image_url?: string | null;

  // ratings
  average_rating?: number | null;
  rating_count?: number | null;

  // pricing (optional)
  price_from?: number | null;
  retail_price?: number | null;
  sale_price?: number | null;

  // user rating (optional)
  user_rating?: number | null;
};

function money(n: unknown) {
  const x = Number(n);
  if (!Number.isFinite(x)) return null;
  return `$${x.toFixed(2)}`;
}

/**
 * SmartThumb:
 * - Fixed aspect ratio box
 * - Default contain (no crop)
 * - If close ratio: cover (minimal crop)
 * - Optional conservative whitespace zoom in contain mode
 */
function SmartThumb({
  src,
  alt,
  aspect = "16 / 10",
}: {
  src?: string | null;
  alt: string;
  aspect?: string;
}) {
  const [fit, setFit] = useState<"contain" | "cover">("contain");
  const [transform, setTransform] = useState<string>("");
  const lastSrcRef = useRef<string | null | undefined>(null);

  const boxRatio = useMemo(() => {
    const parts = String(aspect)
      .split("/")
      .map((x) => Number(x.trim()));
    const a = parts?.[0] || 16;
    const b = parts?.[1] || 10;
    return a / b;
  }, [aspect]);

  useEffect(() => {
    if (lastSrcRef.current !== src) {
      lastSrcRef.current = src;
      setFit("contain");
      setTransform("");
    }
  }, [src]);

  function analyzeAndSet(e: React.SyntheticEvent<HTMLImageElement>) {
    const img = e.currentTarget;
    const w = img.naturalWidth || 1;
    const h = img.naturalHeight || 1;
    const imgRatio = w / h;

    const ratioDiff = Math.abs(imgRatio - boxRatio) / boxRatio;
    const shouldCover = ratioDiff < 0.08;

    setFit(shouldCover ? "cover" : "contain");
    setTransform("");

    if (shouldCover) return;

    // whitespace-zoom (conservative)
    try {
      const S = 64;
      const canvas = document.createElement("canvas");
      canvas.width = S;
      canvas.height = S;

      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;

      ctx.clearRect(0, 0, S, S);
      ctx.drawImage(img, 0, 0, S, S);

      const { data } = ctx.getImageData(0, 0, S, S);

      let minX = S,
        minY = S,
        maxX = -1,
        maxY = -1;

      for (let y = 0; y < S; y++) {
        for (let x = 0; x < S; x++) {
          const i = (y * S + x) * 4;
          const r = data[i],
            g = data[i + 1],
            b = data[i + 2],
            a = data[i + 3];

          if (a < 20) continue;
          if (r > 245 && g > 245 && b > 245) continue; // near-white

          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        }
      }

      if (maxX < 0 || maxY < 0) return;

      const bw = (maxX - minX + 1) / S;
      const bh = (maxY - minY + 1) / S;

      if (bw >= 0.78 && bh >= 0.78) return;

      const s = Math.min(1.22, Math.max(1.0, 1 / Math.min(bw, bh)));
      setTransform(`scale(${s})`);
    } catch {
      // ignore
    }
  }

  return (
    <div className="border-b border-black/[.06] p-2 dark:border-white/[.10]">
      <div
        className="relative w-full overflow-hidden rounded-xl border border-black/[.10] bg-white dark:border-white/[.14] dark:bg-zinc-950"
        style={{ aspectRatio: aspect as any }}
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={alt}
            loading="lazy"
            onLoad={analyzeAndSet}
            className="h-full w-full"
            style={{
              objectFit: fit,
              objectPosition: "center",
              background: "white",
              transform: transform || undefined,
              transformOrigin: "center",
              willChange: transform ? "transform" : undefined,
            }}
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center text-sm text-zinc-500">No image</div>
        )}
      </div>
    </div>
  );
}

export default function SetCard({
  set,
  token,

  // controls
  showShop = true,
  showAddToList = true,

  // optional override: some pages may want a custom footer instead
  footer,
  // if parent wants to disable navigation (rare)
  disableNavigate = false,
}: {
  set: SetLite;
  token?: string;

  showShop?: boolean;
  showAddToList?: boolean;

  footer?: React.ReactNode;
  disableNavigate?: boolean;
}) {
  const router = useRouter();
  if (!set) return null;

  const setNum = String(set.set_num || "").trim();
  const name = set.name || "Unknown set";

  const piecesRaw =
    set.pieces != null ? set.pieces : set.num_parts != null ? set.num_parts : null;

  const piecesLabel =
    typeof piecesRaw === "number"
      ? `${piecesRaw.toLocaleString()} pieces`
      : typeof piecesRaw === "string" && piecesRaw.trim()
      ? `${piecesRaw.trim()} pieces`
      : null;

  const avg = typeof set.average_rating === "number" ? set.average_rating : null;
  const count = typeof set.rating_count === "number" ? set.rating_count : null;

  const retail = typeof set.retail_price === "number" ? set.retail_price : null;
  const sale = typeof set.sale_price === "number" ? set.sale_price : null;
  const from =
    typeof set.price_from === "number"
      ? set.price_from
      : typeof set.retail_price === "number"
      ? set.retail_price
      : null;

  const hasSale = sale !== null && retail !== null && sale < retail;

  function goToSet() {
    if (disableNavigate) return;
    if (!setNum) return;
    router.push(`/sets/${encodeURIComponent(setNum)}`);
  }

  function goToShop(e: React.MouseEvent) {
    e.stopPropagation();
    if (!setNum) return;
    router.push(`/sets/${encodeURIComponent(setNum)}#shop`);
  }

  const defaultFooter =
    footer ?? (
      <div className="flex gap-2">
        {showShop ? (
          <button
            type="button"
            onClick={goToShop}
            className="h-8 flex-1 rounded-full border border-black/[.12] bg-white px-3 text-xs font-extrabold hover:bg-black/[.04] dark:border-white/[.16] dark:bg-transparent dark:hover:bg-white/[.06]"
          >
            Shop
          </button>
        ) : null}

        {showAddToList ? (
          <div className="flex-[2] min-w-[120px]" onClick={(e) => e.stopPropagation()}>
            {token ? (
              <AddToListMenu token={token} setNum={setNum} />
            ) : (
              <button
                type="button"
                className="h-8 w-full rounded-full border border-black/[.12] bg-white px-3 text-xs font-extrabold opacity-60 dark:border-white/[.16] dark:bg-transparent"
                onClick={(e) => {
                  e.stopPropagation();
                  router.push("/login");
                }}
              >
                Add to list
              </button>
            )}
          </div>
        ) : null}
      </div>
    );

  return (
    <div
      onClick={goToSet}
      className="flex min-h-[300px] w-full cursor-pointer flex-col overflow-hidden rounded-2xl border border-black/[.06] bg-white shadow-sm hover:shadow-md dark:border-white/[.10] dark:bg-zinc-950"
    >
      <SmartThumb src={set.image_url} alt={name || setNum} aspect="16 / 10" />

      <div className="flex flex-1 flex-col px-3 pb-3 pt-2">
        <div className="mb-2">
          <div className="line-clamp-2 min-h-[2.44em] text-sm font-semibold leading-snug text-zinc-900 dark:text-zinc-50">
            {name}
          </div>

          <div className="mt-1 text-xs text-zinc-500">
            <span className="font-semibold">{setNum}</span>
            {set.year ? ` • ${set.year}` : ""}
          </div>
        </div>

        {(set.theme || piecesLabel) ? (
          <div className="mb-2 text-xs text-zinc-500">
            {set.theme ? <div className="truncate">{set.theme}</div> : null}
            {piecesLabel ? <div>{piecesLabel}</div> : null}
          </div>
        ) : null}

        {(avg !== null || count !== null) ? (
          <div className="mb-2 flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
            <span>⭐</span>
            <span>{avg !== null ? avg.toFixed(1) : "—"}</span>
            {count !== null ? <span className="text-zinc-400">({count})</span> : null}
          </div>
        ) : null}

        {(hasSale || from !== null || retail !== null) ? (
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <div className="text-xs font-extrabold text-zinc-500">Price</div>

            {hasSale ? (
              <div className="flex items-baseline gap-2">
                <div className="text-sm font-black text-zinc-900 dark:text-zinc-50">{money(sale)}</div>
                <div className="text-xs font-extrabold text-zinc-400 line-through">{money(retail)}</div>
                <div className="rounded-full border border-black/[.08] bg-zinc-50 px-2 py-0.5 text-[11px] font-black text-zinc-900 dark:border-white/[.12] dark:bg-black dark:text-zinc-50">
                  Save {money((retail as number) - (sale as number))}
                </div>
              </div>
            ) : (
              <div className="text-sm font-black text-zinc-900 dark:text-zinc-50">
                {from !== null ? (set.price_from != null ? `From ${money(from)}` : money(from)) : "—"}
              </div>
            )}
          </div>
        ) : null}

        <div className="flex-1" />

        <div className="mt-2 border-t border-black/[.06] pt-2 dark:border-white/[.10]">
          {defaultFooter}
        </div>
      </div>
    </div>
  );
}