// frontend_next/lib/image.ts

/** Return a trimmed, non-empty image URL or null. */
export function safeImageSrc(url: unknown): string | null {
  if (typeof url !== "string") return null;
  const s = url.trim();
  return s || null;
}

export function cardImageSizes(): string {
    // 1 col mobile, 2 col tablet, 3 col desktop
    return "(max-width: 640px) 92vw, (max-width: 1024px) 48vw, 320px";
  }
  
  export function heroImageSizes(): string {
    // set detail hero: full width on mobile, responsive column on desktop
    return "(max-width: 768px) 92vw, 480px";
  }
  
  export const IMAGE_QUALITY = 75 as const;