// frontend_next/app/components/CarouselRow.tsx
"use client";

import React, { useMemo, useRef } from "react";
import Link from "next/link";

type CarouselRowProps = {
  title: string;
  subtitle?: string; // e.g. "Private • 42 sets"
  viewHref?: string; // e.g. "/collection/owned" or `/lists/${id}`
  emptyText?: string;
  children?: React.ReactNode;
};

export default function CarouselRow({
  title,
  subtitle,
  viewHref,
  emptyText = "No sets yet.",
  children,
}: CarouselRowProps) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  const drag = useRef({
    isDown: false,
    startX: 0,
    startScrollLeft: 0,
    moved: false,
  });

  function scrollByPage(dir: number) {
    const el = scrollerRef.current;
    if (!el) return;
    const amount = Math.max(240, Math.floor(el.clientWidth * 0.9));
    el.scrollBy({ left: dir * amount, behavior: "smooth" });
  }

  function onMouseDown(e: React.MouseEvent) {
    const el = scrollerRef.current;
    if (!el) return;

    drag.current.isDown = true;
    drag.current.moved = false;
    drag.current.startX = e.pageX;
    drag.current.startScrollLeft = el.scrollLeft;

    el.style.cursor = "grabbing";
    el.style.userSelect = "none";
  }

  function endDrag() {
    const el = scrollerRef.current;
    if (!el) return;
    drag.current.isDown = false;
    el.style.cursor = "grab";
    el.style.userSelect = "";
  }

  function onMouseMove(e: React.MouseEvent) {
    const el = scrollerRef.current;
    if (!el) return;
    if (!drag.current.isDown) return;

    const dx = e.pageX - drag.current.startX;
    if (Math.abs(dx) > 4) drag.current.moved = true;

    el.scrollLeft = drag.current.startScrollLeft - dx;
  }

  // Prevent clicking into a card when user was dragging
  function onClickCapture(e: React.MouseEvent) {
    if (drag.current.moved) {
      e.preventDefault();
      e.stopPropagation();
      drag.current.moved = false;
    }
  }

  const hasItems = useMemo(() => {
    if (!children) return false;
    if (Array.isArray(children)) return children.length > 0;
    return true;
  }, [children]);

  return (
    <section className="rounded-2xl border border-black/[.08] bg-white p-4 shadow-sm dark:border-white/[.14] dark:bg-zinc-950">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-2">
            <h2 className="m-0 text-base font-semibold">{title}</h2>
            {subtitle ? <span className="text-sm text-zinc-500">{subtitle}</span> : null}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => scrollByPage(-1)}
            aria-label="Scroll left"
            className="rounded-full border border-black/[.10] bg-white px-2.5 py-1 text-sm font-extrabold leading-none hover:bg-black/[.04] dark:border-white/[.16] dark:bg-transparent dark:hover:bg-white/[.06]"
          >
            ◀
          </button>

          <button
            type="button"
            onClick={() => scrollByPage(1)}
            aria-label="Scroll right"
            className="rounded-full border border-black/[.10] bg-white px-2.5 py-1 text-sm font-extrabold leading-none hover:bg-black/[.04] dark:border-white/[.16] dark:bg-transparent dark:hover:bg-white/[.06]"
          >
            ▶
          </button>

          {viewHref ? (
            <Link href={viewHref} className="text-sm font-extrabold text-zinc-900 hover:underline dark:text-zinc-50">
              View →
            </Link>
          ) : null}
        </div>
      </div>

      {!hasItems ? (
        <div className="px-0.5 py-1 text-sm text-zinc-500">{emptyText}</div>
      ) : (
        <div
          ref={scrollerRef}
          onMouseDown={onMouseDown}
          onMouseUp={endDrag}
          onMouseLeave={endDrag}
          onMouseMove={onMouseMove}
          onClickCapture={onClickCapture}
          className="flex gap-3 overflow-x-auto overflow-y-visible pb-2"
          style={{ cursor: "grab", WebkitOverflowScrolling: "touch" }}
        >
          {children}
        </div>
      )}
    </section>
  );
}