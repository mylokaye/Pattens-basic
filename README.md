# PATTENS Email Tools

PATTENS Email Tools is a simple browser-based toolkit for working with email lists and email HTML.

It brings two tools into one page:

- Contact List Verification
- Dynamics Email Converter

Everything is designed to be quick, clear, and easy to use.

## Contact List Verification

Use the validator to check email addresses before adding them to a campaign, contact list, CRM, or import file.

You can:

- Paste email addresses directly into the page
- Upload a CSV file
- Check emails copied from spreadsheets or contact exports
- See how many emails were found
- See how many emails are valid
- See how many emails are invalid
- See duplicate email addresses
- View a full per-email report
- Download the validation report as a CSV
- Clear the tool and start again

The validator is useful for cleaning up lists before sending, importing, or sharing them.

## Dynamics Email Converter

Use the converter to prepare third-party email HTML for Dynamics.

You can:

- Paste original email HTML
- Convert text, images, and buttons into Dynamics-ready blocks
- Preview the original email
- Preview the converted email
- Copy the converted HTML
- Refresh previews after making changes
- See a conversion summary
- Review warnings when the source HTML may need attention

The converter is useful when adapting email templates from other tools into a format that is easier to work with in Dynamics.

## Generate

Use Generate to create consistent campaign names, tracked links, and encoded survey URLs. Generated items are stored in the browser and restored when the page is reopened.

## One Page, Two Tools

The main page includes a simple navigation switch:

- Validator
- Converter

You can move between both tools without leaving the page.

## Privacy

The tools are designed to run in your browser.

Email addresses and pasted HTML are handled locally while you use the page. The tool is intended for quick checks and conversions without requiring an account.

## Limits

The validator is designed for small and medium contact-list checks.

Current limits:

- CSV uploads up to 5 MB
- Up to 300 email entries at a time
- Converter input up to 500 KB of HTML

## Validation Notes

The validator checks whether email addresses look correctly formatted.

It can identify common issues such as:

- Missing `@`
- Invalid domain format
- Duplicate addresses
- Consecutive dots
- Invalid characters
- Overly long email addresses

It does not guarantee that an email inbox exists or that a message will be delivered.

## Development

### Running locally

Start a local development server:

```
npm run dev
```

Then open `http://localhost:3001` in your browser.

### Running tests

The project uses Jest with jsdom for automated testing:

```
npm test           # run all tests once
npm run test:watch # run tests in watch mode
npm run test:coverage # run tests with coverage report
```

Two test suites are included:

- **`__tests__/app.test.js`** — Converter: HTML parsing, block analysis, Dynamics conversion, output validation, and utility functions.
- **`__tests__/validator.test.js`** — Validator: email syntax checking, CSV parsing, duplicate detection, sanitization, and summary calculations.

### Reliability features

The codebase includes several stability safeguards:

- **Debounced previews** — Textarea input is debounced (300ms) so typing large HTML doesn't freeze the browser.
- **DOMParser error detection** — Malformed HTML that produces a parser error document is caught and reported instead of silently producing broken output.
- **Exception-safe DOM walks** — Temporary attributes are always cleaned up even if the element walker throws mid-traversal.
- **Pipeline error boundaries** — Each conversion stage (analysis, conversion, validation) fails independently so earlier results are preserved.
- **Input size limits** — The converter rejects HTML over 500KB to prevent browser freeze from extremely large input.
- **Deduplicated utilities** — `escapeHtml` is defined once in `app.js` and shared across both tools.
- **Namespaced API** — Converter functions live under `window.Pattens.converter` to avoid global namespace collisions.
- **Resilient sample loading** — Sample HTML files load with a root-relative path with a local fallback.
- **Safe iframe sandboxes** — Preview iframes use `sandbox="allow-same-origin"` for consistent rendering while maintaining security.

## Files Included

The project includes:

- `index.html` for the combined main app
- `app.js` for the converter behaviour (namespaced under `window.Pattens.converter`)
- `styles.css` for the visual theme
- Sample CSV files for testing the validator
- `__tests__/` for automated Jest test suites
- `docs/` for conversion rules and Dynamics template attribute reference
- `skills/` for the dynamics-email-converter agent skill definition
- Visual assets used by the interface

## Credits

Copyright Pattens 2026.

Built by Mylo Kaye.
