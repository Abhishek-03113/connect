---
name: contributing
description: Coding style, patterns, and contribution workflow for comma connect (React 18 + Redux + Vite + Tailwind, migrating off Material-UI v1). Use for any change in this repo — writing or reviewing components, actions/reducers, API calls, tests, commits, or PRs.
---

# Contributing to comma connect

Web/mobile companion app for openpilot. Upstream is `commaai/connect`; the
README's rules are short and binding: **use best practices, write tests, keep
files small and clean, ship small PRs that can merge quickly.**

## Before you call anything done

```sh
bun install --frozen-lockfile   # bun only — never npm/yarn; never hand-edit bun.lock
bun run lint                    # oxlint src — must be clean (correctness = error)
bun run test                    # vitest run — must be green
```

CI (`.github/workflows/test.yaml`, `build.yaml`) runs exactly these plus a
production build with a 1-minute job timeout, so keep tests fast and free of
real network or long sleeps. Use `bun start` (port 3000) and `/demo` to try UI
changes without a device. `bun run build:production` if you touched build
config, env vars, or imports that could break bundling.

## Testing a change end to end

Pick the layers the change touches; lint + unit tests are always required.

1. **Unit tests** — `bun run test` (or `bun run test:watch` while iterating,
   `bunx vitest run src/path/file.test.js` for one file, `bun run test-coverage`).
2. **Demo mode in the dev server** — `bun start`, open `http://localhost:3000/demo`.
   Uses the fake backend in `src/api/demo.js` (device `deadbeefdeadbeef`, sample
   drives with real thumbnails/events), so no account or device is needed.
   Covers dashboard, drive list, drive view/timeline, filters, modals. In headless
   Chromium the replay video shows "Unable to load video" (no HLS codec) — that's
   the environment, not a bug.
3. **E2E tests in demo mode** — `cd e2e && bun install && bun run test`
   (Playwright, `e2e/*.spec.js`, desktop + mobile projects). Local-only tooling
   with its own `package.json`; starts the dev server itself (or reuses one on
   :3000) and fails on any uncaught page error. Add a spec when a change affects
   a user flow demo mode can reach. `@playwright/test` is pinned to 1.56.1 to
   match the Chromium preinstalled in cloud sessions; elsewhere run
   `bunx playwright install chromium` once. Debug with `bunx playwright test --ui`
   or the trace saved in `e2e/test-results/` on failure.
4. **Production build** — `bun run build:production` (chunk-size warnings are normal).
5. **Visual regression gallery** — screenshots 15 states × desktop/mobile using
   fixtures for a public route and diffs them. Installs puppeteer with `--no-save`
   (package.json untouched). Locally, compare against a local build of the base,
   not `--baseline-url` (different Chrome/fonts flag every screen as changed):
   ```sh
   git worktree add /tmp/base origin/master && ln -s "$PWD/node_modules" /tmp/base/node_modules
   PUPPETEER_EXECUTABLE_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome \
     bun run build:gallery -- --output /tmp/gallery --base /tmp/base --base-sha "$(git -C /tmp/base rev-parse HEAD)"
   git worktree remove --force /tmp/base
   ```
   Open `/tmp/gallery/connect-gallery.html`; an unchanged UI reports `0 changed`.
   If the change adds a new screen or modal, add it to `GALLERY_STATES` in
   `scripts/build-gallery.mjs`.
6. **PR preview** — on a PR to upstream, CI deploys `https://<pr>.connect-d5y.pages.dev`
   plus a gallery diffed against `latest`. Only there (or on a real login) can
   features needing a real device be checked: live stream/teleop, uploads, Athena RPCs,
   prime checkout. In a fork without the Cloudflare secrets the preview job
   fails; the lint/test and build jobs still run.

## Formatting (`.editorconfig` + existing code)

- 2-space indent, LF, UTF-8, final newline, no trailing whitespace.
- Single quotes in JS, double quotes in JSX attributes.
- Semicolons; trailing commas in multi-line literals/args.
- Arrow params parenthesised: `(x) => ...`.
- Import order: external packages, blank line, local modules (relative paths, no aliases).
- No formatter is configured — match the surrounding file; don't reformat lines you aren't changing.

## Lint rules that bite (`.oxlintrc.json`)

`no-shadow`, `no-use-before-define`, `no-plusplus` (except `for` afterthoughts),
`no-await-in-loop`, `default-case` on every `switch`, `no-case-declarations`
(wrap case bodies in `{ }`), `no-empty`, `no-unused-vars` (unused args are OK).
`console.*` is allowed (`console.debug` for tracing, `console.warn/error` for real problems).

## Project layout

| Path | What lives there |
|---|---|
| `src/components/<Feature>/index.jsx` | Feature component; siblings for sub-components, `utils.js` + `utils.test.js` for pure logic |
| `src/components/utils/` | Small shared UI pieces (`InfoTooltip`, `SwitchLoading`) |
| `src/actions/` | Redux thunks (`index.js`, `cached.js`, `files.js`), `types.js` constants, `history.js` middleware |
| `src/reducers/globalState.js` | The single main reducer |
| `src/initialState.js` | Shape of global state |
| `src/api.js` | Low-level HTTP clients (comma API, athena, billing) |
| `src/api/backend.js` | `api` facade — real backend or demo (`src/api/demo.js`) |
| `src/timeline/` | Playback + segment logic (pure, well tested) |
| `src/utils/`, `src/hooks/` | Pure helpers and React hooks |
| `src/icons/index.jsx` | All SVG icons as named exports |
| `src/colors.js`, `src/theme.js`, `src/index.css` | Palette, MUI theme, Tailwind entry + base layer |

Keep files small: put pure logic in `utils.js` next to the component and test it
there. Don't grow the big files (`actions/index.js`, `actions/cached.js`,
`reducers/globalState.js`, `utils/webrtc.js`) unless it's the obvious home —
prefer a new focused module.

## UI: the codebase is migrating MUI → Tailwind/plain HTML

Recent upstream work removes Material-UI piece by piece (`@material-ui/icons`,
`CssBaseline`, `Divider` → `<hr>`). Follow that direction:

- **New UI**: function components + Tailwind `className`s and plain elements.
  See `FullPageLoading.jsx`, `Notification/index.jsx`.
- **Don't add** new `withStyles`, `@material-ui/core` imports, or MUI components
  where a plain element works. Never add `@material-ui/icons` back.
- **Editing an existing MUI/`withStyles` file**: stay consistent within the file;
  migrating it is fine but do it as its own focused PR, not mixed with a feature/fix.
- Global element defaults go in `src/index.css` under `@layer base`. Theme tokens
  (breakpoints `xxs`/`xs`, `safe-*` spacing, `animate-fadein`) are in its `@theme`.
- Icons: add an SVG component to `src/icons/index.jsx`, import as a named export.
- Accessibility: `aria-label` on icon-only controls, `role` where semantics aren't native.

## React

- `react-redux` is **v5**: no `useSelector`/`useDispatch`. Connect with
  `const stateToProps = (state) => ({ ... }); export default connect(stateToProps)(Component);`
  and call `this.props.dispatch(...)` / `props.dispatch(...)`.
- Class components exist widely; new components should be function components with hooks.
- Local UI state stays in component state. Redux is only for global state many
  unrelated components need.
- Use `hooks/window.js` (`useWindowWidth`, `subscribeWindowSize`) instead of new resize listeners.

## Redux

- Add the action type constant to `src/actions/types.js` (`ACTION_*`).
- Async work is a thunk: `export function doThing() { return (dispatch, getState) => { ... }; }`.
- Reducer cases are immutable spreads (`state = { ...state, x }`), wrap bodies in
  `{ }`, keep a `default:`. Add new keys to `initialState.js`.
- Navigation via `push(...)` from `connected-react-router`; URL parsing lives in `src/url.js`.

## API

- Components and actions call **`api` from `src/api/backend.js`**, not `src/api.js`
  directly, so demo mode keeps working. A new endpoint needs: method in `api.js`,
  mapping in `createRealBackend`, and a stub in `api/demo.js`.
- Report unexpected failures with `Sentry.captureException(err, { fingerprint: ... })`
  and surface a user-facing error; don't swallow errors silently.
- Build-time config only via `import.meta.env.VITE_*`; document new vars in README.

## Tests (vitest + jsdom + Testing Library)

- Co-located `*.test.js(x)`; `describe`/`it`/`expect` are globals, import `vi`
  from `vitest` when mocking. Setup: `config/vitest/setupTests.js` (mocks
  `localforage`, `mapbox-gl`).
- Every bug fix gets a regression test; every new pure function gets unit tests.
  Table-driven `testCases` arrays are the house style (see `Navigation/utils.test.js`).
- Mock modules with `vi.mock('../api', () => ({ ... }))`; build fake stores as
  `{ getState: vi.fn(() => state), dispatch: vi.fn() }` (see `actions/history.test.js`).
- No real network, no sleeps over a few hundred ms.

## Commits & PRs

- **Local dev tooling is never committed**: `CLAUDE.md`, `.claude/` and `e2e/` are
  listed in `.git/info/exclude`. Don't stage them, don't add them to `.gitignore`,
  and never add their dependencies to the root `package.json`/`bun.lock`. Before
  every commit, check `git status` shows only the change itself.
- That tooling is versioned on the orphan branch **`devtools`** (no shared history
  with `master`; never merge it, never open a PR from it). Restore in a new clone
  or session: `git fetch origin devtools && git archive origin/devtools | tar -x && bash .claude/devtools.sh restore`.
  After editing any of it: `bash .claude/devtools.sh save "what changed"`.

- Commit/PR titles: short, lowercase, imperative-ish, optional `area:` prefix —
  `fix device name propagation`, `driveview: right align route buttons`,
  `replace MUI Divider with hr`. Upstream appends ` (#NNN)` on squash merge.
- One concern per PR. Separate refactors/migrations from behavior changes.
  Don't bump or add dependencies casually; removing unused ones is welcome.
- Open as **draft** until ready. CI deploys a preview
  (`https://<pr>.connect-d5y.pages.dev`) and a visual gallery diff — check the
  gallery for unintended visual changes on any UI PR.

## Clean-code checklist

- [ ] Lint and tests pass locally; new logic has tests
- [ ] No dead code, commented-out code, stray `console.log`, or unused imports
- [ ] No new MUI usage in new code; Tailwind classes instead of inline `style` where practical
- [ ] Goes through `api` facade; demo mode still works
- [ ] Diff touches only what the change needs
