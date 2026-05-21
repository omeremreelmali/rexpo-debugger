#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pngToIco from "png-to-ico";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const assets = resolve(root, "assets");
const iconsDir = resolve(assets, "icons");

const SVG = resolve(assets, "icon.svg");
const ICONSET = resolve(assets, "icon.iconset");
const ICNS = resolve(assets, "icon.icns");
const ICO = resolve(assets, "icon.ico");
const PNG_512 = resolve(assets, "icon.png");
const FAVICON_32 = resolve(assets, "favicon.png");

const PNG_SIZES = [16, 32, 48, 64, 128, 256, 512, 1024];

// .icns iconset uses Apple's required size + scale matrix.
const ICONSET_FILES = [
  { name: "icon_16x16.png", size: 16 },
  { name: "icon_16x16@2x.png", size: 32 },
  { name: "icon_32x32.png", size: 32 },
  { name: "icon_32x32@2x.png", size: 64 },
  { name: "icon_128x128.png", size: 128 },
  { name: "icon_128x128@2x.png", size: 256 },
  { name: "icon_256x256.png", size: 256 },
  { name: "icon_256x256@2x.png", size: 512 },
  { name: "icon_512x512.png", size: 512 },
  { name: "icon_512x512@2x.png", size: 1024 },
];

async function main() {
  console.log("[icons] reading SVG →", SVG);
  const svg = readFileSync(SVG);

  mkdirSync(iconsDir, { recursive: true });
  rmSync(ICONSET, { recursive: true, force: true });
  mkdirSync(ICONSET, { recursive: true });

  // Render SVG once at 1024×1024 master bitmap, then resize from that.
  const master = await sharp(svg, { density: 384 })
    .resize(1024, 1024)
    .png({ compressionLevel: 9 })
    .toBuffer();

  const renderAt = async (size, out) => {
    await sharp(master)
      .resize(size, size)
      .png({ compressionLevel: 9 })
      .toFile(out);
  };

  // 1. Plain PNG sizes
  for (const size of PNG_SIZES) {
    const out = resolve(iconsDir, `${size}.png`);
    await renderAt(size, out);
    console.log(`[icons] wrote ${out}`);
  }

  // 512 PNG at root (Linux AppImage uses this)
  await renderAt(512, PNG_512);
  console.log(`[icons] wrote ${PNG_512}`);

  // 32px favicon convenience copy
  await renderAt(32, FAVICON_32);
  console.log(`[icons] wrote ${FAVICON_32}`);

  // 2. .iconset → .icns (macOS)
  for (const { name, size } of ICONSET_FILES) {
    await renderAt(size, resolve(ICONSET, name));
  }
  execFileSync("iconutil", ["-c", "icns", ICONSET, "-o", ICNS], {
    stdio: "inherit",
  });
  console.log(`[icons] wrote ${ICNS}`);
  rmSync(ICONSET, { recursive: true, force: true });

  // 3. .ico (Windows) — multi-resolution from 16/32/48/64/128/256
  const icoBuffers = await Promise.all(
    [16, 32, 48, 64, 128, 256].map((size) =>
      sharp(master)
        .resize(size, size)
        .png({ compressionLevel: 9 })
        .toBuffer()
    )
  );
  const ico = await pngToIco(icoBuffers);
  writeFileSync(ICO, ico);
  console.log(`[icons] wrote ${ICO}`);

  console.log("[icons] done");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
