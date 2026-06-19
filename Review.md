# Pattens Architecture Review

## Scope

This review was written from the perspective of inheriting the codebase without prior context. The focus is architecture, data flow, structural risks, duplicated code, performance bottlenecks, maintainability risks, and a pragmatic refactor path.

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

### High-level data flow

#### Generate tool

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

#### Converter tool

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

#### Validator tool

```text
Textarea / CSV upload
  → V.extractEmailsFromText()
  → V.validateEmails()
  → validatorState
  → renderValidatorSummary() / renderValidatorReport()
  → optional CSV download
```

The validator has the cleanest core logic because `src/validator/validator.js` is mostly pure functions. However, its UI/controller layer still lives inline in `index.html`, which makes the architecture inconsistent.

## Problem areas

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
Pattens.dom.escapeHtml(value)
Pattens.dom.setText(idOrElement, value)
Pattens.dom.clearChildren(element)
Pattens.dom.el(tag, attrs, children)
Pattens.dom.setStatus(element, message)
Pattens.dom.setError(element, message)
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

Or, if the project wants non-developers to update values later:

```text
data/generator-options.json
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

## Refactor strategy

The safest strategy is incremental. Do not introduce a framework or bundler. Preserve the static app model.

### Phase 1 — Stabilise event ownership

1. Remove all inline `onclick` attributes from `index.html`.
2. Move app navigation into `src/app/shell.js`.
3. Keep `window.emailTools` temporarily as a compatibility shim if needed.
4. Add a simple test that ensures key buttons are wired once.

### Phase 2 — Extract validator UI

1. Move inline validator state/render/controller logic from `index.html` into `src/validator/validator-ui.js`.
2. Keep `src/validator/validator.js` as the pure core.
3. Expose:

```js
Pattens.validator.core
Pattens.validator.ui
```

4. Update tests to cover validator UI separately from validation rules.

### Phase 3 — Introduce shared utilities

Create:

```text
src/shared/dom.js
src/shared/format.js
src/shared/ui.js
```

Move repeated helpers:

- `escapeHtml`
- `setStatus`
- `showError`
- `clearError`
- `setTabState`
- safe list rendering helpers

This phase reduces duplication before deeper converter changes.

### Phase 4 — Split converter core from converter UI

Move pure/near-pure converter functions first:

```text
src/converter/parser.js
src/converter/analyse.js
src/converter/convert.js
src/converter/validate.js
```

Then leave DOM-specific work in:

```text
src/converter/controller.js
src/converter/render.js
```

Do not change conversion behaviour in this phase. Only move code and keep tests passing.

### Phase 5 — Optimise the converter pipeline

Introduce a pipeline context object so the same parsed document and analysis can be reused.

Target flow:

```text
createPipelineContext(originalHtml)
  → analyseContext(context)
  → convertContext(context)
  → validateContext(context)
  → renderPipelineResult(context)
```

This should reduce repeated parsing and make the pipeline easier to extend.

### Phase 6 — Move generator config out of the controller

Move hardcoded business/link/language/year options into a config module.

Target:

```text
Pattens.generator.config
Pattens.generator.core
Pattens.generator.ui
```

## Suggested improved architecture

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

## Priority findings

| Priority | Finding | Why it matters | Suggested fix |
|---|---|---|---|
| High | `index.html` contains large inline controller logic | Hard to test, hard to maintain | Move shell and validator UI into JS files |
| High | Inline `onclick` and `addEventListener` are both used | Can cause duplicated execution and breaks repo rules | Remove all inline handlers |
| High | `app.js` mixes converter core, UI, rendering, and state | Converter will become hard to extend safely | Split by responsibility |
| Medium | Converter repeatedly parses/re-analyses HTML | Performance cost on large templates | Use pipeline context object |
| Medium | Escaping/status/tab helpers are duplicated | Security and consistency risk | Add shared utilities |
| Medium | Generator config is hardcoded | Updates require code edits | Move to config module |
| Low | Public globals are inconsistent | Agents may call unstable internals | Standardise namespace layers |

## Recommended first PR

The first PR should be small and low-risk:

1. Create `src/app/shell.js`.
2. Move `toolCopy`, `toolEls`, `setActiveTool()`, and nav event binding out of `index.html`.
3. Remove `onclick="emailTools.setActiveTool(...)"` from nav buttons.
4. Keep `window.emailTools.setActiveTool` temporarily if existing tests or manual usage depend on it.
5. Add/adjust a jsdom test for tool switching.

This gives the project a clearer architecture without changing product behaviour.

## Recommended second PR

Move the validator UI controller out of `index.html` into `src/validator/validator-ui.js`.

Keep this split:

```text
validator.js      = pure validation/parsing logic
validator-ui.js   = DOM, upload, render, CSV download, events
```

This will make the validator match the shape already used by Generate and Convert.

## Recommended third PR

Extract shared helpers before deeper converter refactors:

```text
Pattens.shared.escapeHtml()
Pattens.shared.setStatus()
Pattens.shared.showError()
Pattens.shared.clearError()
Pattens.shared.setTabState()
```

Then update converter, generator, and validator UI to use the same helpers.

## Final assessment

The app is a solid static-toolkit prototype with a sensible no-server architecture and useful separation of some core functions. The main issue is not product logic; it is structural drift. As features were added, responsibility moved into `index.html`, `app.js`, and globals rather than into consistent modules.

The best next step is not a rewrite. Keep the browser-only, no-build architecture, but modularise by responsibility. That will reduce duplicated code, improve testability, and make future changes safer for AI coding agents and human maintainers.