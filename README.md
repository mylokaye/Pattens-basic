# PATTENS Email Tools

PATTENS Email Tools is a browser-based toolkit for working with email lists, email HTML, and campaign assets.

Three tools, one page:

- **Email Validator** — syntax‑check and deduplicate email addresses
- **Dynamics Email Converter** — prepare third‑party HTML for Dynamics 365 Customer Insights – Journeys
- **Generate** — create campaign names, tracked URLs, and encoded survey links

Everything runs locally in your browser — no server, no account, no data leaving your machine.

---

## Email Validator

Check email addresses before adding them to a campaign, CRM, or import file.

You can:

- Paste email addresses directly into the page
- Upload a CSV file
- Check emails copied from spreadsheets or contact exports
- See how many emails were found
- See how many emails are valid
- See how many emails are invalid
- See duplicate email addresses
- View a full per‑email report
- Download the validation report as a CSV
- Clear the tool and start again

### Limits

- CSV uploads up to 5 MB
- Up to 300 email entries at a time

### What It Checks

The validator checks whether email addresses *look* correctly formatted. It flags:

- Missing `@`
- Invalid domain format
- Duplicate addresses (case‑insensitive)
- Consecutive dots
- Invalid characters
- Overly long email addresses

It does **not** guarantee that an inbox exists or that a message will be delivered.

---

## Dynamics Email Converter

Adapt third‑party email HTML into Dynamics 365 Customer Insights – Journeys compatible markup.

You can:

- Paste original email HTML
- Convert text, images, and buttons into Dynamics‑ready blocks
- Preview the original and converted email side‑by‑side
- Copy the converted HTML
- Refresh previews after making manual edits
- See a conversion summary
- Review warnings when the source HTML may need manual attention

### Limits

- Converter input up to 500 KB of HTML

---

## Generate

Create consistent marketing assets:

- **Campaign names** — Business, year, region, descriptor, sales play, and language joined with hyphens
- **Tracked URLs** — Base URL with UTM‑style parameters (source, medium, campaign, content, term, CRM campaign)
- **Survey URLs** — Encoded CRM context appended to base survey links

Generated items persist in your browser's `localStorage` and are restored when you revisit the page.

---

## One Page, Three Tools

The main page includes a navigation bar to switch between tools:

| Tool | Shortcut |
|------|----------|
| Generate | Default view |
| Convert | Dynamics email converter |
| Validate | Email validator |

Switch between them without leaving the page.

---

## Privacy

All processing happens **client‑side** in your browser. Email addresses, pasted HTML, and generated items are handled locally. No data is sent to any server.

---

## Development

### Project Structure

```
├── index.html              # Single‑page app shell (Tailwind‑styled, imports all tools)
├── src/
│   ├── validator/
│   │   └── validator.js    # Email validation logic (Pattens.validator)
│   ├── app.js              # Dynamics email converter (Pattens.converter)
│   └── generate.js         # Campaign/link/survey generator (Pattens.generator)
├── __tests__/              # Jest tests (mirror src/ structure)
│   ├── app.test.js         # Converter tests
│   ├── generator.test.js   # Generator tests
│   └── validator.test.js   # Validator tests (loads real source)
├── test-fixtures/          # CSV and HTML fixture files for tests
├── docs/                   # Conversion rules, Dynamics attribute docs
├── skills/                 # Agent skill definitions
├── assets/                 # Static assets (SVG logos, etc.)
├── .github/
│   └── copilot-instructions.md  # Copilot coding guidelines
├── package.json
└── README.md
```

### Running Locally

Start a local development server:

```bash
npm run dev
```

Then open `http://localhost:3001` in your browser.

### Running Tests

The project uses Jest with jsdom for automated testing:

```bash
npm test              # run all tests once
npm run test:watch    # run tests in watch mode
npm run test:coverage # run tests with coverage report
```

#### Test Suites

| Suite | What it covers |
|-------|---------------|
| `__tests__/app.test.js` | HTML parsing, block analysis, Dynamics conversion, output validation, utility functions |
| `__tests__/generator.test.js` | Campaign code building, tracked link generation, survey URL construction, localStorage persistence |
| `__tests__/validator.test.js` | Email syntax checking, CSV parsing, duplicate detection, sanitization, summary calculations |

Tests load the **real source files** via `fs.readFileSync` + `(0, eval)(code)` — no function copies are used.

### Reliability Features

- **Debounced previews** — Textarea input is debounced (300 ms) so typing large HTML doesn't freeze the browser
- **DOMParser error detection** — Malformed HTML that produces a parser error is caught and reported
- **Exception‑safe DOM walks** — Temporary attributes are always cleaned up even if the walker throws
- **Pipeline error boundaries** — Each conversion stage fails independently; earlier results are preserved
- **Input size limits** — Converter rejects HTML over 500 KB; validator rejects files over 5 MB
- **Namespaced APIs** — All modules live under `window.Pattens.{module}` to avoid global collisions
- **Resilient sample loading** — Sample HTML files load with a root‑relative path and a local fallback
- **Safe iframe sandboxes** — Preview iframes use `sandbox="allow-same-origin"` for consistent rendering

---

## License

This project is free for personal, educational, research, hobby, and other non-commercial use only. Commercial use requires prior written permission from the copyright holder.

See the [LICENSE](LICENSE) file for the complete terms.

---

## Credits

Copyright Mylo Kaye 2026.

Built by Mylo Kaye with AI.
