// frontend_next/lib/featuredLists.ts

export type FeaturedList = {
    id: number;
  
    /**
     * Optional override if you want to force a title in the UI.
     * If omitted, the UI can fall back to the real list title (from API) or `List #id`.
     */
    title?: string;
  
    /**
     * Optional short line under the title (ex: "by ethan", "Starter pack", etc).
     * This avoids needing `owner`/`description` fields everywhere.
     */
    subtitle?: string;
  };
  
  export const FEATURED_LISTS: FeaturedList[] = [
    { id: 6, subtitle: "Community pick" },
    { id: 5, subtitle: "Community pick" },
    { id: 4, subtitle: "Community pick" },
  ];