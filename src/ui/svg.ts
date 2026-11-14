/** Small DOM helpers for building SVG and icon markup. */

export const SVG_NS = "http://www.w3.org/2000/svg";

export function el<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number> = {},
  parent?: Element,
): SVGElementTagNameMap[K] {
  const e = document.createElementNS(SVG_NS, tag);
  for (const k in attrs) e.setAttribute(k, String(attrs[k]));
  if (parent) parent.appendChild(e);
  return e;
}

export function $<T extends HTMLElement = HTMLElement>(id: string): T {
  const e = document.getElementById(id);
  if (!e) throw new Error(`Missing #${id}`);
  return e as T;
}

/** Inline <svg> that uses a sprite symbol. */
export function icon(id: string, vb: string, cls?: string): string {
  return `<svg viewBox="${vb}" aria-hidden="true"${cls ? ` class="${cls}"` : ""}><use href="#${id}"/></svg>`;
}

export function starRow(n: number): string {
  let s = "";
  for (let i = 0; i < 3; i++) s += icon(i < n ? "rbStar" : "rbStarOff", "0 0 48 48");
  return s;
}

/** Small seeded random source so each tile's flowers stay put between renders. */
export function seeded(n: number): () => number {
  let s = (n * 9301 + 49297) % 233280 || 7;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}
