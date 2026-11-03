import { test, expect, type Page } from "@playwright/test";

const ARTICLE_COUNT = 100;

interface Article {
  id: string;
  title: string;
  submittedAt: number;
  rawTimestamp: string;
}

function parseTimestamp(raw: string): number {
  const ms = Date.parse(raw);
  if (Number.isNaN(ms)) throw new Error(`Unparseable timestamp: "${raw}"`);
  return ms;
}

async function readPageArticles(page: Page): Promise<Article[]> {
  return page
    .locator("tr.athing.submission")
    .evaluateAll((rows) =>
      rows.map((row) => {
        const meta = row.nextElementSibling;
        return {
          id: row.id,
          title: row.querySelector(".titleline > a")?.textContent ?? "",
          rawTimestamp:
            meta?.querySelector(".age")?.getAttribute("title") ?? "",
        };
      }),
    )
    .then((rows) =>
      rows.map((r) => ({ ...r, submittedAt: parseTimestamp(r.rawTimestamp) })),
    );
}

// How long to wait before each reload when HN throttles us (up to 100s in total).
const THROTTLE_BACKOFF_MS = [10_000, 20_000, 30_000, 40_000];

// HN answers rapid requests with a page that has no articles and says
// "Sorry, we're not able to serve your requests this quickly." or just "Sorry.".
async function isThrottled(page: Page): Promise<boolean> {
  const hasArticles = (await page.locator("tr.athing.submission").count()) > 0;
  if (hasArticles) return false;
  return /sorry/i.test(await page.locator("body").innerText());
}

async function reloadIfThrottled(page: Page): Promise<void> {
  await page.waitForLoadState("load");
  for (const delay of THROTTLE_BACKOFF_MS) {
    if (!(await isThrottled(page))) return;

    await page.waitForTimeout(delay);
    await page.reload();
  }
}

async function collectArticles(page: Page, count: number): Promise<Article[]> {
  const seen = new Set<string>();
  const articles: Article[] = [];

  await page.goto("/newest");
  await reloadIfThrottled(page);

  while (articles.length < count) {
    let added = 0;
    for (const article of await readPageArticles(page)) {
      if (!seen.has(article.id)) {
        seen.add(article.id);
        articles.push(article);
        added++;
      }
    }

    if (added === 0) {
      // Show what the server actually returned (e.g. a rate-limit or block page).
      const pageText = (await page.locator("body").innerText()).slice(0, 300);
      throw new Error(
        `No new articles on ${page.url()} after ${articles.length} collected. ` +
          `Page text: ${JSON.stringify(pageText)}`,
      );
    }

    if (articles.length >= count) break;

    const more = page.locator("a.morelink");
    await expect(more).toBeVisible();
    const urlBefore = page.url();
    await more.click();
    await expect(page, 'clicking "More" did not change the page').not.toHaveURL(
      urlBefore,
    );
    await expect(page).toHaveURL(/next/);
    await reloadIfThrottled(page);
  }

  return articles.slice(0, count);
}

test(`first ${ARTICLE_COUNT} articles are sorted from newest to oldest`, async ({
  page,
}) => {
  const articles = await collectArticles(page, ARTICLE_COUNT);

  expect(articles).toHaveLength(ARTICLE_COUNT);

  const times = articles.map((a) => a.submittedAt);
  const sorted = [...times].sort((a, b) => b - a);

  expect(times).toEqual(sorted);
});
