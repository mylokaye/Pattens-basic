# GitHub Copilot Instructions — Pattens Email Tools

This repository contains a browser-based email toolkit. Follow these guidelines when contributing code.

## Project Overview

- **Stack**: Vanilla JavaScript (ES5/IIFE), Tailwind CSS (CDN), Jest + jsdom for testing
- **Runtime**: Browser only — no build step, no bundler, no server-side code
- **Purpose**: Three in-browser tools:
  - **Email Validator** — syntax-checks and deduplicates email addresses from pasted text or CSV uploads
  - **Dynamics Email Converter** — rewrites third-party HTML emails into Dynamics 365 Customer Insights - Journeys compatible markup
  - **Generate** — creates campaign names, tracked URLs, and encoded survey links
- **Key Dependencies**: Tailwind CSS (CDN), Lucide icons (CDN), Jest (dev)

## Code Style & Conventions

### JavaScript
- Use IIFE patterns to avoid global scope pollution: `(function () { 'use strict'; ... })();`
- Attach public APIs under `window.Pattens.{module}` (e.g. `Pattens.validator`, `Pattens.converter`, `Pattens.generator`)
- Use `var` for module-level variables inside IIFEs (consistent with existing code)
- Use single quotes for strings
- Always use semicolons
- Use descriptive constant names (e.g. `MAX_EMAILS`, `MAX_FILE_SIZE`)
- Add JSDoc comments for exported functions
- Prefer `console.error()` for error logging, not `console.log()`

### HTML
- Keep inline `<script>` blocks minimal — pure logic goes in `src/` files
- Use Tailwind utility classes for styling (no custom CSS unless needed for animations)
- Event listeners should use `addEventListener`, not `onclick` attributes

### File Organization
```
├── index.html              # Single-page app shell (Tailwind-styled, imports all tools)
├── src/
│   ├── validator/
│   │   └── validator.js    # Email validation logic (Pattens.validator)
│   ├── app.js              # Dynamics email converter (Pattens.converter)
│   └── generate.js         # Campaign/link/survey generator (Pattens.generator)
├── __tests__/              # Jest tests (mirror src/ structure)
├── test-fixtures/          # CSV and HTML fixture files for tests
├── docs/                   # Conversion rules, Dynamics attribute docs
├── skills/                 # Agent skill definitions
└── assets/                 # Static assets (SVG logos, etc.)
```

### Documentation
- Document all exported functions with JSDoc comments
- Explain the purpose of constants (especially limits and timeouts)
- Update README.md when adding new features or changing behavior

## Testing Requirements

### Test Framework
- Use Jest with jsdom environment
- Run tests with: `npm test`
- Watch mode: `npm run test:watch`
- Coverage: `npm run test:coverage`

### Test Structure
- Tests go in `__tests__/`, mirroring the structure of `src/`
- Test files must end with `.test.js`
- Load real source files via `fs.readFileSync` + `(0, eval)(code)` (consistent pattern across all tests)
- Access tested functions through the `Pattens.{module}` namespace
- Never copy-paste source code into test files

### Test Coverage
- Test both success and failure cases
- Test edge cases and boundary conditions
- Test input sanitization
- Use descriptive test names that explain what is being tested

## Email Validation Logic (`src/validator/validator.js`)

### Processing Rules
1. Sanitize input to remove dangerous characters: `<`, `>`, `"`, `'`, `;`, `\`, newlines, tabs
2. Parse CSV/text input into individual email candidates
3. Validate email format: max 254 chars total, max 64 char local part, single `@`, valid TLD
4. Detect duplicates (case-insensitive comparison)
5. Count: `total`, `checked`, `valid`, `invalid`, `duplicate`, `validRate`

### Score Calculation
- `validRate` = `(valid / checked) × 100` rounded to whole percent
- Duplicates are counted but excluded from valid/invalid rates

## Security & Data Handling

- All processing happens client-side in the browser — no data is sent to any server
- Sanitize all user input before processing (remove `<`, `>`, `"`, `'`, `;`, `\`, newlines, tabs)
- Never store or log email addresses
- Process data ephemerally (no PII retention)

## Common Patterns

### Adding a New Source Module
```javascript
(function () {
  'use strict';

  // ── Constants ──────────────────────────────────────────────
  var LIMIT = 100;

  // ── Public functions ────────────────────────────────────────
  function doSomething(input) {
    // implementation
  }

  // ── Attach to namespace ─────────────────────────────────────
  var api = {
    LIMIT: LIMIT,
    doSomething: doSomething
  };

  window.Pattens = window.Pattens || {};
  window.Pattens.newModule = api;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})();
```

### Loading a Module in Tests
```javascript
const fs = require('fs');
const path = require('path');

const code = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'myModule', 'myModule.js'),
  'utf-8'
);
(0, eval)(code);

const api = window.Pattens.myModule;
```

## Don'ts

- ❌ Don't use `console.log()` for error logging (use `console.error()`)
- ❌ Don't copy-paste source code into test files — load the real source
- ❌ Don't commit sensitive credentials or API keys
- ❌ Don't expose internal error details to users
- ❌ Don't use ES modules or `import`/`export` (project uses script tags, no bundler)
- ❌ Don't add server-side dependencies (this is a static browser app)
- ❌ Don't remove existing tests unless they're truly invalid
- ❌ Don't introduce build steps or bundlers without discussion

## References

- [Dynamics 365 Customer Insights - Journeys email documentation](https://learn.microsoft.com/en-us/dynamics365/customer-insights/journeys/)
- [Jest Testing Framework](https://jestjs.io/)
- [Tailwind CSS](https://tailwindcss.com/)
