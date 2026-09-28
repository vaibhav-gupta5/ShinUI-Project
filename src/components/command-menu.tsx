"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Blocks, Compass, LayoutGrid, PenTool, Search, UserRound } from "lucide-react";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { categories } from "@/data/categories";
import { resources } from "@/data/resources";
import { registry } from "@/registry";
import { cn } from "@/lib/utils";

export function CommandMenu({ className }: { className?: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");

  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((value) => !value);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const go = React.useCallback(
    (href: string) => {
      setOpen(false);
      router.push(href);
    },
    [router]
  );

  // Filter items based on query to reduce rendering
  const filteredRegistry = React.useMemo(() => {
    if (!query) return registry.slice(0, 10); // Show only first 10 when no query
    const lowerQuery = query.toLowerCase();
    return registry.filter(
      (item) =>
        item.name.toLowerCase().includes(lowerQuery) ||
        item.tags.some((tag) => tag.toLowerCase().includes(lowerQuery))
    ).slice(0, 20);
  }, [query]);

  const filteredResources = React.useMemo(() => {
    if (!query) return resources.slice(0, 10); // Show only first 10 when no query
    const lowerQuery = query.toLowerCase();
    return resources.filter(
      (resource) =>
        resource.name.toLowerCase().includes(lowerQuery) ||
        resource.tags.some((tag) => tag.toLowerCase().includes(lowerQuery)) ||
        resource.stack.some((stack) => stack.toLowerCase().includes(lowerQuery))
    ).slice(0, 20);
  }, [query]);

  const filteredCategories = React.useMemo(() => {
    if (!query) return categories;
    const lowerQuery = query.toLowerCase();
    return categories.filter((category) =>
      category.name.toLowerCase().includes(lowerQuery)
    );
  }, [query]);

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        className={cn(
          "text-muted-foreground relative h-9 w-full justify-start gap-2 pr-2 pl-3 font-normal sm:w-64",
          className
        )}
      >
        <Search className="size-4" />
        <span className="truncate">Search everything…</span>
        <kbd className="bg-muted pointer-events-none ml-auto hidden h-5 items-center gap-0.5 rounded border px-1.5 font-mono text-[10px] font-medium select-none sm:flex">
          <span className="text-xs">⌘</span>K
        </kbd>
      </Button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder="Search components, resources, categories…"
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          <CommandEmpty>Nothing matched that.</CommandEmpty>

          <CommandGroup heading="Pages">
            <CommandItem value="page portfolios sites" onSelect={() => go("/portfolios")}>
              <UserRound />
              <span>Portfolios</span>
            </CommandItem>
            <CommandItem value="page design tools spline three rive" onSelect={() => go("/design-tools")}>
              <PenTool />
              <span>Design Tools</span>
            </CommandItem>
          </CommandGroup>

          <CommandSeparator />

          <CommandGroup heading="Components">
            {filteredRegistry.map((item) => (
              <CommandItem
                key={item.slug}
                value={`component ${item.name} ${item.tags.join(" ")}`}
                onSelect={() => go(`/components/${item.slug}`)}
              >
                <Blocks />
                <span>{item.name}</span>
                <span className="text-muted-foreground ml-auto truncate text-xs">
                  live preview
                </span>
              </CommandItem>
            ))}
          </CommandGroup>

          <CommandSeparator />

          <CommandGroup heading="Resources">
            {filteredResources.map((resource) => (
              <CommandItem
                key={resource.slug}
                value={`resource ${resource.name} ${resource.tags.join(" ")} ${resource.stack.join(" ")}`}
                onSelect={() => go(`/resource/${resource.slug}`)}
              >
                <Compass />
                <span>{resource.name}</span>
                <span className="text-muted-foreground ml-auto truncate text-xs">
                  {resource.tagline}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>

          <CommandSeparator />

          <CommandGroup heading="Categories">
            {filteredCategories.map((category) => (
              <CommandItem
                key={category.slug}
                value={`category ${category.name}`}
                onSelect={() => go(`/categories/${category.slug}`)}
              >
                <LayoutGrid />
                <span>{category.name}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
