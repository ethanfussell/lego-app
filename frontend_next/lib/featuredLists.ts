// frontend_next/lib/featuredLists.ts

export type FeaturedList = {
    id: number;
    // optional override if you ever want to force a title in the UI
    title?: string;
  };
  
  export const FEATURED_LISTS: FeaturedList[] = [
    { id: 6 },
    { id: 5 },
    { id: 4 },
  ];