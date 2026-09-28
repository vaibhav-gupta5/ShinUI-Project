# ShinUI

A searchable, mobile-friendly index of UI and design resources — component libraries, blocks, motion systems, shaders, themes, icons, mockups, iOS patterns and design tools — with live previews, real source code and credit to the people who built them.

## What it does

- **Browse** every resource with full-text search plus category, pricing and stack filters.
- **Preview external sites inline** in a browser frame, switchable between desktop and mobile widths.
- **Render components live** — registry components run on the page, and their source is read off disk at build time so the code you copy matches the preview.
- **Credit makers** — an author is listed only where the maker is publicly and unambiguously credited on the project itself.
- **Works on a phone** — bottom tab bar, slide-over navigation, bottom-sheet filters, safe-area insets.
- **Dark, light and system themes** via CSS variables and `next-themes`.
- **⌘K command palette** across components, resources and categories.

## Stack

| Piece | Choice |
| --- | --- |
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 (CSS-first config, OKLCH tokens) |
| Components | shadcn/ui primitives on Radix |
| Icons | Lucide |
| Fonts | Geist Sans + Geist Mono |
| Theming | next-themes |

No CMS and no database. The whole index is typed data, so the build fails if a category slug is wrong.

## Getting started

This project uses **pnpm**. Do not use `npm install` — it will fail on this repo.

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

```bash
pnpm build      # production build (fully static)
pnpm start      # serve the production build
pnpm lint       # eslint
pnpm typecheck  # tsc --noEmit
```

### Version notes

- `typescript` is pinned to 6.x because `typescript-eslint` does not yet support the TS 7 API.
- `eslint` is pinned to 9.x because `eslint-plugin-react` is not yet compatible with the ESLint 10 rule API.

## Repo files (what matters)

You only need to touch a few files day to day. Everything else is standard Next.js / tooling config.

| File | Purpose |
| --- | --- |
| `package.json` | Dependencies and scripts. Required for any Node project. |
| `pnpm-lock.yaml` | Locks dependency versions so installs are reproducible. Keep this in git. |
| `.npmrc` | Tells contributors to use pnpm. |
| `components.json` | shadcn/ui config — only needed if you add more shadcn components via the CLI. |
| `src/data/resources.ts` | The resource index. Add new links here. |
| `src/data/categories.ts` | Category definitions. |
| `src/data/authors.ts` | Verified attribution records. |
| `src/registry/` | Live components, demos and registry metadata. |
| `next.config.ts` | Next.js settings. |
| `tsconfig.json` | TypeScript settings. |
| `eslint.config.mjs` | Lint rules. |
| `postcss.config.mjs` | Tailwind v4 PostCSS hookup. |

There is intentionally **one** markdown file (`README.md`) and **no** workspace yaml — config that used to live in extra files has been folded into `package.json`.

## Project structure

```
src/
├── app/
│   ├── browse/               search + filter across every resource
│   ├── categories/[slug]/    live components and resources per category
│   ├── components/[slug]/    live preview, source, usage, attribution
│   ├── resource/[slug]/      inline site preview, description, maker links
│   └── portfolios/           personal sites and craft pages worth studying
├── components/
│   ├── ui/                   shadcn primitives
│   ├── browse-explorer.tsx   client-side search and filtering
│   ├── component-preview.tsx preview/code tabs, viewport switcher, replay
│   ├── site-preview.tsx      iframe embed with desktop/mobile toggle
│   └── code-block.tsx        copy, wrap and expand, with a local tokenizer
├── data/
│   ├── categories.ts         the 17 categories
│   ├── resources.ts          the index itself
│   ├── authors.ts            verified attribution only
│   └── types.ts
├── registry/
│   ├── components/           the live components, one file each
│   ├── demos/                how each component is shown in a preview
│   └── index.ts              registry metadata
└── lib/
    ├── registry-source.ts    reads component files at build time
    └── highlight.ts          dependency-free syntax tokenizer
```

## Adding a resource

Append an object to `src/data/resources.ts`. It appears in search, browse, its category page and the command palette with no other changes.

```ts
{
  slug: "example-ui",
  name: "Example UI",
  tagline: "One line on why it is worth knowing about",
  description: "A paragraph on what it actually does and when to reach for it.",
  url: "https://example.com/",
  category: "component-libraries",  // must match a slug in categories.ts
  tags: ["registry", "animated"],
  stack: ["React", "Tailwind"],
  pricing: "open-source",           // free | open-source | freemium | paid
  authorId: "shadcn",               // optional, must exist in authors.ts
  featured: false,
  install: "npx shadcn@latest add button",  // optional
  addedAt: "2026-01-04",
}
```

## Adding a live component

1. Create `src/registry/components/<slug>.tsx` exporting a named component.
2. Add a demo to `src/registry/demos/index.tsx`.
3. Register it in `src/registry/index.ts`, pointing `file` at the component and `demoExport` at the demo.

The detail page picks up the source, derives the usage snippet from the file's exports, and lists dependencies automatically.

## Contributing

Pull requests welcome. Add resources or live components following the patterns above. Keep attribution accurate — only add `authorId` values backed by public credits on the source project.

## Attribution

Every listed resource belongs to its own author. This site indexes and links to them; it does not host or redistribute their code. If a byline is wrong or missing, please open an issue or a pull request.

## License

MIT for this repository's code. Listed third-party resources are governed by their own licenses.
