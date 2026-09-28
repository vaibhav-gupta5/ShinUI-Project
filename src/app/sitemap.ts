import type { MetadataRoute } from "next";

import { categories } from "@/data/categories";
import { resources } from "@/data/resources";
import { registry } from "@/registry";
import { SITE } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const staticRoutes = ["", "/browse", "/components", "/portfolios", "/design-tools", "/categories"];

  return [
    ...staticRoutes.map((route) => ({
      url: `${SITE.url}${route}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: route === "" ? 1 : 0.8,
    })),
    ...categories.map((category) => ({
      url: `${SITE.url}/categories/${category.slug}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    ...registry.map((item) => ({
      url: `${SITE.url}/components/${item.slug}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
    ...resources.map((resource) => ({
      url: `${SITE.url}/resource/${resource.slug}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.5,
    })),
  ];
}
