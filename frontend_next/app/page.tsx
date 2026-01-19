import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-50 font-sans text-zinc-900 dark:bg-black dark:text-zinc-50">
      <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col px-6 py-16 sm:py-24">
        <header className="flex items-center justify-between">
          <div className="text-sm font-semibold tracking-tight text-zinc-700 dark:text-zinc-300">
            YourSite
          </div>

          <Link
            href="/themes"
            className="text-sm font-semibold text-zinc-900 hover:underline dark:text-zinc-50"
          >
            Browse themes →
          </Link>
        </header>

        <section className="mt-14 rounded-3xl border border-black/[.06] bg-white p-10 shadow-sm dark:border-white/[.10] dark:bg-zinc-950 sm:p-14">
          <div className="max-w-2xl">
            <h1 className="text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
              Find LEGO sets by theme, year, or set number.
            </h1>

            <p className="mt-4 text-lg leading-8 text-zinc-600 dark:text-zinc-400">
              Explore themes, or jump straight to a set page if you already know the
              number (example:{" "}
              <span className="font-medium text-zinc-950 dark:text-zinc-50">
                30693-1
              </span>
              ).
            </p>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 sm:items-center">
            <Link
              href="/themes"
              className="flex h-12 w-full items-center justify-center rounded-full bg-black px-5 text-base font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
            >
              Explore Themes
            </Link>

            <Link
              href="/sets/30693-1"
              className="flex h-12 w-full items-center justify-center rounded-full border border-solid border-black/[.10] bg-transparent px-5 text-base font-medium transition-colors hover:border-transparent hover:bg-black/[.04] dark:border-white/[.16] dark:hover:bg-white/[.06]"
            >
              View Example Set
            </Link>
          </div>

          <div className="mt-10 rounded-2xl border border-black/[.06] bg-zinc-50 p-5 dark:border-white/[.10] dark:bg-black">
            <div className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
              Quick jump
            </div>
            <div className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              Type a set number and press enter:
            </div>

            <form
              className="mt-4 flex gap-3"
              action={(formData: FormData) => {
                "use server";
                const raw = String(formData.get("setNum") || "").trim();
                if (!raw) return;
                // NOTE: redirect is a Next server action helper; we’ll avoid importing it
                // by using a simple response-less action and letting the client navigate.
              }}
            >
              {/* Simple client-side navigation input (no server action) */}
              <input
                name="setNum"
                placeholder="e.g. 30693-1"
                className="h-12 w-full rounded-xl border border-black/[.10] bg-white px-4 text-base outline-none transition focus:border-black/30 dark:border-white/[.16] dark:bg-zinc-950 dark:focus:border-white/30"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    const v = (e.currentTarget.value || "").trim();
                    if (v) window.location.href = `/sets/${encodeURIComponent(v)}`;
                  }
                }}
              />
              <button
                type="button"
                className="h-12 shrink-0 rounded-xl bg-black px-4 text-base font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
                onClick={(e) => {
                  const input = (e.currentTarget
                    .parentElement?.querySelector("input[name=setNum]") as HTMLInputElement | null);
                  const v = (input?.value || "").trim();
                  if (v) window.location.href = `/sets/${encodeURIComponent(v)}`;
                }}
              >
                Go
              </button>
            </form>

            <div className="mt-3 text-xs text-zinc-500 dark:text-zinc-500">
              Tip: set numbers usually look like <span className="font-medium">12345-1</span>.
            </div>
          </div>
        </section>

        <footer className="mt-auto pt-10 text-xs text-zinc-500 dark:text-zinc-500">
          Built with Next.js + FastAPI · SEO-ready pages for sharing and indexing
        </footer>
      </main>
    </div>
  );
}