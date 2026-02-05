import { gaEvent } from "@/lib/ga";

// Helpful standard fields:
// - placement: where the click happened (topnav_desktop, topnav_mobile, set_card_actions, etc.)
// - source: what initiated the action (enter_key, suggestion_click, nav_link, etc.)

export function trackShopClick(args: { set_num: string; placement?: string }) {
  gaEvent("shop_click", {
    set_num: args.set_num,
    placement: args.placement || "unknown",
  });
}

export function trackLoginCta(args: { placement?: string }) {
  gaEvent("login_cta_click", {
    placement: args.placement || "unknown",
  });
}

export function trackNavClick(args: { href: string; label: string; placement?: string }) {
  gaEvent("nav_click", {
    href: args.href,
    label: args.label,
    placement: args.placement || "topnav",
  });
}

export function trackSearchSubmit(args: { query: string; placement?: string; source?: string }) {
  const q = (args.query || "").trim();
  if (!q) return;

  gaEvent("search_submit", {
    query: q,
    query_length: q.length,
    placement: args.placement || "unknown",
    source: args.source || "unknown",
  });
}

export function trackSearchSuggestionClick(args: {
  query: string;
  set_num: string;
  placement?: string;
}) {
  gaEvent("search_suggestion_click", {
    query: (args.query || "").trim(),
    set_num: args.set_num,
    placement: args.placement || "unknown",
  });
}

export function trackMenuToggle(args: {
    action: "open" | "close";
    reason?: string;
    placement?: string;
    path?: string;
    authed?: boolean;
  }) {
    gaEvent("menu_toggle", {
      action: args.action,
      reason: args.reason || "unknown",
      placement: args.placement || "unknown",
      path: args.path || (typeof window !== "undefined" ? window.location.pathname : ""),
      authed: typeof args.authed === "boolean" ? args.authed : undefined,
    });
  }