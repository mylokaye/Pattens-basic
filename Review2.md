# Pattens Email Tools — Architecture Review

A senior-engineer review of the Pattens codebase: architecture, data flow,
problem areas, duplicated code, performance bottlenecks, maintainability risks,
and a refactor strategy.

Scope reviewed: `index.html`, `app.js`, `generate.js`, `src/validator/validator.js`,
`__tests__/*`, `docs/*`, `AGENTS.md`, `.github/copilot-instructions.md`.

Tests verified locally: **78 passed, 78 total** after a clean `npm install`.

---

## 1. Architecture Overview

### 1.1 What this is

Pattens is a **single-page, browser-only toolkit** — no server, no build step,
no bundler, no framework. Three tools share one HTML page, selected by a nav
bar that toggles which `<section>` is visible:

| Tool | Namespace | Logic source | Glue/UI source |
|------|-----------|--------------|----------------|
| Email Validator | `Pattens.validator` | `src/validator/validator.js` | inline `<script>` in `index.html` (the `emailTools` / `validatorEls` block) |
| Dynamics Converter | `Pattens.converter` | `app.js` (logic **and** UI) | `app.js` |
| Generate | `Pattens.generator` | `generate.js` (logic **and** UI) | `generate.js` |

Each module is an IIFE that hangs its API off `window.Pattens.{module}`. The
validator is the only tool that cleanly separates logic from DOM wiring; the
converter and generator mix parsing logic, DOM queries, rendering, and event
binding in one file each.

### 1.2 Runtime data flow

```
index.html
  ├── <head>   Tailwind config (custom theme) + @keyframes + CDN scripts
  ├── <body>   5 animated orbs + gradient background (purely decorative)
  └── <main>
        ├── validatorTool section   ← wired by inline <script> (~350 lines)
        ├── converterTool section   ← wired by app.js
        └── generateTool section    ← wired by generate.js

  Scripts, in load order:
    1. tailwind CDN
    2. lucide CDN
    3. src/validator/validator.js   (Pattens.validator — pure logic)
    4. inline <script>              (validator UI glue + emailTools global)
    5. app.js                       (Pattens.converter — logic + UI)
    6. generate.js                  (Pattens.generator — logic + UI)
```

Load order matters and is fragile: `app.js` and `generate.js` both call
`document.getElementById(...)` at IIFE top level (lines 30–50 of each), so if a
referenced element ID changes in HTML, the whole module throws on load and the
entire tool disappears silently (only caught by the `try { init() } catch` at the
bottom of `app.js`).

### 1.3 Per-tool internal flow

**Validator** (the best-structured tool):
```
textarea input → extractEmailsFromText → parseCSV → sanitizeEmail
              → validateEmails (dedupe via Set, syntax check)
              → renderValidatorSummary / renderValidatorReport
```
Logic (`validator.js`) is fully decoupled from DOM — testable in isolation,
exports a clean API. The DOM glue lives in `index.html`'s inline script.

**Converter** (`app.js`, 855 lines, 1 file):
```
runPipeline()
  ├── analyseEmailHtml(html)         → parseHtml + analyseEmailDocument
  ├── convertEmailHtml(html)         → parseHtml AGAIN + analyseEmailDocument AGAIN
  │                                    + mutate doc + serialize + conversionMarkerSummary (parses AGAIN)
  └── validateConvertedHtml(...)     → visibleText(original) + visibleText(converted)
                                       (each visibleText call parses AGAIN)
                                       + parseHtml(converted) AGAIN
```
A single "Convert" click parses the same HTML document **5–7 times** via
`DOMParser`. This is the dominant performance characteristic.

**Generate** (`generate.js`, 555 lines):
```
form input/change → updateXxxPreview → buildXxxUrl/Code → render
                  → addItem → localStorage.setItem → renderItems (full innerHTML rebuild)
```
Pure-function builders (`buildCampaignCode`, `buildLinkUrl`, `buildSurveyUrl`)
are clean and well-tested. UI state (tabs, saved list) is mixed into the same file.

### 1.4 State management

Three ad-hoc state objects, one per tool, no shared pattern:

- `validatorState` (inline in `index.html`) — `{ results, summary }`
- `state` (`app.js`) — `{ analysis, conversion, validation, warnings }`
- `state` (`generate.js`) — `{ items, activeType }` + direct `localStorage`

There is no persistence layer abstraction; only the generator persists (to
`localStorage` key `pattens.generate.items.v1`), and it does so with inline
`JSON.parse`/`JSON.stringify` calls and no schema versioning beyond the key suffix.

---

## 2. Problem Areas

### 2.1 The test suite is silently broken on fresh checkouts

**Severity: high (tooling/reliability)**

`npm test` on the repository as-checked-out fails with:

```
TypeError: _resolver.default.findNodeModule is not a function
As of Jest 28 "jest-environment-jsdom" is no longer shipped by default...
```

A clean `rm -rf node_modules && npm install` makes all **78 tests pass** — so the
*code* is fine, but the committed `package-lock.json` resolves a `jest` /
`jest-environment-jsdom` / `jest-resolve` combination that is internally
inconsistent. The first thing any new contributor (or CI) experiences is a red
test run that has nothing to do with their change.

This directly contradicts `AGENTS.md` §6.3 ("Run `npm test` before and after —
all 75+ tests must pass") and §4 of the copilot instructions. The bar exists on
paper but not in practice.

**Action:** regenerate `package-lock.json` from a clean install and commit it;
add CI so the lockfile can never silently drift again.

### 2.2 Repeated full-document parsing in the converter

**Severity: high (performance), medium (correctness risk)**

`parseHtml()` (a `new DOMParser().parseFromString` + `parsererror` check) is
called on overlapping input repeatedly within one pipeline run. The concrete
call sites in `app.js`:

| Line | Caller | Parses |
|------|--------|--------|
| 143 | `analyseEmailHtml` | `original` |
| 169 | `convertEmailHtml` | `original` again |
| 170 | `convertEmailHtml` → `analyseEmailDocument` | re-derives analysis already computed at 143 |
| 231 | `finalizeConversionResult` → `conversionMarkerSummary` | `serializedOutput` |
| 251 | `conversionMarkerSummary` (again, via `validate`) | `convertedHtml` |
| 289 | `validateConvertedHtml` | `convertedHtml` again |
| 597 | `visibleText` ×2 | `original` and `converted` |

For a 200 KB email (within the 500 KB limit) the same bytes are parsed roughly
**5–7 times** synchronously on the main thread. The pipeline already gates input
size to "prevent browser freeze," but the real cost is the redundant parsing,
not the size.

Worse, `runPipeline` calls `analyseEmailHtml(original)` into `state.analysis`
(L105) **and** `convertEmailHtml` re-runs the same analysis internally (L170) —
the work is done twice and the second copy is the one actually used for
conversion. `state.analysis` from L105 is then mostly ignored.

### 2.3 Logic and UI are fused in `app.js` and `generate.js`

**Severity: high (maintainability)**

`AGENTS.md` §3.3 mandates `src/{tool}/` for tool logic, and the validator
follows this (`src/validator/validator.js` = pure logic, DOM glue in HTML).
The other two tools violate their own convention:

- `app.js` lives at the **repo root**, not `src/converter/`. It contains the
  conversion engine (`parseHtml`, `analyseEmailDocument`, `convertEmailHtml`,
  `validateConvertedHtml`, ~30 functions) **interleaved** with DOM wiring
  (`runPipeline`, `renderSummary`, `setActiveOriginalView`, `els`, event
  bindings at L52–72).
- `generate.js` likewise lives at the root and mixes pure builders
  (`buildCampaignCode`, `buildLinkUrl`, `buildSurveyUrl`) with rendering,
  tab toggling, `localStorage`, and clipboard code.

Consequences:
- The pure logic can only be tested by `eval`-ing the whole file (which fails
  if the required DOM elements don't exist — see `app.test.js` L13–32, which
  has to manually fabricate 19 element IDs before loading `app.js`).
- The test harness reaches into a `_`-prefixed "exposed for testing" surface
  (`_parseHtml`, `_convertEmailHtml`, …, `app.js` L837–845). Private-by-
  convention internals are part of the public surface purely to make tests
  possible. This is a smell that the module boundary is wrong.
- Adding a fourth tool, or reusing the converter's HTML analysis elsewhere, is
  not possible without dragging in the DOM.

### 2.4 `onclick=""` attributes directly violate the project's own rules

**Severity: medium (consistency/standards)**

`AGENTS.md` §2.5 and §3.2, and copilot-instructions.md, all say:

> Never use `onclick` attributes — use `addEventListener` in JS.

`index.html` contains **10 `onclick=` attributes** (validator buttons, nav
buttons) that call a hand-exposed `window.emailTools.*` global. The global
exists *only* because of these inline handlers. The converter and generator,
by contrast, do it correctly via `addEventListener`. The validator is the
holdout and is also the tool whose logic is otherwise the cleanest — an
inconsistency that's hard to explain to a new contributor.

### 2.5 Duplicated code

**`escapeHtml` is implemented three times** (verified by search):

| File | Function |
|------|----------|
| `app.js:820` | `escapeHtml` (callback-table version) |
| `generate.js:476` | `escapeHtml` (callback-table version, identical) |
| `index.html:766` | `escapeValidatorHtml` (5-chained-replace version, functionally equivalent) |

All three escape `& < > " '` identically. One shared helper in a `src/util/`
module would replace all three.

**DOM-tab toggling is duplicated four times**: `setTabState` (`app.js:668`),
`setValidatorTabState` (`index.html:788`), the generator's inline
`tab.classList.toggle(...)` block (`generate.js:367–376`), and the nav-bar
`setActiveTool` block (`index.html:560–572`) all do the same "apply active vs
inactive Tailwind classes to a tab" dance with subtly different class lists.
This is exactly the kind of drift that produces UI bugs (one tab gets
`hover:text-white`, another gets `hover:text-accent`).

**CSV serialization is duplicated with divergent semantics**:
`parseCSV` exists in `validator.js` (full RFC-ish parser, handles quoted
fields/escapes), while `downloadValidatorCSV` in `index.html:802` hand-rolls
CSV *writing* with its own `escapeCSVField`. The two halves of "CSV" are in
different files with no shared module.

**The "currentXxxValues" / "isXxxComplete" / "updateXxxPreview" trios** in
`generate.js` (L178–305) are near-identical across Link/Campaign/Survey. Each
generator type repeats the same collect→validate→render shape with a 3-way
`if (activeType === ...)` dispatch in five places
(`updateActivePreview`, `generateActiveItem`, `isActiveFormComplete`,
`setActiveType`, `validateActiveUrl`).

### 2.6 Quote-style and `var`/`const` inconsistency

**Severity: low (style), but it breaks the "single source of truth" claim**

`AGENTS.md` §3.1 mandates `var` for module-level variables and single quotes.
Reality:

| File | Style actually used |
|------|---------------------|
| `src/validator/validator.js` | `var`, single quotes ✅ (the only compliant file) |
| `app.js` | `const`/`let`, **double** quotes ❌ |
| `generate.js` | `const`/`let`, **double** quotes ❌ |
| `index.html` inline | `const`/`let`, double quotes ❌ |

The standard was clearly written for the validator and then never applied to
the two larger files. Either the standard or the code is wrong; right now both
are "authoritative" and disagree.

### 2.7 Security/sanization gaps relative to the stated policy

`AGENTS.md` §5 and copilot-instructions §"Security" require sanitizing input by
stripping `< > " ' ; \` newlines and tabs, and never logging emails.

- `sanitizeEmail` strips `< > " ' \` and whitespace but **not `;`** — the
  semicolon is in the documented strip-list but absent from the regex
  (`validator.js:19`). (It's removed later by the `[\s;]+` split, so it's not
  exploitable today, but the sanitizer is not honoring its own contract.)
- The **converter** has no input sanitization at all. It accepts raw HTML and
  re-emits it into `convertedHtml` and into `srcdoc` iframes
  (`app.js:782–783`). That's inherent to what a converter does, but it means
  the §5 rule "sanitize all user input" is only enforced for one of three tools.
  The iframes use `sandbox="allow-same-origin"` (no `allow-scripts`), which is
  the correct mitigation — worth calling out as the thing actually keeping this
  safe, so it doesn't get weakened by accident.
- No email addresses are logged (good), but the privacy claim is
  **untested**: there is no test asserting that emails never reach `console`
  or `localStorage`. The generator stores URLs in `localStorage` by design;
  a stray future change could easily store validator results the same way.

### 2.8 Other maintainability risks

- **`innerHTML` template strings everywhere** (`renderSummary`,
  `renderWarnings`, `renderItems`, `renderValidatorReport`, `statusPill`).
  All user-derived values are passed through `escapeHtml`, which is correct,
  but the pattern is "remember to escape every interpolation" — a footgun.
  A tiny tagged-template helper that auto-escapes would remove the
  responsibility from each call site.
- **Magic Tailwind strings repeated** for button variants (primary/secondary/
  disabled) appear inline a dozen times in `index.html`. AGENTS.md §2.5
  documents three button tiers but the classes are copy-pasted, not
  abstracted, so drift is likely.
- **No schema versioning on `localStorage`** beyond the `.v1` key suffix.
  When `v2` is needed there is no migration path, only a new key.
- **`test-fixtures/` contains only `test-emails.csv`** but the converter and
  generator tests synthesize all their HTML/DOM in-test. The fixtures
  directory is underused and the converter — the riskiest tool — has no HTML
  fixture corpus.
- **`docs/review-notes.md` documents 18 known gaps** in the Dynamics attribute
  reference that have not been folded back into `conversion-rules.md`. The
  converter's behavior and the canonical rules are drifting apart.

---

## 3. Refactor Strategy

The guiding principle: **the validator is the template.** It already does what
the standards ask for (pure logic in `src/`, DOM glue separate, `var`/single-
quotes, clean testable API). Bring the other two tools up to that bar without
changing any user-visible behavior or introducing a build step (a hard
constraint in AGENTS.md §7).

Order matters: do the cheap, safe, behavior-preserving wins first; defer
anything that touches conversion logic until the safety net (tests + fixtures)
is stronger.

### Phase 0 — Fix the foundation (no code logic changes)

1. **Regenerate `package-lock.json`** from a clean `npm install` so `npm test`
   passes on a fresh clone. Add a GitHub Actions workflow that runs `npm test`
   on push/PR. This unblocks everything else and restores the §6.3 contract.
2. **Normalize quote style + `var`** in `app.js`, `generate.js`, and the inline
   `<script>` to match `validator.js` and the documented standard. Pure
   mechanical change; the 78 tests are the safety net.

### Phase 1 — Extract the shared utilities

Create `src/util/escape.js`, `src/util/dom.js` (tab-toggle + `innerHTML`
auto-escaping tagged template), and `src/util/csv.js` (parse **and** serialize).
Replace the three `escapeHtml`s, the four tab-togglers, and the inline CSV
writer. Each util gets its own test file. This is the single highest-leverage
change for reducing future drift.

### Phase 2 — Split logic from UI in the two big files

- Move `app.js` to `src/converter/converter.js` containing **only** the pure
  pipeline (`parseHtml`, `analyseEmailDocument`, `convertEmailHtml`,
  `validateConvertedHtml`, `conversionMarkerSummary`, helpers). The `_`-prefixed
  test exports disappear because the functions become first-class API members.
  DOM wiring (`runPipeline`, `renderSummary`, event listeners, the `els` map)
  moves to `src/converter/ui.js` (or stays inline in `index.html` like the
  validator does).
- Apply the same split to `generate.js` → `src/generator/generator.js` (pure
  builders + `localStorage` adapter) and `src/generator/ui.js` (tabs, forms,
  rendering).
- Update `index.html` `<script>` tags and the test `eval` paths. All 78 tests
  should still pass unchanged in behavior.

### Phase 3 — Collapse the generator triplication

Replace the Link/Campaign/Survey `if (activeType === …)` ladders with a
per-type **descriptor object**:

```js
var GENERATORS = {
  Link:     { values: currentLinkValues,     build: buildLinkUrl,     complete: isLinkComplete },
  Campaign: { values: currentCampaignValues, build: buildCampaignCode, complete: isCampaignComplete },
  Survey:   { values: currentSurveyValues,   build: buildSurveyUrl,    complete: isSurveyComplete }
};
```

`updateActivePreview`, `generateActiveItem`, `isActiveFormComplete`,
`validateActiveUrl` collapse to one-line lookups. Behavior unchanged; the
existing generator tests pin the contract.

### Phase 4 — Performance: parse once

Restructure the converter pipeline so the document is parsed **exactly once**
per input and the resulting `doc` is threaded through analysis → mutation →
serialization → validation:

```
runPipeline(html)
  doc = parseHtml(html)              // once
  analysis = analyseEmailDocument(html, doc)   // reuse doc
  mutated  = convertDoc(doc, analysis)         // mutate in place, serialize once
  counts   = countMarkers(mutated)             // query the doc we already have
  verdict  = validate(original, mutated, doc)  // no re-parse
```

`conversionMarkerSummary` and `validateConvertedHtml` should accept a `doc`
argument instead of re-parsing a string. This cuts parse count from ~6 to 1
per click and removes the duplicated analysis at L105/L170. Because the
existing tests assert on *outputs* (converted HTML, marker counts, error
types), they will catch any behavioral regression.

### Phase 5 — Strengthen the safety net before touching risky logic

- Add an **HTML fixture corpus** under `test-fixtures/converter/` (simple
  email, nested-table email, Outlook/VML email, Stripo export, malformed
  HTML) and golden-output tests. The converter is the highest-risk tool and
  currently has no fixture-based tests.
- Add a **privacy test**: spy on `console.*` and `localStorage.setItem` and
  assert no email address string ever appears in their arguments during a
  validate run. This makes the §5 non-negotiable enforceable instead of
  aspirational.
- Fix `sanitizeEmail` to honor its documented contract (strip `;`), with a test.
- Fold `docs/review-notes.md`'s 18 gaps into `conversion-rules.md` (or mark
  them explicitly deferred) so the rules and the code agree on a single truth.

### Phase 6 — Replace `onclick` with `addEventListener`

Move the validator's 10 inline `onclick` handlers into the existing inline
`<script>` (where the `addEventListener` calls already live) and delete the
`window.emailTools` shim. Aligns the validator with §2.5/§3.2 and the other
two tools. Trivial and safe.

---

## 4. Improved Architecture (target state)

```
index.html
  └── <script> tags only: Tailwind config, keyframes, and <script src=…> loads
      (NO tool logic, NO onclick, minimal inline glue)

src/
  ├── util/
  │   ├── escape.js        Pattens.util.escapeHtml  (+ auto-escaping template tag)
  │   ├── dom.js           Pattens.util.toggleTab, Pattens.util.renderList
  │   └── csv.js           Pattens.util.parseCSV, Pattens.util.serializeCSV
  ├── validator/
  │   ├── validator.js     Pattens.validator        (pure logic — already good)
  │   └── ui.js            Pattens.validator.ui     (textarea, summary, report, CSV dl)
  ├── converter/
  │   ├── converter.js     Pattens.converter        (parse/analyse/convert/validate — pure)
  │   └── ui.js            Pattens.converter.ui     (pipeline button, previews, warnings)
  └── generator/
      ├── generator.js     Pattens.generator        (builders + storage adapter — pure)
      ├── ui.js            Pattens.generator.ui     (forms, tabs, saved list)
      └── store.js         Pattens.generator.store  (versioned localStorage, migration path)

__tests__/                 mirrors src/ — each util + module has its own suite
test-fixtures/
  ├── test-emails.csv
  └── converter/           golden HTML inputs + expected marker counts
```

### Properties of the target

- **One responsibility per file.** Pure-logic files have zero DOM imports and
  are testable by `eval` with no element fabrication. UI files contain only
  wiring. The `_`-prefixed "exposed for testing" hack is gone.
- **No duplication.** One `escapeHtml`, one `toggleTab`, one CSV module.
- **One parse per pipeline run.** Converter threads a single `doc` through.
- **Standards hold.** `var`, single quotes, `addEventListener` everywhere,
  files under `src/{tool}/` — the rules in AGENTS.md become true instead of
  aspirational.
- **Privacy is enforced by tests**, not by convention.
- **No build step, no framework, no server, single page** — all hard
  constraints in AGENTS.md §7 are preserved.

### What deliberately does NOT change

- The dark cinematic background, orbs, color tokens, typography, panel/card
  pattern, and button tiers (AGENTS.md §2) — untouched.
- The single-page architecture and `<script>`-tag loading model — untouched.
- The three tools' user-facing behavior — every refactor phase is pinned by
  the existing 78 tests plus the new fixture/privacy tests.

---

## 5. Priority summary

| # | Item | Severity | Effort | Risk |
|---|------|----------|--------|------|
| 1 | Fix `package-lock.json` + add CI so `npm test` is green on clone | High | XS | None |
| 2 | Parse the converter document once per run (Phase 4) | High | M | Low (output-tested) |
| 3 | Split logic/UI in `app.js` + `generate.js` (Phase 2) | High | M | Low |
| 4 | Extract shared utils — escape/tab/CSV (Phase 1) | Med-High | S | Low |
| 5 | Converter HTML fixture corpus + privacy test (Phase 5) | Med | M | None |
| 6 | Replace 10 `onclick` handlers (Phase 6) | Med | XS | None |
| 7 | Collapse generator Link/Campaign/Survey triplication (Phase 3) | Med | S | Low |
| 8 | Align quote/`var` style to the documented standard (Phase 0.2) | Low | XS | None |
| 9 | Reconcile `sanitizeEmail` with §5 contract | Low | XS | None |
| 10 | Merge `docs/review-notes.md` gaps into `conversion-rules.md` | Low | S | None |

The single most important message: **the codebase is small and sound, but its
own standards are only enforced in one of three tools, and the test gate that
is supposed to protect the rest is currently red on a fresh clone.** Fix the
gate first, then lift the converter and generator up to the bar the validator
already sets.
