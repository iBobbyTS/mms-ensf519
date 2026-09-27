# SCSC MMS — ENSF 519 Course Extract

A standalone extract of four pages from the SCSC Membership Management System (MMS),
a SvelteKit application for a community services centre. This repository was prepared
as the reference project for the ENSF 519 course assignment.

## Pages

| Page | Route | Interactions |
| --- | --- | --- |
| Member directory | `/members` | Search, filters, pagination, sortable table, member detail links |
| Member detail | `/members/[code]` | Read-only profile view with an edit form (`/members/[code]/edit`) |
| Member card CSV | `/members/card-download` | Export member card data as CSV |
| Interest group management | `/interest-group/manage` | Create, rename, and delete interest groups |
| Interest group check-in | `/interest-group/attendance` | Per-group daily check-in: member search, check-in/undo, counters, QR camera scanning |

The app shell provides a home dashboard (`/home`), theme switching (dark/light/system),
and trilingual UI (English / Simplified Chinese / Traditional Chinese) via Paraglide.

## Stack

- SvelteKit 2 + Svelte 5, Tailwind CSS 4 + daisyUI 5
- Cloudflare Workers adapter with a local D1 (SQLite) database via `wrangler`
- Drizzle ORM for typed queries
- Paraglide for cookie-based localization (`en`, `zh-cn`, `zh-tw`)
- [`@ibobbyts/svelte-ui-utils`](https://www.npmjs.com/package/@ibobbyts/svelte-ui-utils) for tables, dropdowns, and toasts
- `html5-qrcode` for camera-based QR check-in scanning

## Getting started

Requirements: [Bun](https://bun.sh) and Node.js.

```bash
bun install
bun run dev:reset   # rebuild local D1 from schema.sql, seed demo data, start dev server
```

Then open http://localhost:8787. The root path redirects to the home dashboard.

Other commands:

```bash
bun run dev          # start dev server (requires compiled i18n + local D1)
bun run check        # compile i18n + svelte-check
bun run test:unit    # node --test unit tests (src/lib/*.test.ts)
bun run build        # production build
bun run db:reset:local  # reset local D1 from schema.sql
bun run db:seed         # insert demo data (interest groups, members, attendance)
```

## Demo data

`bun run dev:reset` (or `bun run db:seed`) loads a small demo dataset: several interest
groups, a set of members, and check-in records for the current day and month so every
page has meaningful content immediately.

## Scope

This extract intentionally removes modules that are not part of the course scope:
SSO authentication, receipts/payments, activities, FSII survey responses, projects,
organizations, child members, and temporary participants. Data access goes through the
local D1 database only; no Cloudflare account is required for local development.

## Original project

Extracted from the private SCSC Membership Management System repository.
