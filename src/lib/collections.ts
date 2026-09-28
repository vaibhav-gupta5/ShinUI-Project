import { getResource, resources } from "@/data/resources";
import type { Resource } from "@/data/types";

const DESIGN_TOOL_SLUGS = [
  "spline",
  "three-js",
  "rive",
  "remotion",
  "elichen-shaders",
  "nagomi",
  "paper-shaders",
  "unicorn-studio",
  "shadertoy",
  "react-three-fiber",
] as const;

const PORTFOLIO_SLUGS = [
  "chanhdai-components",
  "nagomi",
  "seesaw",
  "chanhdai-blocks",
  "xevrion-ui-lab",
] as const;

function pick(slugs: readonly string[]) {
  return slugs
    .map((slug) => getResource(slug))
    .filter((resource): resource is Resource => Boolean(resource));
}

export function designToolResources() {
  const featured = pick(DESIGN_TOOL_SLUGS);
  const seen = new Set(featured.map((resource) => resource.slug));
  const tagged = resources.filter(
    (resource) => !seen.has(resource.slug) && resource.category === "design-tools"
  );
  return [...featured, ...tagged];
}

export function portfolioResources() {
  const featured = pick(PORTFOLIO_SLUGS);
  const seen = new Set(featured.map((resource) => resource.slug));
  const tagged = resources.filter(
    (resource) => !seen.has(resource.slug) && resource.tags.includes("portfolio")
  );
  return [...featured, ...tagged];
}
