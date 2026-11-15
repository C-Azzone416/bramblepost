/** Postage stamp artwork for the door scene's reward card. Returns SVG markup. */
import type { Stamp } from "./story";

const MOTIFS: Record<Stamp["motif"], string> = {
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
  teapot:
    '<g transform="translate(47 60)">' +
    '<path d="M-26 -6 C -30 18, -14 28, 0 28 C 14 28, 30 18, 26 -6Z" fill="#7fb7c9"/>' +
    '<path d="M-26 -6 C -18 -14, 18 -14, 26 -6 C 18 0, -18 0, -26 -6Z" fill="#a8d6e3"/>' +
    '<path d="M26 0 C 40 -2, 40 18, 26 18" stroke="#6aa2b4" stroke-width="6" fill="none"/>' +
    '<path d="M-26 6 C -38 2, -42 -10, -38 -16" stroke="#7fb7c9" stroke-width="7" fill="none" stroke-linecap="round"/>' +
    '<path d="M-10 -10 C -10 -22, 10 -22, 10 -10Z" fill="#e5a1a8"/><circle cy="-22" r="4" fill="#e5a1a8"/>' +
    '<path d="M-6 -34 q4 -6 0 -12 M6 -32 q4 -6 0 -12" stroke="#fff" stroke-width="2.5" fill="none" opacity=".8" stroke-linecap="round"/>' +
    "</g>",
};

/** A perforated stamp, 94 x 108, drawn on a card of colour `edge`. */
export function stampSvg(s: Stamp, edge = "#2a2b1f"): string {
  let perf = "";
  for (let x = 6; x <= 88; x += 9.1) perf += `<circle cx="${x.toFixed(1)}" cy="0" r="3.4"/><circle cx="${x.toFixed(1)}" cy="108" r="3.4"/>`;
  for (let y = 6; y <= 102; y += 9.6) perf += `<circle cx="0" cy="${y.toFixed(1)}" r="3.4"/><circle cx="94" cy="${y.toFixed(1)}" r="3.4"/>`;
  return (
    `<svg viewBox="0 0 94 108" class="door-stampart" aria-hidden="true">` +
    `<rect width="94" height="108" fill="#fffaf0"/><g fill="${edge}">${perf}</g>` +
    `<rect x="9" y="9" width="76" height="90" fill="${s.sky}"/>` +
    MOTIFS[s.motif] +
    `<text x="80" y="26" text-anchor="end" font-family="Fraunces, Georgia, serif" font-weight="900" font-size="17" fill="#c4452e">${s.value}¢</text>` +
    `</svg>`
  );
}
