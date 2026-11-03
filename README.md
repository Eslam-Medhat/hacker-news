# Hacker News `/newest` ordering test

A [Playwright](https://playwright.dev) test, written in TypeScript, that checks the first 100 articles on
<https://news.ycombinator.com/newest> are sorted from newest to oldest.

## What the test does

[tests/hackernews-newest.spec.ts](tests/hackernews-newest.spec.ts):

1. Opens `/newest` and reads the articles on the page (HN shows 30 per page).
2. Clicks **More** and repeats until it has collected 100 articles. After each click it checks that the URL changed and
   that the new page contained articles it had not seen yet, so a broken **More** link fails the test.
3. Reads each article's exact submission time from the `title` attribute of its "x minutes ago" label
   (for example `2026-11-02T18:24:51`), not from the rounded text.
4. Compares the real order of those timestamps against a copy sorted newest first. Articles posted in the same second
   are allowed.

The test runs against the live site, so it needs network access and can fail if Hacker News is down or blocks your IP.

## Requirements

- Node.js 22 or newer (CI uses 22)
- npm

## Setup

```bash
npm ci
npx playwright install chromium
```

## Run

```bash
npm test              # run the test
npm run typecheck     # TypeScript check

# optional: generate and open an HTML report locally
# (the config only writes one when the CI environment variable is set)
npx playwright test --reporter=html
npx playwright show-report
```

## CI

[.github/workflows/playwright.yml](.github/workflows/playwright.yml) runs the test on every push to `master`. It
installs dependencies and Chromium, runs `npm test`, and uploads the HTML report as a `playwright-report` artifact
(kept for 14 days). In CI, failed tests are retried twice.

## Project layout

```
.github/workflows/playwright.yml   CI job
tests/hackernews-newest.spec.ts    the test
playwright.config.ts               Playwright settings (base URL, retries, reporters)
tsconfig.json                      TypeScript settings
```
