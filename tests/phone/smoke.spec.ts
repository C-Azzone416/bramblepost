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

/** Start route 1 and wait for the board; portrait-only specs below share it. */
const startRoute = async (page: Page) => {
  const vp = page.viewportSize()!;
  test.skip(vp.height <= vp.width, "portrait layout only");
  await startFromTitle(page);
  await page.locator("#villageSvg").waitFor();
  await page.locator(".vchip").first().tap();
  await page.locator("#mapStart").tap();
  await page.locator("#board [data-cell]").first().waitFor();
};

/** Elements whose text must never be clipped; the envelope's 2-line clamp is the one allowed truncation. */
const clippedBoxes = (page: Page) =>
  page.evaluate(() => {
    const els = [...document.querySelectorAll<HTMLElement>("#banner, #rulemsg, .satchel .pc, .satchel .pc .tx")];
    return els.filter((e) => e.scrollHeight > e.clientHeight + 1).map((e) => `${e.id || e.className}: ${e.scrollHeight}>${e.clientHeight}`);
  });

test("portrait: gameplay text is never clipped (long content, 150% text)", async ({ page }) => {
  await startRoute(page);
  expect(await clippedBoxes(page), "default content").toEqual([]);

  // Long injected content in the banner, the rule message and every parcel's text.
  const long = "A very long line of essential instructions that keeps going and going so it has to wrap onto many lines. ".repeat(3);
  await page.evaluate((t) => {
    document.getElementById("bannerText")!.textContent = t;
    document.getElementById("rulemsg")!.textContent = t;
    document.querySelectorAll(".satchel .pc .tx").forEach((e) => ((e as HTMLElement).insertAdjacentHTML("beforeend", `<div class="xtra">${t}</div>`)));
  }, long);
  expect(await clippedBoxes(page), "long content").toEqual([]);
  await noSideways(page);

  // Enlarged text: root at 150% plus every text size in the banner and satchel scaled by 1.5.
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "150%";
    const els = [...document.querySelectorAll<HTMLElement>("#banner, #banner *, .satchel, .satchel *")];
    const sizes = els.map((e) => parseFloat(getComputedStyle(e).fontSize));
    els.forEach((e, i) => (e.style.fontSize = `${sizes[i] * 1.5}px`));
  });
  expect(await clippedBoxes(page), "long content at 150% text").toEqual([]);
});

test("portrait: Tab to the last parcel card scrolls it into view", async ({ page }) => {
  await startRoute(page);
  const n = await page.locator(".satchel .pc").count();
  expect(n).toBeGreaterThan(1);
  await page.locator(".satchel .pc button:not([disabled])").first().focus();
  for (let i = 0; i < 40; i++) {
    if (await page.evaluate(() => !!document.activeElement?.closest(".satchel .pc:last-child"))) break;
    await page.keyboard.press("Tab");
  }
  // WebKit on macOS skips buttons in the Tab order (Option+Tab only); focus the last card's button directly there.
  if (!(await page.evaluate(() => !!document.activeElement?.closest(".satchel .pc:last-child")))) {
    await page.locator(".satchel .pc:last-child button:not([disabled])").first().focus();
  }
  expect(await page.evaluate(() => !!document.activeElement?.closest(".satchel .pc:last-child")), "focus reached the last card").toBe(true);
  await expect
    .poll(async () => {
      const r = await page.evaluate(() => {
        const c = document.querySelector(".satchel .pc:last-child")!.getBoundingClientRect();
        const l = document.querySelector(".satchel .plist")!.getBoundingClientRect();
        return { left: c.left - l.left, right: l.right - c.right };
      });
      return r.left >= -1 && r.right >= -1;
    })
    .toBe(true);
});

test("portrait: controls and parcel nudges are at least 44px", async ({ page }) => {
  await startRoute(page);
  const small = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>(".boardcol .controls button, .satchel .pc .nudge button")]
      .map((b) => ({ n: b.getAttribute("aria-label") || b.textContent!.trim(), r: b.getBoundingClientRect() }))
      .filter((x) => x.r.width < 44 - 0.5 || x.r.height < 44 - 0.5)
      .map((x) => `${x.n}: ${x.r.width}x${x.r.height}`),
  );
  expect(small, "buttons under 44px").toEqual([]);
});

test("route 1 played to the end: idle ambient animation has no long frames", async ({ page }) => {
  await startFromTitle(page);
  await page.locator("#villageSvg").waitFor();
  await page.locator(".vchip").first().tap();
  await page.locator("#mapStart").tap();
  await page.locator("#board [data-cell]").first().waitFor();
  // Observe from now on: long tasks where supported, otherwise rAF gaps.
  await page.evaluate(() => {
    const w = window as unknown as { __long: number[]; __gaps: number[] };
    w.__long = [];
    w.__gaps = [];
    try {
      new PerformanceObserver((l) => l.getEntries().forEach((e) => w.__long.push(e.duration))).observe({ entryTypes: ["longtask"] });
    } catch {
      /* not supported (WebKit) */
    }
    let last = performance.now();
    const tick = (t: number) => {
      w.__gaps.push(t - last);
      last = t;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  // Play route 1's par solution with real input: tap tile 16, then swipe row 3 left from tile 17.
  const board = page.locator("#board");
  const centre = async (i: number) => {
    const b = (await board.locator(`[data-cell="${i}"]`).boundingBox())!;
    return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  };
  const t = await centre(16);
  await page.touchscreen.tap(t.x, t.y);
  await expect(page.locator("#moveCount")).toContainText("1 move ");
  await page.waitForTimeout(2500); // the first parcel's walk
  const s = await centre(17);
  await page.evaluate(async ({ x, y }: { x: number; y: number }) => {
    const fire = (type: string, cx: number) =>
      (document.elementFromPoint(cx, y) ?? document.body).dispatchEvent(
        new PointerEvent(type, { pointerId: 8, pointerType: "touch", isPrimary: true, clientX: cx, clientY: y, button: 0, buttons: type === "pointerup" ? 0 : 1, bubbles: true, cancelable: true }),
      );
    fire("pointerdown", x);
    for (let i = 1; i <= 8; i++) {
      fire("pointermove", x - i * 10);
      await new Promise((r) => setTimeout(r, 16));
    }
    fire("pointerup", x - 80);
  }, s);
  await expect(page.locator("#moveCount")).toContainText("2 moves");
  await page.waitForTimeout(2500); // the last walk; the board is now fixed
  // Let the ambient loop idle, then count the frames it ran.
  await expect(page.locator("#board [data-ambient]")).toHaveAttribute("display", "inline");
  await page.evaluate(() => {
    const w = window as unknown as { __long: number[]; __gaps: number[] };
    w.__long = [];
    w.__gaps = [];
  });
  await page.waitForTimeout(3000);
  const m = await page.evaluate(() => {
    const w = window as unknown as { __long: number[]; __gaps: number[] };
    return { long: w.__long.filter((d) => d > 50), gaps: w.__gaps.length, worst: Math.max(0, ...w.__gaps.slice(1)) };
  });
  expect(m.gaps, "frames ran while idle").toBeGreaterThan(10);
  expect(m.long, "long tasks over 50ms").toEqual([]);
  // rAF gaps are noisy on a shared machine: only flag a real stall (a quarter second).
  expect(m.worst, "worst frame gap (ms)").toBeLessThan(250);
});
