export const primaryNav = [
  { href: "/", label: "Home", icon: "Home" },
  { href: "/browse", label: "Browse", icon: "Compass" },
  { href: "/components", label: "Components", icon: "Blocks" },
  { href: "/portfolios", label: "Portfolios", icon: "UserRound" },
  { href: "/design-tools", label: "Design Tools", icon: "PenTool" },
  { href: "/categories", label: "Categories", icon: "LayoutGrid" },
] as const;

/** The bottom bar stays at four targets — the rest live in the header menu. */
export const mobileTabs = primaryNav.filter((item) =>
  ["/", "/browse", "/components", "/categories"].includes(item.href)
);
