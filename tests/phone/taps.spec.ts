/**
 * Real taps on the village map (#105): the way into Hollowmere and the map's lane markers must take a genuine touch tap on
 * every phone viewport. No DOM click and no `force`: Playwright's own hit-test fails the tap if anything else is on top of
 * the control at the touch point, or if it moves when pressed.
 */
import { expect, test, type Page } from "@playwright/test";

async function toMap(page: Page) {
  await page.goto("/");
  await page.evaluate(() => localStorage.setItem("bramblepost-prefs-v1", JSON.stringify({ reduceMotion: true })));
  await page.reload();
  await page.locator("#titleNew").tap();
  await page.locator("#letterView").waitFor();
  await page.locator('#letterView [data-letter="skip"]').tap();
  await page.locator('#letterView [data-letter="next"]').tap();
  await page.locator("#letterView").waitFor({ state: "detached" });
  return page.locator("#mapLanes .vchip").evaluateAll((l) => l.map((e) => (e as HTMLElement).dataset.lane!));
}
const seed = (page: Page, best: Record<string, { stars: number; moves: number }>, ending: boolean) =>
  page.evaluate(
    ({ best, ending }) => {
      localStorage.setItem("bramblepost-playtest-v1", JSON.stringify({ best }));
      localStorage.setItem("bramblepost-intro-v1", JSON.stringify({ seen: ["thistledown", "hollowmere"] }));
      if (ending) localStorage.setItem("bramblepost-ending-v1", JSON.stringify({ seen: true }));
    },
    { best, ending },
  );

test("a real tap on 'Go to Hollowmere' enters the village", async ({ page }) => {
  const ids = await toMap(page);
  await seed(page, Object.fromEntries(ids.map((id) => [id, { stars: 2, moves: 99 }])), true);
  await page.reload();
  await page.locator("#titleContinue").tap();
  await expect(page.locator("#mapTitle")).toHaveText("Thistledown");
  await page.locator("#mapEnter").tap({ timeout: 8000 });
  await expect(page.locator("#mapTitle")).toHaveText("Hollowmere");
});

test("real taps select each open and finished lane marker on the map", async ({ page }) => {
  const ids = await toMap(page);
  await seed(page, { [ids[0]]: { stars: 3, moves: 1 }, [ids[1]]: { stars: 1, moves: 99 } }, false);
  await page.reload();
  await page.locator("#titleContinue").tap();
  await page.locator("#villageSvg .vnode.done").first().waitFor();
  const nodes = page.locator("#villageSvg .vnode.open, #villageSvg .vnode.done");
  const count = await nodes.count();
  expect(count).toBe(3); // two finished and the open one
  for (let i = 0; i < count; i++) {
    const node = nodes.nth(i);
    const lane = await node.getAttribute("data-lane");
    await node.tap({ timeout: 8000 });
    await expect(page.locator(`#mapLanes .vchip[data-lane="${lane}"]`)).toHaveAttribute("aria-pressed", "true");
  }
});
