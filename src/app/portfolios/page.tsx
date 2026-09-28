import type { Metadata } from "next";

import { PageHeader } from "@/components/page-header";
import { ResourceCard } from "@/components/resource-card";
import { portfolioResources } from "@/lib/collections";

export const metadata: Metadata = {
  title: "Portfolios",
  description:
    "Personal sites and craft pages worth studying — portfolios, component registries and living experiments.",
};

export default function PortfoliosPage() {
  const items = portfolioResources();

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12">
      <PageHeader
        title="Portfolios"
        description="Sites people actually shipped. Component registries, personal labs and interactive pieces — the kind of page you open when you want the work, not the template."
      />
      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((resource) => (
          <ResourceCard key={resource.slug} resource={resource} />
        ))}
      </div>
    </div>
  );
}
