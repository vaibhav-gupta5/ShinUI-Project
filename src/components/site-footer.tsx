import Link from "next/link";
import { GitHubIcon } from "@/components/icons";
import { ThemeToggle } from "@/components/theme-toggle";
import { categories } from "@/data/categories";
import { primaryNav } from "@/lib/nav";
import { SITE } from "@/lib/site";

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <div className="flex items-center gap-2">
              <Link href="/" className="font-semibold tracking-tight">
                ShinUI
              </Link>
              <ThemeToggle />
            </div>
            <p className="text-muted-foreground mt-3 max-w-sm text-sm">
              {SITE.description}
            </p>
            <a
              href={SITE.repo}
              target="_blank"
              rel="noreferrer"
              className="text-muted-foreground hover:text-foreground mt-4 inline-flex items-center gap-2 text-sm transition-colors"
            >
              <GitHubIcon className="size-4" />
              Source on GitHub
            </a>
          </div>

          <div>
            <p className="text-sm font-medium">Site</p>
            <ul className="mt-3 space-y-2">
              {primaryNav.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="text-muted-foreground hover:text-foreground text-sm transition-colors"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-sm font-medium">Popular categories</p>
            <ul className="mt-3 space-y-2">
              {categories.slice(0, 6).map((category) => (
                <li key={category.slug}>
                  <Link
                    href={`/categories/${category.slug}`}
                    className="text-muted-foreground hover:text-foreground text-sm transition-colors"
                  >
                    {category.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </footer>
  );
}
