import { test, expect, type Page } from "@playwright/test";

const ARTICLE_COUNT = 100;

interface Article {
  id: string;
  title: string;
  submittedAt: number; // epoch ms
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

async function collectArticles(page: Page, count: number): Promise<Article[]> {
  const seen = new Set<string>();
  const articles: Article[] = [];

  await page.goto("/newest");

  while (articles.length < count) {
    let added = 0;
    for (const article of await readPageArticles(page)) {
      if (!seen.has(article.id)) {
        seen.add(article.id);
        articles.push(article);
        added++;
      }
    }

    expect(added).toBeGreaterThan(0);

    if (articles.length >= count) break;

    const more = page.locator("a.morelink");
    await expect(more).toBeVisible();
    const urlBefore = page.url();
    await more.click();
    await expect(page, 'clicking "More" did not change the page').not.toHaveURL(
      urlBefore,
    );
    await expect(page).toHaveURL(/next/);
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
