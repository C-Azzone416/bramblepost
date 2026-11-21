/**
 * Stamp artwork for the later villages, one motif per route, keyed by ROUTE ID.
 * Same style as the spring motifs in stamp.ts: flat colour, soft outlines, drawn inside the
 * 76 x 90 picture window (x 9-85, y 9-99) with the value printed at the top right. No text in the art.
 * Hollowmere (summer): mere, sunflowers, jetty, boat. Conker Corner (autumn): chestnut wood,
 * windmill, leaves, gusts. Snowberry End (winter): ice lake, boardwalk, lamp posts, snow.
 */

const BROWN = "#6b4a2b";
const WOOD = "#a87444";
const PLANK = "#8a5a33";

const ground = (c: string, y = 80) => `<path d="M9 ${y} H85 V99 H9Z" fill="${c}"/>`;
const water = (y: number, c: string, foam = true) =>
  `<path d="M9 ${y} C 30 ${y - 6}, 50 ${y + 6}, 85 ${y - 2} V99 H9Z" fill="${c}"/>` +
  (foam ? `<path d="M14 ${y + 10} C 30 ${y + 4}, 50 ${y + 16}, 80 ${y + 8}" stroke="#fff" stroke-width="2" fill="none" opacity=".6"/>` : "");

/** A sunflower head at (x, y), scale s; rot turns the petals. */
const flower = (x: number, y: number, s: number, rot = 0, petal = "#f2c94c") =>
  `<g transform="translate(${x} ${y}) scale(${s}) rotate(${rot})">` +
  [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((a) => `<ellipse cy="-13" rx="4.5" ry="9" fill="${petal}" transform="rotate(${a})"/>`).join("") +
  '<circle r="9" fill="#7a4d2a"/><circle r="4.5" fill="#5a3a1f"/></g>';
const stem = (x: number, y0: number, y1: number) =>
  `<path d="M${x} ${y1} L${x} ${y0}" stroke="#5f7d43" stroke-width="4" stroke-linecap="round"/>` +
  `<ellipse cx="${x - 7}" cy="${(y0 + y1) / 2 + 4}" rx="7" ry="3.5" fill="#78a943" transform="rotate(-30 ${x - 7} ${(y0 + y1) / 2 + 4})"/>`;

const leaf = (x: number, y: number, s: number, rot: number, c: string) =>
  `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${s})">` +
  `<path d="M0 -16 L4 -8 L12 -10 L8 -2 L14 2 L5 4 L6 12 L0 8 L-6 12 L-5 4 L-14 2 L-8 -2 L-12 -10 L-4 -8Z" fill="${c}"/>` +
  `<path d="M0 -8 V16" stroke="${BROWN}" stroke-width="2" stroke-linecap="round"/></g>`;
const gust = (x: number, y: number, w: number) =>
  `<path d="M${x} ${y} H${x + w} c 8 0 8 -9 0 -9 M${x + 6} ${y + 8} H${x + w - 6} c 6 0 6 7 0 7" stroke="#fff" stroke-width="2.5" fill="none" stroke-linecap="round" opacity=".85"/>`;
const steam = (x: number, y: number) =>
  `<path d="M${x - 6} ${y} q4 -6 0 -12 M${x + 6} ${y + 2} q4 -6 0 -12" stroke="#fff" stroke-width="2.5" fill="none" opacity=".8" stroke-linecap="round"/>`;
const pie = (x: number, y: number, s = 1) =>
  `<g transform="translate(${x} ${y}) scale(${s})"><ellipse cy="12" rx="26" ry="8" fill="#c9ccd1"/>` +
  '<path d="M-22 8 C -22 -12, 22 -12, 22 8 C 12 15, -12 15, -22 8Z" fill="#d9a05b"/>' +
  '<path d="M-22 8 C -22 -12, 22 -12, 22 8" stroke="#8a5a33" stroke-width="3.5" fill="none"/>' +
  '<path d="M-12 -2 L12 6 M-12 6 L12 -2" stroke="#8a5a33" stroke-width="2.5" fill="none" stroke-linecap="round"/></g>';
const parcel = (x: number, y: number, s: number, c: string, rot = 0) =>
  `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${s})"><rect x="-18" y="-13" width="36" height="26" rx="3" fill="${c}"/>` +
  '<path d="M-6 -13 V13 M6 -13 V13" stroke="#fffaf0" stroke-width="3"/><path d="M-18 0 H18" stroke="#fffaf0" stroke-width="3"/></g>';
const key = (x: number, y: number, s: number, rot: number) =>
  `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${s})"><circle cx="-14" r="8" fill="none" stroke="#e3a43a" stroke-width="5"/>` +
  '<path d="M-6 0 H18 M12 0 V8 M18 0 V6" stroke="#e3a43a" stroke-width="5" stroke-linecap="round"/></g>';
const bridge = (y: number) =>
  `<path d="M12 ${y} Q 47 ${y - 40} 82 ${y}" stroke="${PLANK}" stroke-width="6" fill="none" stroke-linecap="round"/>` +
  `<path d="M26 ${y - 12} v12 M36 ${y - 19} v19 M47 ${y - 21} v21 M58 ${y - 19} v19 M68 ${y - 12} v12" stroke="${WOOD}" stroke-width="3"/>`;
const jetty = (y: number) =>
  `<path d="M9 ${y} H62" stroke="${PLANK}" stroke-width="7"/><path d="M14 ${y + 3} v14 M30 ${y + 3} v14 M46 ${y + 3} v14 M60 ${y + 3} v14" stroke="${BROWN}" stroke-width="4" stroke-linecap="round"/>`;
const boat = (x: number, y: number, s = 1, hull = "#c4452e") =>
  `<g transform="translate(${x} ${y}) scale(${s})"><path d="M-20 0 H20 L14 10 H-14Z" fill="${hull}"/>` +
  `<path d="M0 -2 V-26" stroke="${BROWN}" stroke-width="2.5"/><path d="M2 -26 L16 -6 H2Z" fill="#fffaf0"/></g>`;
const windmill = (x: number, y: number, s: number, rot = 0, body = "#e8d3a8", edge = "none") =>
  `<g transform="translate(${x} ${y}) scale(${s})"><path d="M-12 30 L-7 -4 H7 L12 30Z" fill="${body}" stroke="${edge}" stroke-width="2" stroke-linejoin="round"/>` +
  '<path d="M-7 -4 L0 -14 L7 -4Z" fill="#c4452e"/><rect x="-4" y="16" width="8" height="14" rx="3" fill="#8a5a33"/>' +
  `<g transform="translate(0 -6) rotate(${rot})">` +
  [0, 90, 180, 270].map((a) => `<g transform="rotate(${a})"><path d="M0 0 V-26" stroke="${BROWN}" stroke-width="2.5"/><path d="M1 -24 H9 V-10 H1Z" fill="#fffaf0" stroke="${BROWN}" stroke-width="1.5"/></g>`).join("") +
  '<circle r="3.5" fill="#6b4a2b"/></g></g>';
const conker = (x: number, y: number, s = 1) =>
  `<g transform="translate(${x} ${y}) scale(${s})"><path d="M-12 4 C -12 -10, 12 -10, 12 4 C 12 14, -12 14, -12 4Z" fill="#8a4a24"/>` +
  '<path d="M-6 -3 C -3 -7, 3 -7, 6 -3" stroke="#c98a55" stroke-width="2.5" fill="none" stroke-linecap="round"/><path d="M-3 -10 L0 -15 L3 -10Z" fill="#6b4a2b"/></g>';
const snow = (y = 80) => `<path d="M9 ${y} C 28 ${y - 6}, 56 ${y + 4}, 85 ${y - 4} V99 H9Z" fill="#fffaf0"/>`;
const flake = (x: number, y: number, s: number) =>
  `<g transform="translate(${x} ${y}) scale(${s})" stroke="#fff" stroke-width="2.5" stroke-linecap="round" fill="none">` +
  [0, 60, 120].map((a) => `<path d="M0 -9 V9 M-3 -6 L0 -9 L3 -6 M-3 6 L0 9 L3 6" transform="rotate(${a})"/>`).join("") + "</g>";
const lamp = (x: number, y: number, h: number) =>
  `<path d="M${x} ${y} V${y - h}" stroke="#3f4a52" stroke-width="3.5" stroke-linecap="round"/>` +
  `<rect x="${x - 5}" y="${y - h - 11}" width="10" height="12" rx="3" fill="#f2c94c"/><path d="M${x - 7} ${y - h - 11} L${x} ${y - h - 17} L${x + 7} ${y - h - 11}Z" fill="#3f4a52"/>`;
const ice = (y: number) =>
  `<path d="M9 ${y} H85 V99 H9Z" fill="#bfe3ef"/><path d="M18 ${y + 8} L34 ${y + 14} M52 ${y + 6} L70 ${y + 12} M28 ${y + 20} L44 ${y + 24}" stroke="#fff" stroke-width="2.5" stroke-linecap="round" opacity=".8"/>`;
const berries = (x: number, y: number) =>
  `<g transform="translate(${x} ${y})"><path d="M0 14 C -2 6, 2 -2, 0 -10" stroke="#5f7d43" stroke-width="3" fill="none" stroke-linecap="round"/>` +
  '<circle cx="-6" cy="0" r="5" fill="#fffaf0" stroke="#e5a1a8" stroke-width="1.5"/><circle cx="6" cy="-4" r="5" fill="#fffaf0" stroke="#e5a1a8" stroke-width="1.5"/><circle cx="1" cy="8" r="5" fill="#fffaf0" stroke="#e5a1a8" stroke-width="1.5"/>' +
  '<ellipse cx="-9" cy="-12" rx="6" ry="3" fill="#78a943" transform="rotate(-30 -9 -12)"/></g>';

const planks = (x: number, y: number, w: number, h: number, vertical = false) => {
  let lines = "";
  for (let i = 1; i < (vertical ? h : w) / 6; i++) lines += vertical ? `M${x} ${y + i * 6} H${x + w} ` : `M${x + i * 6} ${y} V${y + h} `;
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="1.5" fill="${WOOD}" stroke="${BROWN}" stroke-width="2"/><path d="${lines}" stroke="${BROWN}" stroke-width="1.5"/>`;
};
const bank = (x: number, y: number, w: number, h: number) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#8a6a4a"/><path d="M${x} ${y + 8} Q ${x + w / 2} ${y - 4} ${x + w} ${y + 8} V${y - 2} Q ${x + w / 2} ${y - 12} ${x} ${y - 2}Z" fill="#fffaf0" stroke="#5b8fa3" stroke-width="2"/>` +
  `<path d="M${x} ${y + 8} Q ${x + w / 2} ${y - 4} ${x + w} ${y + 8} V${y + 14} H${x}Z" fill="#fffaf0"/>`;
const STREAM = "#5f9fba";
const crack = (d: string) => `<path d="${d}" stroke="#fff" stroke-width="2.5" stroke-linecap="round" fill="none" opacity=".85"/>`;

export const LATER_MOTIFS: Record<string, string> = {
  /* ---- Hollowmere: summer ---- */
  // a sunflower turning, with a curved turn mark
  "summer-1": ground("#bcd58a", 82) + stem(47, 62, 84) + flower(47, 54, 1) + '<path d="M22 40 A 28 28 0 0 1 36 24" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" opacity=".85"/>',
  // sunflower with a dotted path winding to the side
  "summer-2": ground("#bcd58a", 82) + stem(32, 56, 84) + flower(32, 48, 0.8) + '<path d="M44 90 C 54 74, 62 94, 78 70" stroke="#fffaf0" stroke-width="3" stroke-dasharray="1 6" stroke-linecap="round" fill="none"/>',
  // two sunflowers of different size
  "summer-3": ground("#bcd58a", 82) + stem(30, 56, 84) + flower(30, 50, 0.85) + stem(62, 66, 84) + flower(62, 60, 0.6, 15, "#f6dd7a"),
  // sunflower beside a warm pie
  "summer-4": ground("#c9d89a", 82) + stem(28, 52, 84) + flower(28, 46, 0.75) + pie(58, 66, 0.9) + steam(58, 50),
  // footbridge over the mere with a sunflower on the bank
  "summer-5": water(72, "#7fb7c9") + bridge(70) + stem(20, 40, 72) + flower(20, 36, 0.5),
  // parcel with a seal, sunflower tucked beside
  "summer-6": ground("#bcd58a", 82) + parcel(42, 62, 1.1, "#d9a35c") + '<circle cx="42" cy="62" r="6" fill="#c4452e"/><circle cx="42" cy="62" r="2.5" fill="#fffaf0"/>' + flower(66, 70, 0.4),
  // two sunflowers facing together with a small sun
  "summer-7": ground("#bcd58a", 82) + stem(33, 60, 84) + flower(33, 54, 0.8, 0) + stem(61, 60, 84) + flower(61, 54, 0.8, 15) + '<circle cx="47" cy="30" r="6" fill="#f6dd7a" opacity=".8"/>',
  // a row of tiles with a sunflower sliding off the end
  "summer-8": '<path d="M9 78 H85 V99 H9Z" fill="#cdd9a0"/>' + [14, 34, 54].map((x) => `<rect x="${x}" y="52" width="17" height="17" rx="3" fill="#e8d3a8" stroke="${WOOD}" stroke-width="2"/>`).join("") + flower(76, 60, 0.55) + '<path d="M12 44 H68" stroke="#fff" stroke-width="2.5" stroke-dasharray="1 6" stroke-linecap="round"/>',
  // sunflower, footbridge and pie together
  "summer-9": water(76, "#7fb7c9") + bridge(72) + pie(47, 38, 0.55) + stem(70, 54, 78) + flower(70, 48, 0.4),
  // mere at golden hour: jetty, boat, sunflowers
  "summer-10": '<path d="M9 9 H85 V60 H9Z" fill="#f6dd7a" opacity=".6"/>' + water(62, "#7fb7c9") + jetty(66) + boat(60, 70, 0.9) + stem(18, 36, 66) + flower(18, 32, 0.5),

  /* ---- Conker Corner: autumn ---- */
  // windmill with a gust to its left
  "autumn-1": ground("#d9b878") + windmill(42, 50, 0.85, 12, "#c98a55", BROWN) + gust(12, 40, 14),
  // a leaf blown sideways
  "autumn-2": ground("#d9b878") + leaf(52, 52, 1.5, 70, "#d9732e") + gust(12, 42, 22) + gust(12, 66, 18),
  // leaves falling down a single line
  "autumn-3": ground("#d9b878") + leaf(40, 30, 0.6, 10, "#e0a030") + leaf(40, 48, 0.7, -20, "#d9732e") + leaf(40, 68, 0.8, 25, "#b8452e") + '<path d="M20 22 V74 M60 40 V74" stroke="#fff" stroke-width="2.5" stroke-dasharray="1 7" stroke-linecap="round" opacity=".8"/>',
  // pie with a leaf and a gust
  "autumn-4": ground("#d9b878") + pie(48, 62, 1) + steam(48, 46) + leaf(24, 36, 0.6, -30, "#d9732e") + gust(11, 62, 8),
  // leaves rising over a little footbridge
  "autumn-5": water(76, "#8fb8c0", false) + bridge(74) + leaf(30, 30, 0.7, 160, "#b8452e") + leaf(46, 22, 0.55, 190, "#e0a030"),
  // windmill and a sunflower in the same field
  "autumn-6": ground("#d9b878") + windmill(32, 48, 0.8, 30) + stem(66, 62, 84) + flower(66, 56, 0.6) + gust(50, 42, 6),
  // a key resting on a chestnut leaf with a parcel
  "autumn-7": ground("#d9b878") + leaf(40, 60, 1.6, 20, "#c4793a") + key(46, 56, 0.9, -20) + parcel(66, 74, 0.45, "#a66a33"),
  // pie tin with swirling gusts and a leaf
  "autumn-8": ground("#d9b878") + pie(50, 62, 0.9) + gust(12, 30, 22) + gust(46, 38, 14) + leaf(24, 56, 0.55, 40, "#b8452e"),
  // windmill by a footbridge with a leaf drifting
  "autumn-9": water(78, "#8fb8c0", false) + windmill(26, 46, 0.7, -15) + bridge(76) + leaf(66, 38, 0.6, 20, "#d9732e"),
  // a chestnut tree with fallen conkers
  "autumn-10": ground("#d9b878", 84) + '<g transform="translate(-2 12) scale(.85)">' + `<path d="M47 86 C 44 70, 50 60, 47 46" stroke="${BROWN}" stroke-width="7" fill="none" stroke-linecap="round"/>` +
    '<circle cx="47" cy="38" r="22" fill="#d9732e"/><circle cx="32" cy="46" r="13" fill="#e0a030"/><circle cx="62" cy="46" r="13" fill="#b8452e"/></g>' + conker(26, 88, 0.55) + conker(68, 90, 0.55),

  /* ---- Snowberry End: winter ---- */
  // a plank boardwalk across a frozen stream, a bank each side
  "winter-1": `<rect x="9" y="50" width="76" height="49" fill="${STREAM}"/>` + crack("M38 84 L50 90 M58 78 L70 82") + bank(9, 52, 22, 47) + bank(63, 52, 22, 47) + planks(24, 62, 46, 11),
  // two banks lined up in one row, planks across the ice
  "winter-2": `<rect x="9" y="46" width="76" height="53" fill="${STREAM}"/>` + crack("M36 84 L48 90 M54 82 L66 86") + `<rect x="9" y="46" width="24" height="53" fill="#8a6a4a"/><rect x="61" y="46" width="24" height="53" fill="#8a6a4a"/>` + `<path d="M9 46 H33 V54 H9Z M61 46 H85 V54 H61Z" fill="#fffaf0" stroke="#5b8fa3" stroke-width="2"/>` + planks(33, 64, 12, 10) + planks(49, 64, 12, 10) + `<rect x="14" y="62" width="19" height="14" fill="#e8d3a8" stroke="${BROWN}" stroke-width="2"/><rect x="61" y="62" width="19" height="14" fill="#e8d3a8" stroke="${BROWN}" stroke-width="2"/>` + lamp(20, 46, 20),
  // two stepping planks that land a row over
  "winter-3": `<rect x="9" y="30" width="76" height="69" fill="${STREAM}"/>` + crack("M18 92 L34 88 M56 94 L74 90") + `<rect x="9" y="42" width="22" height="16" fill="#8a6a4a"/><path d="M9 42 H31" stroke="#fffaf0" stroke-width="6"/>` + planks(32, 40, 18, 16) + planks(48, 56, 18, 16) + `<rect x="64" y="58" width="21" height="14" fill="#8a6a4a"/><path d="M64 60 H85" stroke="#fffaf0" stroke-width="5"/>`,
  // pie steaming over the ice
  "winter-4": ice(60) + pie(47, 50, 0.95) + steam(47, 34) + flake(24, 28, 0.9),
  // a boardwalk with three lamp posts
  "winter-5": '<path d="M9 62 H85" stroke="#fff" stroke-width="0"/>' + ice(76) + '<path d="M9 66 H85 V76 H9Z" fill="#a87444"/><path d="M9 66 H85" stroke="#6b4a2b" stroke-width="3"/>' + [16, 34, 52].map((x) => lamp(x, 66, 30)).join(""),
  // snow whipping sideways in a gust
  "winter-6": snow(82) + gust(14, 40, 40) + flake(30, 62, 1) + flake(40, 26, 0.8) + flake(66, 58, 0.9),
  // a key and a parcel half buried in snow
  "winter-7": snow(78) + parcel(36, 62, 1, "#7fb7c9", -8) + key(66, 62, 0.8, 30) + flake(26, 30, 0.9),
  // a snowberry sprig with a gust
  "winter-8": snow(84) + berries(40, 56) + berries(56, 44) + gust(14, 32, 14),
  // a sunflower beside a bridge in the snow
  "winter-9": snow(82) + stem(30, 56, 84) + flower(30, 50, 0.7, 0, "#f6dd7a") + bridge(78) + flake(44, 28, 0.8),
  // lamp post by the ice lake, berries underneath, and falling snow
  "winter-10": ice(66) + snow(84) + lamp(34, 76, 40) + berries(62, 66) + flake(52, 38, 0.8) + flake(20, 30, 0.7) + flake(72, 48, 0.6),
};
