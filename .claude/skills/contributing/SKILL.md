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
