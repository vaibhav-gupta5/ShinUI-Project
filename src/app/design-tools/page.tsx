import type { Metadata } from "next";

import { PageHeader } from "@/components/page-header";
import { ResourceCard } from "@/components/resource-card";
import { designToolResources } from "@/lib/collections";

export const metadata: Metadata = {
  title: "Design Tools",
  description:
    "Spline, Three.js, Rive, Remotion, shader playgrounds and the other tools used to design motion and 3D on the web.",
};

export default function DesignToolsPage() {
  const items = designToolResources();

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12">
      <PageHeader
        title="Design Tools"
        description="Spline, Three.js, Rive, Remotion, shader playgrounds and the other tools for designing motion and 3D on the web."
      />
      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((resource) => (
          <ResourceCard key={resource.slug} resource={resource} />
        ))}
      </div>
    </div>
  );
}
