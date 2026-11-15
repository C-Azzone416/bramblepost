/**
 * Phone smoke test (npm run phone-pass): map -> route 1 -> one tap and one swipe, no sideways scroll.
 * Taps are real touch taps; the swipe is a touch-typed pointer sequence (WebKit has no CDP touch drag).
 */
import { expect, test, type Page } from "@playwright/test";

const noSideways = async (page: Page) => {
  const w = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  expect(w.sw, "no horizontal overflow").toBeLessThanOrEqual(w.cw);
};

test("map, route 1, one tap and one swipe", async ({ page }, info) => {
  const shot = (n: string) => page.screenshot({ path: `test-results/phone-pass/${info.project.name}-${n}.png` });
  await page.goto("/");
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
  await page.evaluate(async ({ x, y }) => {
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
