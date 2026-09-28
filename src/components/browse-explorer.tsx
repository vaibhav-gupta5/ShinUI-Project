"use client";

import * as React from "react";
import { SlidersHorizontal, Search, X } from "lucide-react";

import { AddResourceDialog } from "@/components/add-resource-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ResourceCard } from "@/components/resource-card";
import { CategoryIcon } from "@/components/category-icon";
import { useSavedItems } from "@/components/save-button";
import { categories } from "@/data/categories";
import type { Pricing, Resource } from "@/data/types";
import { isSaved } from "@/lib/saved-items";
import {
  getServerUserResourcesSnapshot,
  getUserResourcesSnapshot,
  mergeBrowsableResources,
  subscribeUserResources,
} from "@/lib/user-resources";
import { cn } from "@/lib/utils";

const pricingOptions: { value: Pricing; label: string }[] = [
  { value: "open-source", label: "Open source" },
  { value: "free", label: "Free" },
  { value: "freemium", label: "Freemium" },
  { value: "paid", label: "Paid" },
];

type Sort = "featured" | "saved" | "name" | "newest";

export function BrowseExplorer({
  resources,
  initialCategory,
  lockCategory = false,
}: {
  resources: Resource[];
  initialCategory?: string;
  lockCategory?: boolean;
}) {
  const [query, setQuery] = React.useState("");
  const [activeCategories, setActiveCategories] = React.useState<string[]>(
    initialCategory ? [initialCategory] : []
  );
  const [activePricing, setActivePricing] = React.useState<Pricing[]>([]);
  const [activeStacks, setActiveStacks] = React.useState<string[]>([]);
  const [sort, setSort] = React.useState<Sort>("newest");
  const [savedOnly, setSavedOnly] = React.useState(false);
  const [refreshKey, setRefreshKey] = React.useState(0);

  const userResources = React.useSyncExternalStore(
    subscribeUserResources,
    getUserResourcesSnapshot,
    getServerUserResourcesSnapshot
  );
  const saved = useSavedItems();

  const allResources = React.useMemo(() => {
    void refreshKey;
    return mergeBrowsableResources(resources);
  }, [resources, userResources, refreshKey]);

  const stacks = React.useMemo(
    () =>
      Array.from(new Set(allResources.flatMap((r) => r.stack)))
        .sort()
        .slice(0, 14),
    [allResources]
  );

  const availableCategories = React.useMemo(
    () =>
      categories.filter((c) => allResources.some((r) => r.category === c.slug)),
    [allResources]
  );

  function toggle<T>(list: T[], value: T, set: (next: T[]) => void) {
    set(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  }

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();

    const result = allResources.filter((resource) => {
      if (savedOnly && !isSaved("resource", resource.slug)) {
        return false;
      }
      if (
        activeCategories.length > 0 &&
        !activeCategories.includes(resource.category)
      ) {
        return false;
      }
      if (
        activePricing.length > 0 &&
        !activePricing.includes(resource.pricing)
      ) {
        return false;
      }
      if (
        activeStacks.length > 0 &&
        !resource.stack.some((s) => activeStacks.includes(s))
      ) {
        return false;
      }
      if (!q) return true;

      return [
        resource.name,
        resource.tagline,
        resource.description,
        ...resource.tags,
        ...resource.stack,
      ]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });

    return result.sort((a, b) => {
      if (sort === "saved") {
        const aSaved = isSaved("resource", a.slug);
        const bSaved = isSaved("resource", b.slug);
        if (aSaved !== bSaved) return aSaved ? -1 : 1;
        if (a.featured !== b.featured) return a.featured ? -1 : 1;
        return a.name.localeCompare(b.name);
      }
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "newest") return b.addedAt.localeCompare(a.addedAt);
      if (a.featured !== b.featured) return a.featured ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }, [
    allResources,
    query,
    activeCategories,
    activePricing,
    activeStacks,
    sort,
    savedOnly,
    saved,
  ]);

  const filterCount =
    (lockCategory ? 0 : activeCategories.length) +
    activePricing.length +
    activeStacks.length +
    (savedOnly ? 1 : 0);

  const userCount = allResources.filter((r) => r.userSubmitted).length;

  function clearAll() {
    setActiveCategories(lockCategory && initialCategory ? [initialCategory] : []);
    setActivePricing([]);
    setActiveStacks([]);
    setQuery("");
    setSavedOnly(false);
  }

  const filterPanel = (
    <div className="space-y-6">
      {!lockCategory && (
        <FilterGroup title="Category">
          <div className="flex flex-col gap-0.5">
            {availableCategories.map((category) => {
              const active = activeCategories.includes(category.slug);
              return (
                <button
                  key={category.slug}
                  type="button"
                  onClick={() =>
                    toggle(activeCategories, category.slug, setActiveCategories)
                  }
                  className={cn(
                    "flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                    active
                      ? "bg-accent text-foreground font-medium"
                      : "text-muted-foreground hover:bg-accent/50"
                  )}
                >
                  <CategoryIcon name={category.icon} className="size-4" />
                  <span className="truncate">{category.short}</span>
                  <span className="text-muted-foreground ml-auto text-xs tabular-nums">
                    {allResources.filter((r) => r.category === category.slug).length}
                  </span>
                </button>
              );
            })}
          </div>
        </FilterGroup>
      )}

      <FilterGroup title="Pricing">
        <div className="flex flex-wrap gap-1.5">
          {pricingOptions.map((option) => (
            <FilterChip
              key={option.value}
              active={activePricing.includes(option.value)}
              onClick={() =>
                toggle(activePricing, option.value, setActivePricing)
              }
            >
              {option.label}
            </FilterChip>
          ))}
        </div>
      </FilterGroup>

      <FilterGroup title="Stack">
        <div className="flex flex-wrap gap-1.5">
          {stacks.map((stack) => (
            <FilterChip
              key={stack}
              active={activeStacks.includes(stack)}
              onClick={() => toggle(activeStacks, stack, setActiveStacks)}
            >
              {stack}
            </FilterChip>
          ))}
        </div>
      </FilterGroup>

      <FilterGroup title="Saved">
        <FilterChip active={savedOnly} onClick={() => setSavedOnly((v) => !v)}>
          Saved only
        </FilterChip>
      </FilterGroup>

      {filterCount > 0 && (
        <Button variant="outline" size="sm" onClick={clearAll} className="w-full">
          <X className="size-3.5" />
          Clear filters
        </Button>
      )}
    </div>
  );

  return (
    <div className="lg:grid lg:grid-cols-[240px_1fr] lg:gap-8">
      <aside className="hidden lg:block">
        <div className="sticky top-20">{filterPanel}</div>
      </aside>

      <div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, tag or stack…"
              className="h-10 pl-9"
              type="search"
            />
          </div>

          <div className="flex items-center gap-2">
            <AddResourceDialog onAdded={() => setRefreshKey((k) => k + 1)} />

            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" className="h-10 lg:hidden">
                  <SlidersHorizontal className="size-4" />
                  Filters
                  {filterCount > 0 && (
                    <Badge variant="brand" className="ml-1">
                      {filterCount}
                    </Badge>
                  )}
                </Button>
              </SheetTrigger>
              <SheetContent side="bottom" className="max-h-[80vh]">
                <SheetHeader>
                  <SheetTitle>Filters</SheetTitle>
                </SheetHeader>
                <div className="overflow-y-auto px-4 pb-8">{filterPanel}</div>
              </SheetContent>
            </Sheet>

            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as Sort)}
              aria-label="Sort results"
              className="border-input bg-background h-10 rounded-md border px-3 text-sm shadow-xs outline-none"
            >
              <option value="newest">Newest</option>
              <option value="featured">Featured first</option>
              <option value="saved">Saved first</option>
              <option value="name">A–Z</option>
            </select>
          </div>
        </div>

        <div className="text-muted-foreground mt-4 flex flex-wrap items-center justify-between gap-2 text-sm">
          <p>
            <span className="text-foreground font-medium tabular-nums">
              {filtered.length}
            </span>{" "}
            {filtered.length === 1 ? "resource" : "resources"}
            {userCount > 0 && (
              <span className="ml-2">
                · <span className="text-foreground font-medium">{userCount}</span>{" "}
                added by you
              </span>
            )}
          </p>
          <p className="text-xs">Bookmark sites — saved only in your browser on this device</p>
        </div>

        <Separator className="mt-3 mb-5" />

        {filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed py-16 text-center">
            <p className="font-medium">No matches</p>
            <p className="text-muted-foreground mt-1 text-sm">
              Try a broader search or clear a filter.
            </p>
            <Button variant="outline" size="sm" onClick={clearAll} className="mt-4">
              Reset
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((resource) => (
              <ResourceCard key={resource.slug} resource={resource} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function FilterGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
        {title}
      </p>
      {children}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
        active
          ? "bg-primary text-primary-foreground border-transparent"
          : "text-muted-foreground hover:bg-accent hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}
