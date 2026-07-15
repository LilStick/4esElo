// Regenerate every raster brand asset from the committed vector masters.
// Never hand-edit the PNGs / .ico - edit the SVGs and re-run this.
//   pnpm add -Dw sharp png-to-ico
//   node scripts/generate-retake-assets.mjs
import { promises as fs } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import pngToIcoImport from "png-to-ico";

const pngToIco = pngToIcoImport.default ?? pngToIcoImport;
const root = process.cwd();
const publicDir = path.join(root, "apps/web/public");

const faviconSvg = await fs.readFile(path.join(publicDir, "favicon.svg"));
const maskableSvg = await fs.readFile(path.join(publicDir, "favicon-maskable.svg"));
const ogSvg = await fs.readFile(path.join(publicDir, "og-default.svg"));

// Square icons from the rounded (favicon) and full-bleed (maskable) masters.
const jobs = [
  ["favicon-16.png", 16, faviconSvg],
  ["favicon-32.png", 32, faviconSvg],
  ["apple-touch-icon.png", 180, faviconSvg],
  ["icon-192.png", 192, faviconSvg],
  ["icon-512.png", 512, faviconSvg],
  ["icon-192-maskable.png", 192, maskableSvg],
  ["icon-512-maskable.png", 512, maskableSvg],
];
for (const [name, size, svg] of jobs) {
  await sharp(svg).resize(size, size).png().toFile(path.join(publicDir, name));
}

// Multi-size .ico (16/32/48) from the favicon master.
const icoBufs = [];
for (const size of [16, 32, 48]) {
  icoBufs.push(await sharp(faviconSvg).resize(size, size).png().toBuffer());
}
await fs.writeFile(path.join(publicDir, "favicon.ico"), await pngToIco(icoBufs));

// Open Graph card (1200x630) from the vector template.
await sharp(ogSvg).resize(1200, 630).png().toFile(path.join(publicDir, "og-default.png"));

console.log(`Regenerated ${jobs.length} icons + favicon.ico + og-default.png from vector masters.`);
