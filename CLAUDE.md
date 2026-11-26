# Rules for working in this repo

## When a task is finished: clean up, then record the release

Do both of these at the end of every task, in this repo and in the website repo
(`../rexpo-debugger-web-site`).

1. **Delete everything a build or install can recreate.** That means:
   - `node_modules/` (root and `expo-agent/`)
   - build outputs: `dist/`, `expo-agent/dist/`, `next-agent/dist/`, `release/`, and on the website `.next/`, `next-env.d.ts`, `tsconfig.tsbuildinfo`
   - caches: the npm cache (`npm cache clean --force`), `~/Library/Caches/electron` and `~/Library/Caches/electron-builder`
   - any Docker builder image that was pulled for the task (for example `electronuserland/builder:wine`)
   - test and scratch leftovers such as `$TMPDIR/rexpo-e2e-*` and `.DS_Store`

   `git clean -ndX` lists what is ignored. Check that list before deleting:
   `.claude/` and any `.env*` file are local settings, not build output, so they stay.
   Never delete tracked files or uncommitted source changes.

   To restore everything: `npm ci && (cd expo-agent && npm ci)`, then `npm run build`.

2. **Keep [LATEST_RELEASE.md](LATEST_RELEASE.md) current.** It records:
   - the last version that was actually shipped: the desktop GitHub release, the npm agent version and the website version
   - the release's files
   - what the release contains
   - anything finished in the code but not yet released

   Update it after every release, and whenever unreleased work changes.
