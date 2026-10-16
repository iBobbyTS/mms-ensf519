# SCSC MMS — ENSF 519 Course Extract

A standalone extract of four pages from the SCSC Membership Management System (MMS),
a SvelteKit application for a community services centre. This repository was prepared
as the reference project for the ENSF 519 course assignment.

## Demo video

[demo_video.mov](demo_video.mov) is a 30-second screen recording of the four pages
(member directory, member detail, interest group management, and interest group
check-in), captured against the seeded demo dataset described below. Download the file
and play it locally.

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

## Python Selenium browser tests

The scripts in `tests/selenium/test_browser.py` use Python's `unittest` runner
and Selenium Chrome WebDriver. These are browser integration tests, separate
from the TypeScript unit tests. Install Python 3.10+ and Google Chrome first.

From the project root, create a Python environment and install Selenium:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r tests/selenium/requirements.txt
```

Start the application in another terminal. Use a local demo database: the group
test creates, renames, and deletes its own uniquely named group. If you need demo
data, `bun run dev:reset` resets the local database and seeds it before starting
the app; this removes existing local data. Otherwise use `bun run dev`.

With the app running at http://localhost:8787, run all five tests:

```powershell
.\.venv\Scripts\python.exe -m unittest discover -s tests/selenium -p "test_*.py" -v
```

Or run the Python script directly:

```powershell
.\.venv\Scripts\python.exe tests/selenium/test_browser.py
```

Chrome opens with three-second viewing pauses at key steps and before
closing each test. To change how the tests run, edit the settings at the top of
`tests/selenium/test_browser.py`:

```python
BASE_URL = "http://localhost:8787"
DELAY = 3
```

Selenium manages ChromeDriver automatically (the first run may require internet
access). The file uses ordinary `find_element`, `send_keys`, `click`, and
`unittest` assertions. `setUp` opens Chrome before each test; `tearDown` pauses
at the end, and a cleanup action closes Chrome. The group test uses `finally`
to delete its group even if the rename assertion fails.

Coverage: root redirect, member profile/edit navigation, directory search by
member code, invalid CSV input, and interest group create/rename/delete with
persistence verification. Member tests expect the demo member `SCSC0001` and at
least two visible members so the search test can check that other rows disappear.
Each test starts a fresh browser and closes it even after a failed assertion.
Selenium waits up to ten seconds to find elements. The `sleep(DELAY)` calls
make the steps visible and give asynchronous changes time to finish. Increase
`DELAY` if those changes take longer on your computer.

Running the script directly stops at the first error and shows its traceback.
If using unittest discovery, add `-f` for the same behavior. If `/home` does not
load in your browser, restart `bun run dev` in the server terminal, wait for the
page to load, and then rerun the tests. Check that the `BASE_URL` setting in the
Python file matches the port printed by Vite.

The Cloudflare adapter is configured with `remoteBindings: false` because this
extract uses local D1 only. No Cloudflare environment variable is required.
If Vite prints `ready` but `/home` keeps timing out, stop that server with
Ctrl+C, then restart:

```powershell
bun run dev
```

Keep that terminal open and run Selenium in a second terminal. This uses the
existing local database and disables remote Cloudflare bindings.

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
