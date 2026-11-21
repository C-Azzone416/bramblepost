/** Postage stamp artwork for the door scene's reward card. Returns SVG markup. */
import { LATER_MOTIFS } from "./stampMotifs";
import type { SpringMotif, Stamp } from "./story";

export const SPRING_MOTIFS: Record<SpringMotif, string> = {
  primrose:
    '<g transform="translate(47 52)">' +
    '<path d="M0 30 C -4 18, -2 8, 0 0" stroke="#5f7d43" stroke-width="4" fill="none"/>' +
    '<ellipse cx="-12" cy="34" rx="12" ry="6" fill="#78a943" transform="rotate(-25 -12 34)"/>' +
    '<ellipse cx="12" cy="36" rx="12" ry="6" fill="#78a943" transform="rotate(25 12 36)"/>' +
    [0, 72, 144, 216, 288].map((a) => `<ellipse cx="0" cy="-11" rx="8" ry="11" fill="#f2c94c" transform="rotate(${a})"/>`).join("") +
    '<circle r="6" fill="#e3a43a"/></g>',
  clover:
    '<g transform="translate(47 50)">' +
    '<path d="M0 6 C 4 22, 10 32, 16 38" stroke="#3f5a2a" stroke-width="4" fill="none" stroke-linecap="round"/>' +
    [0, 90, 180, 270]
      .map((a) => `<g transform="rotate(${a})"><circle cx="-6" cy="-12" r="8" fill="#5f9a3a"/><circle cx="6" cy="-12" r="8" fill="#5f9a3a"/><path d="M-13 -9 L0 2 L13 -9Z" fill="#5f9a3a"/></g>`)
      .join("") +
    '<circle r="3" fill="#a7c76d"/></g>',
  wheel:
    '<path d="M9 78 C 26 72, 44 82, 62 76 S 80 74, 85 72 V99 H9Z" fill="#5d93a6"/>' +
    '<g transform="translate(46 50)"><circle r="24" fill="none" stroke="#7a4d2a" stroke-width="5"/>' +
    [0, 45, 90, 135].map((a) => `<path d="M-24 0 H24" stroke="#7a4d2a" stroke-width="3" transform="rotate(${a})"/>`).join("") +
    '<circle r="5" fill="#a66a33"/></g>',
  bridge:
    '<path d="M9 74 C 30 68, 60 80, 85 70 V99 H9Z" fill="#7fb7c9"/>' +
    '<path d="M12 66 Q 47 26 82 66" stroke="#8a5a33" stroke-width="7" fill="none" stroke-linecap="round"/>' +
    '<path d="M24 52 v16 M36 43 v24 M47 40 v26 M58 43 v24 M70 52 v16" stroke="#a87444" stroke-width="3"/>' +
    '<path d="M10 76 C 30 70, 64 82, 84 74" stroke="#fff" stroke-width="2" fill="none" opacity=".6"/>',
  willow:
    '<path d="M9 80 H85 V99 H9Z" fill="#9bc27a"/>' +
    '<path d="M47 84 C 45 66, 48 54, 47 40" stroke="#6b4a2b" stroke-width="6" fill="none" stroke-linecap="round"/>' +
    '<path d="M47 42 C 30 34, 20 44, 20 70 M47 42 C 38 32, 32 46, 33 72 M47 42 C 56 32, 62 46, 61 72 M47 42 C 64 34, 74 44, 74 70" stroke="#5f9a3a" stroke-width="3.5" fill="none" stroke-linecap="round"/>',
  brook:
    '<path d="M9 62 C 30 52, 50 70, 85 58 V99 H9Z" fill="#7fb7c9"/>' +
    '<path d="M9 78 C 30 68, 50 86, 85 74" stroke="#fff" stroke-width="2.5" fill="none" opacity=".7"/>' +
    '<ellipse cx="34" cy="50" rx="13" ry="5" fill="#d9a35c"/><path d="M22 50 C 24 36, 44 36, 46 50Z" fill="#e8b878"/>' +
    '<path d="M30 44 l3 -5 M40 44 l-3 -5" stroke="#8a5a33" stroke-width="2" fill="none"/>',
  lantern:
    '<path d="M9 80 H85 V99 H9Z" fill="#b7c98e"/>' +
    '<path d="M47 22 V32" stroke="#6b4a2b" stroke-width="4" stroke-linecap="round"/>' +
    '<path d="M36 34 H58 L62 46 H32Z" fill="#c4452e"/>' +
    '<rect x="34" y="46" width="26" height="28" rx="6" fill="#f2c94c"/>' +
    '<rect x="42" y="52" width="10" height="16" rx="4" fill="#fff6c4"/>' +
    '<path d="M32 74 H62" stroke="#6b4a2b" stroke-width="5" stroke-linecap="round"/>',
  gate:
    '<path d="M9 80 H85 V99 H9Z" fill="#a9c47f"/>' +
    '<path d="M18 80 V44 M76 80 V44" stroke="#6b4a2b" stroke-width="7" stroke-linecap="round"/>' +
    '<path d="M25 78 V50 M36 78 V50 M47 78 V50 M58 78 V50 M69 78 V50" stroke="#a87444" stroke-width="5" stroke-linecap="round"/>' +
    '<path d="M22 56 H72 M22 70 H72" stroke="#8a5a33" stroke-width="4"/>' +
    '<circle cx="64" cy="63" r="3" fill="#f2c94c"/>',
  hedge:
    '<path d="M9 78 H85 V99 H9Z" fill="#9bc27a"/>' +
    '<path d="M12 78 C 12 54, 28 52, 34 60 C 38 44, 56 44, 60 58 C 66 50, 82 54, 82 78Z" fill="#4f8a3a"/>' +
    '<circle cx="30" cy="66" r="3" fill="#c4452e"/><circle cx="48" cy="58" r="3" fill="#c4452e"/><circle cx="68" cy="68" r="3" fill="#c4452e"/>',
  teapot:
    '<g transform="translate(47 60)">' +
    '<path d="M-26 -6 C -30 18, -14 28, 0 28 C 14 28, 30 18, 26 -6Z" fill="#7fb7c9"/>' +
    '<path d="M-26 -6 C -18 -14, 18 -14, 26 -6 C 18 0, -18 0, -26 -6Z" fill="#a8d6e3"/>' +
    '<path d="M26 0 C 40 -2, 40 18, 26 18" stroke="#6aa2b4" stroke-width="6" fill="none"/>' +
    '<path d="M-26 6 C -38 2, -42 -10, -38 -16" stroke="#7fb7c9" stroke-width="7" fill="none" stroke-linecap="round"/>' +
    '<path d="M-10 -10 C -10 -22, 10 -22, 10 -10Z" fill="#e5a1a8"/><circle cy="-22" r="4" fill="#e5a1a8"/>' +
    '<path d="M-6 -34 q4 -6 0 -12 M6 -32 q4 -6 0 -12" stroke="#fff" stroke-width="2.5" fill="none" opacity=".8" stroke-linecap="round"/>' +
    "</g>",
  pietin:
    '<g transform="translate(47 58)">' +
    '<ellipse cx="0" cy="14" rx="30" ry="9" fill="#c9ccd1"/>' +
    '<path d="M-26 10 C -26 -14, 26 -14, 26 10 C 14 18, -14 18, -26 10Z" fill="#d9a05b"/>' +
    '<path d="M-26 10 C -26 -14, 26 -14, 26 10" stroke="#8a5a33" stroke-width="4" fill="none"/>' +
    '<path d="M-14 -4 L14 6 M-14 6 L14 -4" stroke="#8a5a33" stroke-width="3" fill="none" stroke-linecap="round"/>' +
    '<path d="M-6 -22 q4 -6 0 -12 M6 -20 q4 -6 0 -12" stroke="#fff" stroke-width="2.5" fill="none" opacity=".8" stroke-linecap="round"/>' +
    "</g>",
  seal:
    '<g transform="translate(47 54)">' +
    '<path d="M-24 14 C -26 -12, 18 -16, 22 6 C 24 16, 8 26, -4 26 C -16 26, -22 22, -24 14Z" fill="#e5a1a8"/>' +
    '<path d="M-24 14 C -26 -12, 18 -16, 22 6" stroke="#c4452e" stroke-width="4" fill="none"/>' +
    '<path d="M-12 4 L6 4 M-12 12 L2 12 M-12 -4 L8 -4" stroke="#fffaf0" stroke-width="3" stroke-linecap="round"/>' +
    '<circle cx="14" cy="14" r="9" fill="#c4452e"/><circle cx="14" cy="14" r="4" fill="#fffaf0"/>' +
    "</g>",
  kitten:
    '<g transform="translate(47 56)">' +
    '<path d="M-22 -10 L-20 -30 L-8 -18 L8 -18 L20 -30 L22 -10 C 26 10, 12 24, 0 24 C -12 24, -26 10, -22 -10Z" fill="#a66a33"/>' +
    '<circle cx="-9" cy="-2" r="4" fill="#fffaf0"/><circle cx="9" cy="-2" r="4" fill="#fffaf0"/>' +
    '<circle cx="-9" cy="-2" r="2" fill="#2a2b1f"/><circle cx="9" cy="-2" r="2" fill="#2a2b1f"/>' +
    '<path d="M-3 8 H3 L0 12Z" fill="#e5a1a8"/>' +
    '<path d="M-20 8 L-34 6 M-20 12 L-34 14 M20 8 L34 6 M20 12 L34 14" stroke="#fffaf0" stroke-width="2" stroke-linecap="round"/>' +
    "</g>",
  dove:
    '<g transform="translate(47 54)">' +
    '<path d="M-26 10 C -26 -6, -10 -12, 4 -8 C 10 -22, 22 -20, 22 -10 L 30 -6 L 22 -2 C 22 14, 6 24, -8 24 C -18 24, -24 18, -26 10Z" fill="#fffaf0"/>' +
    '<path d="M-26 10 C -40 8, -42 -2, -38 -6 C -34 2, -30 4, -24 4Z" fill="#dfe6ee"/>' +
    '<path d="M-10 4 C -2 -6, 8 0, 4 12 C -2 14, -8 12, -10 4Z" fill="#dfe6ee"/>' +
    '<circle cx="17" cy="-12" r="2" fill="#2a2b1f"/>' +
    '<path d="M30 -6 L 38 -4 L 30 -2Z" fill="#e3a43a"/>' +
    "</g>",
  sprig:
    '<g transform="translate(47 56)">' +
    '<path d="M0 30 C -2 14, 2 -4, 0 -26" stroke="#5f7d43" stroke-width="4" fill="none" stroke-linecap="round"/>' +
    '<ellipse cx="-13" cy="-4" rx="11" ry="5" fill="#78a943" transform="rotate(-35 -13 -4)"/>' +
    '<ellipse cx="13" cy="-12" rx="11" ry="5" fill="#78a943" transform="rotate(35 13 -12)"/>' +
    '<ellipse cx="-12" cy="12" rx="11" ry="5" fill="#9bc27a" transform="rotate(-35 -12 12)"/>' +
    '<ellipse cx="12" cy="6" rx="11" ry="5" fill="#9bc27a" transform="rotate(35 12 6)"/>' +
    '<circle cy="-30" r="6" fill="#f2c94c"/><circle cy="-30" r="2.5" fill="#e3a43a"/>' +
    "</g>",
};

/** A plain postmark-and-border stamp for anything with no motif of its own. */
export const GENERIC_MOTIF =
  '<g transform="translate(47 56)"><circle r="26" fill="none" stroke="#8a5a33" stroke-width="4"/>' +
  '<circle r="17" fill="#fffaf0" opacity=".7"/><path d="M-12 8 C -6 -10, 6 -10, 12 8" stroke="#5f9a3a" stroke-width="4" fill="none" stroke-linecap="round"/>' +
  '<circle cy="-4" r="4" fill="#f2c94c"/></g>';

const has = (o: object, k: string): boolean => Object.prototype.hasOwnProperty.call(o, k);

/** The art for a stamp: its own motif, else the one keyed by its route id, else the generic stamp. Never undefined. */
export function motifArt(motif: string, routeId?: string): string {
  if (has(SPRING_MOTIFS, motif)) return SPRING_MOTIFS[motif as SpringMotif];
  if (has(LATER_MOTIFS, motif)) return LATER_MOTIFS[motif];
  if (routeId !== undefined && has(LATER_MOTIFS, routeId)) return LATER_MOTIFS[routeId];
  return GENERIC_MOTIF;
}

/** A perforated stamp, 94 x 108, drawn on a card of colour `edge`. `routeId` is the fallback key for the art. */
export function stampSvg(s: Stamp, edge = "#2a2b1f", routeId?: string): string {
  let perf = "";
  for (let x = 6; x <= 88; x += 9.1) perf += `<circle cx="${x.toFixed(1)}" cy="0" r="3.4"/><circle cx="${x.toFixed(1)}" cy="108" r="3.4"/>`;
  for (let y = 6; y <= 102; y += 9.6) perf += `<circle cx="0" cy="${y.toFixed(1)}" r="3.4"/><circle cx="94" cy="${y.toFixed(1)}" r="3.4"/>`;
  return (
    `<svg viewBox="0 0 94 108" class="door-stampart" aria-hidden="true">` +
    `<rect width="94" height="108" fill="#fffaf0"/><g fill="${edge}">${perf}</g>` +
    `<rect x="9" y="9" width="76" height="90" fill="${s.sky}"/>` +
    motifArt(s.motif, routeId) +
    `<text x="80" y="26" text-anchor="end" font-family="Fraunces, Georgia, serif" font-weight="900" font-size="17" fill="#c4452e">${s.value}¢</text>` +
    `</svg>`
  );
}
