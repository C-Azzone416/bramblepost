import type { Page } from "@playwright/test";

export const REFERENCES = ["H", "BA", "WA", "D", "R"] as const;
export type ReadProof = {
  geometry: string;
  reads: Record<string, number[]>;
  dimensions: Record<string, [number, number]>;
};
export type HelpProof = {
  dom: Record<string, string>;
  captureGeometry: string;
  measurement?: ReadProof;
};

/** Internal only: never emit text, markup, styles or screenshots in assertion output. */
export async function helpDOM(page: Page): Promise<string> {
  return page.evaluate(() => {
    const root = document.querySelector("#gameView")!;
    const attributes = (e: Element) => [...e.attributes].map((a) => [a.name, a.value]).sort(([a], [b]) => a.localeCompare(b));
    const tree = (n: Node): unknown => n instanceof Element
      ? [n.tagName, attributes(n), [...n.childNodes].map(tree)] : [n.nodeType, n.nodeValue];
    const measured = new Set<Element>();
    for (const e of root.querySelectorAll(".keys li,.keys li *")) for (let p: Element | null = e; p; p = p.parentElement) measured.add(p);
    const layout = [...measured].map((e) => {
      const s = getComputedStyle(e), r = e.getBoundingClientRect();
      return [e.tagName, attributes(e), [r.x, r.y, r.width, r.height], e.scrollLeft, e.scrollTop,
        [...s].map((p) => [p, s.getPropertyValue(p)])];
    });
    return JSON.stringify({ tree: tree(root), layout, viewport: [innerWidth, innerHeight],
      scroll: [scrollX, scrollY, document.documentElement.scrollWidth, document.documentElement.scrollHeight], dpr: devicePixelRatio });
  });
}

type ProofCapture = { renders: Record<string, string>; help?: HelpProof };

/** Decode full, untouched PNGs first. Classify every changed pixel before considering scoped equality. */
export async function compareHelpReferences(page: Page, clean: ProofCapture, other: ProofCapture, diagnose = true) {
  if (!clean.help?.measurement || !other.help?.measurement) throw new Error("help read proof missing");
  const a = clean.help, b = other.help;
  const full = await page.evaluate(async ({ clean, other, reads, otherReads, modes }) => {
    const decode = async (b64: string) => {
      const img = await createImageBitmap(await (await fetch(`data:image/png;base64,${b64}`)).blob());
      const canvas = new OffscreenCanvas(img.width, img.height), g = canvas.getContext("2d")!;
      g.drawImage(img, 0, 0);
      return { w: img.width, h: img.height, d: g.getImageData(0, 0, img.width, img.height).data };
    };
    const rows = [];
    for (const mode of modes) {
      const A = await decode(clean[mode]), B = await decode(other[mode]);
      const sameDimensions = A.w === B.w && A.h === B.h;
      const footprint = new Set([...(reads[mode] ?? []), ...(otherReads[mode] ?? [])]);
      let count = 0, inside = 0;
      const bounds = [A.w, A.h, -1, -1], inBounds = [...bounds], outBounds = [...bounds];
      const extend = (box: number[], x: number, y: number) => { box[0] = Math.min(box[0], x); box[1] = Math.min(box[1], y); box[2] = Math.max(box[2], x); box[3] = Math.max(box[3], y); };
      if (sameDimensions) for (let i = 0; i < A.w * A.h; i++) {
        const o = i * 4;
        if (A.d[o] === B.d[o] && A.d[o + 1] === B.d[o + 1] && A.d[o + 2] === B.d[o + 2] && A.d[o + 3] === B.d[o + 3]) continue;
        const x = i % A.w, y = Math.floor(i / A.w), inRead = footprint.has(i);
        count++; if (inRead) inside++;
        extend(bounds, x, y); extend(inRead ? inBounds : outBounds, x, y);
      }
      rows.push({ mode, dimensions: [[A.w, A.h], [B.w, B.h]], sameDimensions, changed: count, inside, outside: count - inside,
        bounds: count ? bounds : null, insideBounds: inside ? inBounds : null, outsideBounds: count - inside ? outBounds : null,
        readPixels: footprint.size, encodedEqual: clean[mode] === other[mode] });
    }
    return rows;
  }, { clean: clean.renders, other: other.renders, reads: a.measurement!.reads, otherReads: b.measurement!.reads, modes: [...REFERENCES] });
  // Bounded, failure-only, structural/numeric diagnostics. In CI these locate the Linux differences for the first time.
  if (diagnose) for (const r of full) if (!r.sameDimensions || !r.encodedEqual) console.log("HELP_REFERENCE_DIFF " + JSON.stringify(r));
  const dimensions = full.every((r) => r.sameDimensions) && JSON.stringify(a.measurement!.dimensions) === JSON.stringify(b.measurement!.dimensions)
    && [a, b].every((p) => Object.values(p.measurement!.dimensions).every((d) => d[0] === p.measurement!.dimensions.V[0] && d[1] === p.measurement!.dimensions.V[1]));
  const geometry = a.captureGeometry === b.captureGeometry && a.measurement!.geometry === b.measurement!.geometry;
  const dom = JSON.stringify(a.dom) === JSON.stringify(b.dom);
  const reads = JSON.stringify(a.measurement!.reads) === JSON.stringify(b.measurement!.reads);
  // No hashes, tolerances, altered images or exclusions within the read set: every RGBA channel must equal exactly.
  // All image accesses in analyse go through px. Identical values for its complete read trace imply identical branches
  // and subsequent reads, inductively; changing an unread byte cannot influence any detector decision.
  const pixels = full.every((r) => r.sameDimensions && r.inside === 0);
  const accepted = dimensions && geometry && dom && reads && pixels;
  if (diagnose && !accepted) console.log("HELP_REFERENCE_CONTRACT " + JSON.stringify({ dimensions, geometry, dom, reads, pixels }));
  return { accepted, dimensions, geometry, dom, reads, pixels, full };
}

/** Deterministic proof mutations operate on copies after measurement, never on detector inputs or production paint. */
export async function corruptReference(page: Page, capture: ProofCapture, mode: "H" | "BA" | "WA", outside: boolean) {
  const read = capture.help!.measurement!.reads[mode];
  if (!read.length) throw new Error("fault requires an actually read pixel");
  const png = await page.evaluate(async ({ b64, read, hiddenRead, black, white, outside }) => {
    const img = await createImageBitmap(await (await fetch(`data:image/png;base64,${b64}`)).blob());
    const canvas = document.createElement("canvas"); canvas.width = img.width; canvas.height = img.height;
    const g = canvas.getContext("2d")!; g.drawImage(img, 0, 0);
    const data = g.getImageData(0, 0, img.width, img.height), footprint = new Set(read);
    let faultPixel = -1;
    if (!outside) {
      const decode = async (b64: string) => {
        const image = await createImageBitmap(await (await fetch(`data:image/png;base64,${b64}`)).blob());
        const c = new OffscreenCanvas(image.width, image.height), context = c.getContext("2d")!;
        context.drawImage(image, 0, 0);
        return context.getImageData(0, 0, image.width, image.height).data;
      };
      const B = await decode(black), W = await decode(white), hReads = new Set(hiddenRead);
      // Choose actual covered ink inside both this mode's read set and H's measured neighborhood, never crop padding.
      faultPixel = read.find((i) => hReads.has(i) && W[i * 4] - B[i * 4] + W[i * 4 + 1] - B[i * 4 + 1] + W[i * 4 + 2] - B[i * 4 + 2] >= 3 * 255 * 0.1) ?? -1;
      if (faultPixel < 0) throw new Error("no covered in-region fault pixel");
    }
    let changed = 0;
    for (let i = 0; i < img.width * img.height; i++) {
      // Flip one read pixel, or EVERY unread pixel. Alpha stays opaque so canvas round trips are exact.
      if (outside ? footprint.has(i) : i !== faultPixel) continue;
      for (let c = 0; c < 3; c++) data.data[i * 4 + c] ^= 255;
      changed++;
    }
    if (!changed) throw new Error("empty fault");
    g.putImageData(data, 0, 0);
    return canvas.toDataURL("image/png").split(",")[1];
  }, { b64: capture.renders[mode], read, hiddenRead: capture.help!.measurement!.reads.H,
    black: capture.renders.BA, white: capture.renders.WA, outside });
  return { ...capture, renders: { ...capture.renders, [mode]: png } };
}
