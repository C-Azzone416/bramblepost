/**
 * Phone smoke test (npm run phone-pass): map -> route 1 -> one tap and one swipe, no sideways scroll.
 * Taps are real touch taps; the swipe is a touch-typed pointer sequence (WebKit has no CDP touch drag).
 */
import { expect, test, type Page } from "@playwright/test";

const noSideways = async (page: Page) => {
  const w = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  expect(w.sw, "no horizontal overflow").toBeLessThanOrEqual(w.cw);
};

/** The title screen comes first; a fresh save goes straight from New Game to the map. */
const startFromTitle = async (page: Page) => {
  await page.goto("/");
  await page.locator("#titleNew").tap();
};

test("map, route 1, one tap and one swipe", async ({ page }, info) => {
  const shot = (n: string) => page.screenshot({ path: `test-results/phone-pass/${info.project.name}-${n}.png` });
  await startFromTitle(page);
  await page.locator("#villageSvg").waitFor();
  await noSideways(page);
  await shot("map");

  await page.locator(".vchip").first().tap();
  await page.locator("#mapStart").tap();
  const board = page.locator("#board");
  await board.locator("[data-cell]").first().waitFor();
  await board.scrollIntoViewIfNeeded();
  await noSideways(page);

  const centre = async (i: number) => {
    const b = (await board.locator(`[data-cell="${i}"]`).boundingBox())!;
    return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  };
  const moves = page.locator("#moveCount");

  // Tap: turn tile 16 (the par solution's first move).
  const t = await centre(16);
  await page.touchscreen.tap(t.x, t.y);
  await expect(moves).toContainText("1 move ");
  await expect(moves).not.toContainText("2 moves"); // a ghost click must not add a second move

  // Swipe: slide row 3 left, starting on tile 17.
  const s = await centre(17);
  await page.evaluate(async ({ x, y }: { x: number; y: number }) => {
    const fire = (type: string, cx: number) =>
      (document.elementFromPoint(cx, y) ?? document.body).dispatchEvent(
        new PointerEvent(type, { pointerId: 7, pointerType: "touch", isPrimary: true, clientX: cx, clientY: y, button: 0, buttons: type === "pointerup" ? 0 : 1, bubbles: true, cancelable: true }),
      );
    fire("pointerdown", x);
    for (let i = 1; i <= 8; i++) {
      fire("pointermove", x - i * 10);
      await new Promise((r) => setTimeout(r, 16));
    }
    fire("pointerup", x - 80);
  }, s);
  await expect(moves).toContainText("2 moves");
  await shot("route");
  await noSideways(page);
});

test("portrait: board on top, satchel strip below, nothing shifts on the first move", async ({ page }, info) => {
  const vp = page.viewportSize()!;
  test.skip(vp.height <= vp.width, "portrait layout only");
  await startFromTitle(page);
  await page.locator("#villageSvg").waitFor();
  await page.locator(".vchip").first().tap();
  await page.locator("#mapStart").tap();
  const board = page.locator("#board");
  await board.locator("[data-cell]").first().waitFor();
  const box = async (sel: string) => (await page.locator(sel).boundingBox())!;

  const before = await box("#board");
  const satchelBefore = await box(".satchel");
  info.annotations.push({ type: "board-top", description: `${before.y}px of ${vp.height}` });
  expect(before.y, "board starts in the top quarter").toBeLessThan(vp.height * 0.25);
  expect(before.x + before.width, "board fits the width").toBeLessThanOrEqual(vp.width);
  expect(satchelBefore.y, "satchel is below the board").toBeGreaterThanOrEqual(before.y + before.height - 1);
  await noSideways(page);

  const c = (await board.locator('[data-cell="16"]').boundingBox())!;
  await page.touchscreen.tap(c.x + c.width / 2, c.y + c.height / 2);
  await expect(page.locator("#moveCount")).toContainText("1 move ");

  const after = await box("#board");
  const satchelAfter = await box(".satchel");
  info.annotations.push({ type: "board-jump", description: `${after.y - before.y}px` });
  for (const k of ["x", "y", "width", "height"] as const) expect(Math.abs(after[k] - before[k]), `board ${k} moved`).toBeLessThanOrEqual(2);
  expect(Math.abs(satchelAfter.height - satchelBefore.height), "satchel height stable").toBeLessThanOrEqual(2);
  expect(Math.abs(satchelAfter.y - satchelBefore.y), "satchel position stable").toBeLessThanOrEqual(2);
  await noSideways(page);
  await page.screenshot({ path: `test-results/phone-pass/${info.project.name}-portrait-layout.png` });
});
