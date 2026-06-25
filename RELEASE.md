# Release checklist

Two artifacts ship from this repo, **versioned independently**:

| Artifact | Package / name | Where | Bump when… |
|---|---|---|---|
| **Desktop app** | `expo-network-inspector` (`package.json`) | GitHub Releases + website downloads | the desktop UI changes (tabs, panels, etc.) |
| **Agent (npm)** | `rexpo-debugger` (`expo-agent/package.json`) | npmjs.com | the agent API changes (`expo-agent/src/**`) |

A change touching `expo-agent/src` → bump **both** (agent for the API, desktop if UI changed too).
SemVer: new feature → minor; bug fix → patch.

## Prerequisites

- **Node 18+** — the build fails on the default Node 16 (`crypto.getRandomValues`). Use nvm:
  `export PATH="$HOME/.nvm/versions/node/v20.19.4/bin:$PATH"`
- **Docker** running — needed to build Windows + Linux from macOS (electron-builder `wine` image).
- macOS signing: the `Developer ID` cert (`BMVRWVA79B`) is **not** on this machine, so builds are
  **unsigned** and must be **deep ad-hoc signed** (see Gotchas) or they show "damaged" on Apple Silicon.

---

## 1. Bump versions

```bash
# desktop
node -e "const p=require('./package.json');p.version='X.Y.Z';require('fs').writeFileSync('package.json',JSON.stringify(p,null,2)+'\n')"
# agent (only if expo-agent/src changed)
node -e "const p=require('./expo-agent/package.json');p.version='A.B.C';require('fs').writeFileSync('expo-agent/package.json',JSON.stringify(p,null,2)+'\n')"
```

Commit + push the code first.

## 2. Build desktop packages (unsigned, all platforms)

```bash
export PATH="$HOME/.nvm/versions/node/v20.19.4/bin:$PATH"
export CSC_IDENTITY_AUTO_DISCOVERY=false
VER=X.Y.Z

# macOS — build then DEEP AD-HOC SIGN each .app and repackage the DMG via hdiutil
npm run build
npx electron-builder --mac -c.mac.identity=null
for pair in "mac-arm64:-arm64" "mac:"; do
  app="release/${pair%%:*}/Rexpo Network Inspector.app"
  codesign --force --deep --sign - "$app"
  codesign --verify --deep --strict "$app"            # must pass
  st=$(mktemp -d); cp -R "$app" "$st/"; ln -s /Applications "$st/Applications"
  out="release/Rexpo Network Inspector-${VER}${pair##*:}.dmg"; rm -f "$out"
  hdiutil create -volname "Rexpo Network Inspector ${VER}${pair##*:}" -srcfolder "$st" -ov -format UDZO "$out"
done

# Linux (AppImage) + Windows (ZIP — NSIS installer can't be built here, see Gotchas) via Docker
docker run --rm -v "$PWD":/project -v ~/.cache/electron:/root/.cache/electron \
  -v ~/.cache/electron-builder:/root/.cache/electron-builder -w /project \
  electronuserland/builder:wine \
  /bin/bash -c "node_modules/.bin/electron-builder --linux && node_modules/.bin/electron-builder --win zip -c.win.signAndEditExecutable=false"
```

Artifacts land in `release/`:
`…-${VER}-arm64.dmg`, `…-${VER}.dmg`, `…-${VER}-arm64.AppImage`, `…-${VER}.AppImage`, `…-${VER}-win.zip`.

## 3. GitHub release

```bash
gh release create v$VER --title "vX.Y.Z — …" --notes-file notes.md --target main \
  "release/Rexpo Network Inspector-$VER-arm64.dmg" \
  "release/Rexpo Network Inspector-$VER.dmg" \
  "release/Rexpo Network Inspector-$VER-arm64.AppImage" \
  "release/Rexpo Network Inspector-$VER.AppImage" \
  "release/Rexpo Network Inspector-$VER-win.zip"
# Verify each asset resolves (GitHub turns spaces → dots in the URL):
curl -sL -o /dev/null -w "%{http_code}\n" \
  "https://github.com/omeremreelmali/rexpo-debugger/releases/download/v$VER/Rexpo.Network.Inspector-$VER-arm64.dmg"
```
Release notes should state the builds are **unsigned** (mac: right-click → Open / `xattr -dr com.apple.quarantine`; Windows: SmartScreen → Run anyway).

## 4. Publish the npm agent (manual — needs npm auth)

`npm publish` requires being logged in. **Do this yourself** — credentials aren't handled by the agent.

```bash
cd expo-agent
npm whoami || npm login        # refresh the (possibly stale) token in ~/.npmrc — NOT a project .npmrc
npm publish                    # prepublishOnly runs the build automatically
npm view rexpo-debugger version  # confirm
```

## 5. Website updates (repo: `rexpo-debugger-web-site`)

> Deployed at https://rexpo.redvizor.app — all content lives in `dictionaries/en.json` + `dictionaries/tr.json` (keep both in sync).

**Version / downloads**
- [ ] `lib/release.ts` → `LATEST_VERSION = "X.Y.Z"` (download links derive from it). Windows points to the `-win.zip`.

**Feature & version info (en + tr)**
- [ ] `home.badge` → `"vX.Y.Z — <headline>"`
- [ ] `versions.releases[]` → prepend a new changelog entry (version, date, summary, sections).
- [ ] `home.features[]` → add/adjust a feature card if it's a headline feature.
- [ ] `home.marqueeItems[]` → add relevant tech names.
- [ ] `features.sections[]` → add a section or bullets for the new capability.

**Documentation checks (en + tr)**
- [ ] `docs.configuration` → add/adjust agent option docs (e.g. `stateTitle`) **and** the matching `<CodeBlock>` in `app/[locale]/docs/configuration/page.tsx`.
- [ ] `docs.quickstart` / `docs.installation` if the setup changed.
- [ ] `expo-agent/README.md` (main repo) → keep the agent API docs in sync (it ships to npm).

**Screenshots (if UI changed)** — see section 6.

**⚠️ Index-map gotcha:** `app/[locale]/features/page.tsx` maps section **index → screenshot** via `SECTION_SCREENSHOTS`. If you insert/reorder `features.sections`, realign this array or images attach to the wrong section / disappear.

## 6. Screenshots (when the desktop UI changed)

Pipeline: `capture-screenshots.mjs` (main repo, CDP) → PNGs in `assets/screenshots/` → website's
`optimize-screenshots.mjs` → webp in `public/screenshots/`.

```bash
# 1. Run the dev app WITH CDP + WS:
export PATH="$HOME/.nvm/versions/node/v20.19.4/bin:$PATH"
npm run dev:vite &                                   # vite on 5173
node_modules/.bin/electron . --remote-debugging-port=9222 &   # CDP 9222 + WS 5051
# 2. Capture (seeds network/console/collections + State via dummy-payloads.mjs sendStateSnapshots):
node scripts/capture-screenshots.mjs                 # → assets/screenshots/{dark,light}-{scene}.png
# 3. Copy changed scene PNGs into the website, then optimize:
cp "assets/screenshots/dark-state.png" ../rexpo-debugger-web-site/assets/screenshots/   # etc.
cd ../rexpo-debugger-web-site && npm run optimize-screenshots
```
- New scene? Add it to `SCENES` in `optimize-screenshots.mjs`, to `SECTION_SCREENSHOTS` in features page,
  and to `home.tour.scenes` (en + tr). `TourShowcase` resolves `/screenshots/{scene.id}-{theme}.webp` by id.
- State-tab dummy stores live in `scripts/dummy-payloads.mjs → sendStateSnapshots()`.
- To avoid churn, `git checkout` the scene PNGs you didn't intend to change (capture rewrites timestamps).

## Gotchas

- **Unsigned mac DMG shows "damaged" on Apple Silicon** → the bundle is only linker-signed. Fix: `codesign --force --deep --sign - "<app>"` then repackage the DMG (step 2). Real fix = Developer ID cert + notarization.
- **Windows NSIS installer can't be built on Apple Silicon** → wine crashes under qemu (`host_page_mask` assertion). Ship a `--win zip` instead (`signAndEditExecutable=false` skips the wine `rcedit` step). Windows is x64-only.
- **Node 16 build failure** (`crypto.getRandomValues is not a function`) → use Node 18/20 via nvm.
- **Website download links 404** → you bumped `LATEST_VERSION` before the GitHub release/assets existed. Publish the release first.

## TL;DR order

1. Bump versions → commit → push.
2. Build desktop (mac deep-signed + docker linux/win-zip).
3. `gh release create vX.Y.Z` + upload + verify links.
4. (manual) `cd expo-agent && npm publish`.
5. Re-capture screenshots if UI changed.
6. Website: `LATEST_VERSION`, badge, changelog, features, docs, screenshots (en + tr) → commit → push.
