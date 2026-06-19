# Pattens Architecture Review

## Scope

This review was written from the perspective of inheriting the codebase without prior context. The focus is architecture, data flow, structural risks, duplicated code, performance bottlenecks, maintainability risks, and a safe refactor plan.

The repository is a browser-only static web app. There is no server, no build step, and no framework. The app is currently organised around one HTML shell and three JavaScript tool modules.

## Architecture overview

### Runtime model

Pattens runs entirely in the browser.

```text
index.html
  ├─ loads Tailwind CDN, Google Fonts, Lucide CDN
  ├─ renders all three tool panels in one page
  ├─ contains navigation/controller logic inline
  ├─ loads src/validator/validator.js
  ├─ loads app.js
  └─ loads generate.js
```

The app exposes functionality through globals:

```text
window.Pattens.validator
window.Pattens.converter
window.Pattens.generator
window.emailTools
```

The app has three product areas:

| Tool | Main file | Responsibility |
|---|---|---|
| Generate | `generate.js` | Builds campaign codes, tracking links, survey URLs, stores generated items in `localStorage` |
| Convert | `app.js` | Parses third-party HTML, analyses email structure, adds Dynamics 365 markers, validates converted output |
| Validate | `src/validator/validator.js` + inline controller in `index.html` | Extracts, sanitises, validates, displays, and exports email validation results |

## High-level data flow

### Generate tool

```text
User form input
  → current*Values()
  → buildCampaignCode() / buildLinkUrl() / buildSurveyUrl()
  → preview update
  → generateActiveItem()
  → addItem()
  → localStorage
  → renderItems()
```

The core generation functions are reasonably separable from the DOM. The issue is that the same module also owns DOM reads, DOM writes, storage, rendering, event registration, and app initialisation.

### Converter tool

```text
Original HTML textarea
  → runPipeline()
  → analyseEmailHtml()
    → parseHtml()
    → collectNodes()
    → detectTextBlocks() / detectImageBlocks() / detectButtonBlocks()
    → warning detection
  → convertEmailHtml()
    → parseHtml() again
    → analyseEmailDocument() again
    → wrap elements with Dynamics markers
    → ensure containers/meta
  → validateConvertedHtml()
    → marker checks
    → visible text preservation check
  → renderSummary() / renderWarnings() / refreshPreviews()
```

The pipeline is understandable, but it repeatedly parses and re-analyses the same HTML. The converter file is doing too many things: parsing, heuristics, mutation, validation, UI state, preview updates, rendering, and error handling.

### Validator tool

```text
Textarea / CSV upload
  → V.extractEmailsFromText()
  → V.validateEmails()
  → validatorState
  → renderValidatorSummary() / renderValidatorReport()
  → optional CSV download
```

The validator has the cleanest core logic because `src/validator/validator.js` is mostly pure functions. However, its UI/controller layer still lives inline in `index.html`, which makes the architecture inconsistent.

## Priority problem areas

| Priority | Finding | Why it matters | Fix direction |
|---|---|---|---|
| High | `index.html` contains large inline controller logic | Hard to test, hard to maintain | Move shell and validator UI into JS files |
| High | Inline `onclick` and `addEventListener` are both used | Can cause duplicated execution and breaks repo rules | Remove all inline handlers |
| High | `app.js` mixes converter core, UI, rendering, and state | Converter will become hard to extend safely | Split by responsibility |
| Medium | Converter repeatedly parses/re-analyses HTML | Performance cost on large templates | Use pipeline context object |
| Medium | Escaping/status/tab helpers are duplicated | Security and consistency risk | Add shared utilities |
| Medium | Generator config is hardcoded | Updates require code edits | Move to config module |
| Low | Public globals are inconsistent | Agents may call unstable internals | Standardise namespace layers |

## Detailed problem areas

## 1. `index.html` is acting as app shell, UI template, controller, and validator UI module

`index.html` is doing too much:

- Static page layout
- Tool navigation
- Inline Tailwind config
- Inline CSS animation definitions
- Validator controller logic
- Validator rendering
- Validator file upload handling
- Public `window.emailTools` bridge
- Script loading

This makes the page hard to reason about and creates a structural asymmetry: Generate and Convert have external JS files, while Validator is split between a pure module and a large inline controller.

### Risk

Future changes to navigation, validation UI, or tool lifecycle can accidentally break unrelated parts of the page. Inline code also makes testing harder because it is not cleanly importable/evaluable as a separate module.

### Recommendation

Move the inline validator controller and app navigation into source files:

```text
src/app/shell.js
src/validator/validator-ui.js
```

Keep `index.html` as a mostly declarative document.

## 2. Event wiring is duplicated and currently conflicts with the project rules

The codebase uses both inline `onclick` attributes and `addEventListener()`.

Examples include navigation and validator buttons in `index.html`, while the bottom inline script also attaches listeners to the same controls. This creates two paths for the same user action.

### Risk

- Double execution bugs
- Hard-to-debug state changes
- Inconsistent behaviour if one path is updated and the other is not
- Contradiction with the repo's own coding standard: no `onclick` attributes

### Recommendation

Remove all inline `onclick` attributes and centralise event wiring in JS modules.

Target pattern:

```js
function bindEvents() {
  document.querySelectorAll('[data-tool]').forEach(function (button) {
    button.addEventListener('click', function () {
      setActiveTool(button.dataset.tool);
    });
  });
}
```

## 3. Converter module is a large mixed-responsibility file

`app.js` contains all of the following in one file:

- DOM cache
- Event binding
- Pipeline orchestration
- HTML parsing
- Email-structure analysis
- Dynamics marker conversion
- Validation
- Summary rendering
- Warning rendering
- Preview refresh
- Clipboard behaviour
- Public API export

### Risk

This is the biggest maintainability risk in the project. It is difficult to change conversion logic without touching UI logic, and difficult to test UI behaviour without loading conversion internals.

### Recommendation

Split converter by responsibility:

```text
src/converter/constants.js
src/converter/parser.js
src/converter/analyse.js
src/converter/convert.js
src/converter/validate.js
src/converter/render.js
src/converter/controller.js
```

Because the project intentionally avoids ES modules/build tools, each file can still use the IIFE/global namespace pattern:

```text
window.Pattens.converterCore
window.Pattens.converterUi
window.Pattens.converter
```

## 4. HTML is parsed multiple times per conversion

The converter pipeline parses the same input repeatedly:

- `analyseEmailHtml(original)` parses once
- `convertEmailHtml(original)` parses again
- `convertEmailHtml()` internally re-runs `analyseEmailDocument()`
- `validateConvertedHtml()` may call `conversionMarkerSummary()` and `hasConvertibleRegions()`
- `visibleText()` parses original and converted HTML again
- `refreshPreviews()` writes iframe `srcdoc`

### Risk

This is acceptable for small emails, but it becomes a bottleneck for large email templates. The current 500KB input limit reduces freeze risk, but repeated `DOMParser` work still makes the UI less responsive.

### Recommendation

Use a single pipeline context object:

```js
var context = {
  originalHtml: original,
  originalDoc: parseHtml(original),
  analysis: null,
  convertedDoc: null,
  convertedHtml: '',
  warnings: []
};
```

Then pass the context through analysis, conversion, validation, and rendering. This avoids repeated parsing and makes the pipeline easier to debug.

## 5. UI rendering relies heavily on string templates and `innerHTML`

The app uses string templates for summary rows, warning lists, validator reports, and generated items. Some values are escaped manually, which is good, but this pattern is fragile because every new template must remember to escape every dynamic value.

### Risk

- XSS risk if one dynamic field is missed
- Repeated custom escaping functions across files
- Harder to add richer interactions without rerendering large chunks

### Recommendation

Create a shared DOM utility module:

```text
src/shared/dom.js
```

Suggested functions:

```js
Pattens.shared.escapeHtml(value)
Pattens.shared.setText(idOrElement, value)
Pattens.shared.clearChildren(element)
Pattens.shared.el(tag, attrs, children)
Pattens.shared.setStatus(element, message)
Pattens.shared.setError(element, message)
```

Then progressively replace high-risk `innerHTML` usage with DOM creation for user-controlled data.

## 6. Duplicate utility functions exist across modules

There are similar helper concerns repeated across files:

- HTML escaping
- Error display
- Status display
- Tab state toggling
- Local UI state updates
- CSV escaping
- Button state logic

Examples:

- `escapeHtml()` exists in converter and generator code.
- Validator has `escapeValidatorHtml()` and `escapeCSVField()` inline.
- Converter and validator have separate tab state functions.
- Generator and validator both have status/error helpers.

### Risk

Small behavioural differences will creep in over time. Security-related escaping is especially risky when duplicated.

### Recommendation

Introduce shared browser-only utilities:

```text
src/shared/dom.js
src/shared/format.js
src/shared/storage.js
src/shared/ui-state.js
```

Keep them plain IIFEs attached to `window.Pattens.shared`.

## 7. Global namespace shape is useful but inconsistent

The `window.Pattens` namespace is a good fit for the no-build architecture. However, the exposed APIs are inconsistent:

- `validator` exposes mostly pure functions and constants.
- `generator` exposes builders, mutators, state, options, and storage key.
- `converter` exposes UI actions and test-only internals prefixed with `_`.
- `emailTools` exists separately as a second global for page controls.

### Risk

The public API is not clearly separated from test hooks and UI internals. Future agents may use the wrong entry point.

### Recommendation

Standardise namespace layers:

```text
Pattens.shell
Pattens.validator.core
Pattens.validator.ui
Pattens.converter.core
Pattens.converter.ui
Pattens.generator.core
Pattens.generator.ui
Pattens.shared
```

Then expose only stable methods from each area.

## 8. Tests exist, but architecture makes some areas harder to test cleanly

The project has Jest configured with jsdom and test files for app, generator, and validator. This is a strong base.

Current testing risk is architectural rather than missing tooling:

- Inline `index.html` logic is harder to unit test.
- Converter internals are exposed through `_` methods because there is no separated core module.
- UI and core behaviour are often initialised together.

### Recommendation

After splitting files, test the layers separately:

```text
Core tests:
  - pure generator builders
  - pure validator parsing/validation
  - converter parser/analyse/convert/validate

UI tests:
  - event binding
  - tab state
  - status/error rendering
  - localStorage failure handling
```

## 9. Generator options are hardcoded in logic

Business names, URLs, regions, languages, and years are embedded directly in `generate.js`.

### Risk

Every option update requires code changes. This is manageable now, but as the tool grows it will become a source of accidental regressions.

### Recommendation

Move static config into a dedicated module:

```text
src/generator/config.js
```

Given the current no-network/no-build policy, a JS config module is the simpler first step.

## 10. Preview rendering could be expensive and risky for large HTML

The converter preview writes raw user-provided HTML into sandboxed iframes using `srcdoc`. The sandbox helps, but the preview refresh is tied to text input with a debounce.

### Risk

- Large templates can still cause visible UI lag.
- Repeated `srcdoc` writes can be expensive.
- The sandbox currently allows same-origin, which should be reviewed carefully.

### Recommendation

- Keep the debounce, but only refresh the active preview pane.
- Add a manual preview mode for large inputs.
- Consider removing `allow-same-origin` unless there is a clear requirement.
- Track last preview content and skip refresh if unchanged.

## Start-first execution plan

This is the recommended order of work. Start with the highest-priority structural risk, test it, confirm it works, and only then move to the next step.

Do not refactor multiple areas in one PR. Each step should be small enough to test manually and with Jest before continuing.

## Step 0 — Establish the baseline before changing anything

### Goal

Confirm the current app works before refactoring. This prevents chasing bugs that already existed before the change.

### Do first

1. Run the existing automated tests.
2. Open the app locally.
3. Manually smoke-test all three tools.

### Tests to run

```bash
npm test
npm run test:coverage
python3 -m http.server 3001
```

### Manual checks

1. Generate tool:
   - Switch between Link, Campaign, and Survey.
   - Generate one item of each type.
   - Copy a generated item.
   - Delete a generated item.
   - Clear saved items.

2. Validator tool:
   - Load the sample.
   - Validate it.
   - Confirm summary counts update.
   - Confirm report tab shows valid, invalid, and duplicate rows.
   - Download CSV.
   - Clear results.

3. Converter tool:
   - Paste simple email HTML.
   - Convert it.
   - Confirm converted HTML appears.
   - Confirm summary/warnings update.
   - Toggle HTML/Preview tabs.
   - Copy converted HTML.

### Confirmation gate

Move on only when:

- `npm test` passes.
- `npm run test:coverage` completes.
- Manual smoke test passes for Generate, Validate, and Convert.
- Any known pre-existing failures are documented before refactoring.

## Step 1 — High priority: stabilise event ownership

### Problem addressed

Inline `onclick` attributes and `addEventListener()` are both used. This creates duplicate event paths and conflicts with the repo standards.

### Change scope

Only change event wiring. Do not move validator UI logic yet. Do not change converter or generator behaviour.

### Start here

1. Remove inline `onclick` attributes from navigation buttons.
2. Remove inline `onclick` attributes from validator buttons.
3. Keep the existing bottom inline script event listeners.
4. Keep `window.emailTools` temporarily if anything still references it.
5. Add a regression test that checks tool switching and validator actions still work after removing inline handlers.

### Files likely touched

```text
index.html
__tests__/app.test.js or new __tests__/shell-events.test.js
```

### Tests to run

```bash
npm test
npm run test:coverage
```

### Manual checks

1. Click Generate, Convert, Validate navigation tabs.
2. Confirm only one panel is visible at a time.
3. Click Validator Sample.
4. Click Validate.
5. Click CSV.
6. Click Clear.
7. Confirm no console errors.

### Confirmation gate

Move on only when:

- No inline `onclick` remains in `index.html`.
- Navigation still works.
- Validator buttons still work.
- `npm test` passes.
- Manual smoke test passes.

## Step 2 — High priority: move app shell navigation into `src/app/shell.js`

### Problem addressed

`index.html` owns app shell behaviour. This keeps controller code embedded in the document and makes it harder to test.

### Change scope

Move only tool navigation and page title/description switching. Leave validator UI inline for now.

### Start here

1. Create `src/app/shell.js`.
2. Move `toolCopy`, `toolEls`, and `setActiveTool()` into it.
3. Attach shell API to `window.Pattens.shell`.
4. Load `src/app/shell.js` from `index.html` before tool modules that rely on shell state.
5. Keep `window.emailTools.setActiveTool` as a compatibility shim only if required.

### Target namespace

```js
window.Pattens = window.Pattens || {};
window.Pattens.shell = {
  setActiveTool: setActiveTool
};
```

### Files likely touched

```text
index.html
src/app/shell.js
__tests__/shell.test.js
```

### Tests to run

```bash
npm test
npm run test:coverage
```

### Manual checks

1. Generate is active by default.
2. Convert tab changes title, description, active nav state, and panel.
3. Validate tab changes title, description, active nav state, and panel.
4. Switching back to Generate restores Generate title, description, active nav state, and panel.
5. No console errors.

### Confirmation gate

Move on only when:

- Shell behaviour works from `Pattens.shell.setActiveTool()`.
- `index.html` no longer contains shell controller logic.
- Existing tests pass.
- New shell test passes.
- Manual smoke test passes.

## Step 3 — High priority: extract validator UI into `src/validator/validator-ui.js`

### Problem addressed

Validator logic is split between a pure core file and inline UI/controller code in `index.html`.

### Change scope

Move validator UI/controller code only. Do not change the validation algorithm.

### Start here

1. Create `src/validator/validator-ui.js`.
2. Move validator state, DOM references, event binding, rendering, upload, CSV download, status, and error logic from `index.html`.
3. Keep `src/validator/validator.js` as the pure core.
4. Attach UI API to `window.Pattens.validator.ui`.
5. Preserve compatibility methods on `window.emailTools` only if needed during transition.

### Target namespace

```js
window.Pattens = window.Pattens || {};
window.Pattens.validator = window.Pattens.validator || {};
window.Pattens.validator.ui = {
  init: initValidator,
  loadSample: loadValidatorSample,
  validateCurrentInput: validateCurrentInput,
  clear: clearValidator
};
```

### Files likely touched

```text
index.html
src/validator/validator-ui.js
src/validator/validator.js if namespace compatibility is needed
__tests__/validator-ui.test.js
```

### Tests to run

```bash
npm test
npm run test:coverage
```

### Manual checks

1. Validator tab opens.
2. Sample button loads sample emails.
3. Input count updates while typing.
4. Validate updates summary.
5. Report tab renders rows.
6. CSV download still works.
7. File upload still works for CSV.
8. Clear resets input, summary, report, and disabled CSV state.
9. No console errors.

### Confirmation gate

Move on only when:

- Validator UI code no longer lives inline in `index.html`.
- `src/validator/validator.js` remains focused on pure validation/parsing logic.
- Validator behaviour is unchanged.
- Tests pass.
- Manual validator smoke test passes.

## Step 4 — High priority: split converter core from converter UI, without changing behaviour

### Problem addressed

`app.js` mixes converter logic, UI, rendering, state, validation, and test hooks.

### Change scope

This is a code movement refactor only. Do not optimise yet. Do not change conversion rules yet.

### Start here

Split in the smallest useful order:

1. Move constants and static sets into `src/converter/constants.js`.
2. Move parsing/serialisation helpers into `src/converter/parser.js`.
3. Move analysis functions into `src/converter/analyse.js`.
4. Move conversion functions into `src/converter/convert.js`.
5. Move validation functions into `src/converter/validate.js`.
6. Keep UI/event/render orchestration in `app.js` temporarily or move it last into `src/converter/controller.js`.

### Target namespaces

```text
Pattens.converter.constants
Pattens.converter.parser
Pattens.converter.analyse
Pattens.converter.convert
Pattens.converter.validate
Pattens.converter.ui
```

### Files likely touched

```text
app.js
src/converter/constants.js
src/converter/parser.js
src/converter/analyse.js
src/converter/convert.js
src/converter/validate.js
src/converter/controller.js
__tests__/app.test.js
```

### Tests to run after each small move

```bash
npm test
```

After the full converter split:

```bash
npm test
npm run test:coverage
```

### Manual checks

1. Paste simple email HTML and convert.
2. Paste HTML with a text block and image.
3. Paste malformed/broken HTML and confirm warning/error handling still works.
4. Paste HTML with Outlook/VML code and confirm conservative behaviour still works.
5. Toggle original HTML/Preview.
6. Toggle converted HTML/Preview.
7. Copy converted HTML.
8. No console errors.

### Confirmation gate

Move on only when:

- Conversion output is unchanged for existing test fixtures.
- Existing converter tests pass.
- Manual converter smoke test passes.
- `app.js` is reduced to orchestration/UI or replaced by `src/converter/controller.js`.

## Step 5 — Medium priority: add shared utilities after the high-priority movement is stable

### Problem addressed

Escaping, status, error, and tab helpers are duplicated across modules.

### Change scope

Create shared helpers and adopt them gradually. Do not rewrite all rendering at once.

### Start here

1. Create `src/shared/dom.js`.
2. Add shared `escapeHtml()` first.
3. Replace converter/generator/validator escaping with the shared helper.
4. Add shared status/error helpers.
5. Add shared tab state helper.
6. Replace duplicated helpers one module at a time.

### Files likely touched

```text
src/shared/dom.js
app.js or src/converter/*
generate.js
src/validator/validator-ui.js
__tests__/shared-dom.test.js
```

### Tests to run

```bash
npm test
npm run test:coverage
```

### Manual checks

1. Generated items still escape text correctly.
2. Validator report still escapes email text correctly.
3. Converter warnings still escape messages/paths correctly.
4. Status and error messages still show/hide correctly.
5. Tabs still show correct active/inactive state.

### Confirmation gate

Move on only when:

- Shared escaping is used consistently.
- No user-controlled string is rendered without escaping.
- Existing UI behaviour is unchanged.
- Tests pass.

## Step 6 — Medium priority: optimise converter pipeline parsing

### Problem addressed

The converter repeatedly parses and re-analyses the same HTML.

### Change scope

Optimise internals only after converter modules are split and tests are stable.

### Start here

1. Introduce a pipeline context object.
2. Parse original HTML once into `context.originalDoc`.
3. Store analysis on `context.analysis`.
4. Convert using the existing parsed document or a deliberate clone.
5. Store converted output on `context.convertedHtml`.
6. Validate using context data where possible.
7. Avoid changing visible conversion output.

### Target shape

```js
var context = {
  originalHtml: original,
  originalDoc: parseHtml(original),
  analysis: null,
  convertedDoc: null,
  convertedHtml: '',
  warnings: []
};
```

### Tests to run

```bash
npm test
npm run test:coverage
```

If performance tests are added:

```bash
npm test -- converter-performance
```

### Manual checks

1. Convert a simple template.
2. Convert a large template near the accepted size limit.
3. Confirm UI remains responsive enough.
4. Confirm summaries, warnings, and converted output match previous behaviour.

### Confirmation gate

Move on only when:

- Existing converter fixtures produce the same output or intentional differences are documented.
- Large input behaviour is no worse than before.
- Tests pass.
- Manual converter smoke test passes.

## Step 7 — Medium priority: move generator config out of `generate.js`

### Problem addressed

Business names, URLs, regions, languages, and years are hardcoded inside the generator controller.

### Change scope

Move static configuration only. Do not change generated output.

### Start here

1. Create `src/generator/config.js`.
2. Move `options` into `Pattens.generator.config`.
3. Update `generate.js` to read from config.
4. Keep generated campaign/link/survey output exactly the same.

### Files likely touched

```text
src/generator/config.js
generate.js
__tests__/generator.test.js
```

### Tests to run

```bash
npm test
npm run test:coverage
```

### Manual checks

1. Link base URL dropdown still populates.
2. Survey language and LOB dropdowns still populate.
3. Campaign business/year/region/language dropdowns still populate.
4. Generated Link output is unchanged.
5. Generated Survey output is unchanged.
6. Generated Campaign output is unchanged.

### Confirmation gate

Move on only when:

- Config is external to generator controller logic.
- Generated outputs are unchanged.
- Tests pass.
- Manual generator smoke test passes.

## Step 8 — Low priority: standardise public namespaces

### Problem addressed

The global namespace currently mixes stable APIs, UI methods, state, options, and test-only internals.

### Change scope

Rename and organise public surfaces only after module boundaries are stable.

### Start here

1. Define the intended public namespace map.
2. Keep old names as temporary aliases.
3. Update tests to use new names.
4. Remove old aliases only after there are no references.

### Target architecture

```text
Pattens.shell
Pattens.shared
Pattens.validator.core
Pattens.validator.ui
Pattens.converter.core
Pattens.converter.ui
Pattens.generator.core
Pattens.generator.ui
Pattens.generator.config
```

### Tests to run

```bash
npm test
npm run test:coverage
```

### Manual checks

Run the full smoke test across Generate, Validate, and Convert.

### Confirmation gate

Move on only when:

- New namespaces are documented.
- Old aliases are either removed safely or marked deprecated.
- Tests pass.
- Manual full smoke test passes.

## Full smoke test checklist

Run this after every high-priority step and before merging each PR.

### Generate

1. Open app.
2. Confirm Generate is active by default.
3. Switch to Link.
4. Fill/confirm fields.
5. Generate Link item.
6. Copy preview.
7. Copy saved item.
8. Delete saved item.
9. Switch to Campaign.
10. Generate Campaign item.
11. Switch to Survey.
12. Generate Survey item.
13. Clear saved items.

### Validate

1. Switch to Validate.
2. Click Sample.
3. Confirm count updates.
4. Click Validate.
5. Confirm summary rows update.
6. Confirm report rows render.
7. Confirm duplicate is detected.
8. Download CSV.
9. Clear results.
10. Upload a small CSV.
11. Confirm it validates.

### Convert

1. Switch to Convert.
2. Paste simple HTML.
3. Click Convert.
4. Confirm output appears.
5. Confirm summary shows block counts/status.
6. Confirm warnings tab works.
7. Toggle Original HTML/Preview.
8. Toggle Converted HTML/Preview.
9. Copy converted HTML.
10. Try broken HTML and confirm safe warning/error behaviour.

## Recommended PR order

| PR | Priority | Work | Merge condition |
|---|---:|---|---|
| PR 1 | High | Remove inline `onclick`; keep existing event listeners | Tests pass; manual nav/validator smoke test passes |
| PR 2 | High | Move app shell navigation into `src/app/shell.js` | Tests pass; tool switching works manually |
| PR 3 | High | Move validator UI into `src/validator/validator-ui.js` | Tests pass; validator smoke test passes |
| PR 4 | High | Split converter core/UI without behaviour changes | Tests pass; converter output unchanged |
| PR 5 | Medium | Add shared utilities and replace duplicated helpers gradually | Tests pass; escaping/status/tab behaviour unchanged |
| PR 6 | Medium | Optimise converter pipeline parsing with context object | Tests pass; converter fixtures unchanged; large input acceptable |
| PR 7 | Medium | Move generator config into config module | Tests pass; generated outputs unchanged |
| PR 8 | Low | Standardise public namespaces | Tests pass; old aliases handled safely |

## Improved architecture target

```text
index.html
  ├─ static layout only
  ├─ Tailwind config / visual background
  └─ script tags in dependency order

src/shared/
  ├─ dom.js
  ├─ format.js
  ├─ storage.js
  └─ ui-state.js

src/app/
  └─ shell.js

src/validator/
  ├─ validator.js
  └─ validator-ui.js

src/converter/
  ├─ constants.js
  ├─ parser.js
  ├─ analyse.js
  ├─ convert.js
  ├─ validate.js
  ├─ render.js
  └─ controller.js

src/generator/
  ├─ config.js
  ├─ core.js
  └─ ui.js

__tests__/
  ├─ validator.test.js
  ├─ validator-ui.test.js
  ├─ converter-analyse.test.js
  ├─ converter-convert.test.js
  ├─ converter-validate.test.js
  ├─ generator-core.test.js
  └─ shell.test.js
```

## Final assessment

The app is a solid static-toolkit prototype with a sensible no-server architecture and useful separation of some core functions. The main issue is not product logic; it is structural drift. As features were added, responsibility moved into `index.html`, `app.js`, and globals rather than into consistent modules.

The best next step is not a rewrite. Keep the browser-only, no-build architecture, but modularise by responsibility. Start with event ownership, test it, confirm it works, and only then move on to shell extraction, validator UI extraction, and converter decomposition.