# Email Validator

A static HTML/CSS/JavaScript app for validating email address syntax from CSV files.

The app runs entirely in the browser. It does not use a backend, DNS MX lookups, serverless functions, or Stripe.

## Features

- CSV upload with drag-and-drop support
- Browser-side CSV parsing
- Email syntax and domain-shape validation
- Duplicate detection
- Summary results with valid, invalid, and total counts
- Full report view
- CSV report download
- 5 MB file size limit
- 300 email upload limit

## Validation Scope

This static version checks whether each email address is structurally valid. It verifies rules such as:

- One `@` symbol
- Valid local part length and characters
- Valid domain characters and labels
- No consecutive dots
- Valid top-level domain shape

It does not check MX records or mailbox deliverability because browsers do not provide DNS MX lookup APIs.

## Local Development

Run a static server from the project root:

```bash
npm run dev
```

Then open:

```text
http://localhost:3000
```

You can also use any static file server, or deploy the repository to a static host.

## File Structure

```text
email-validator/
├── index.html
├── assets/
├── test-emails.csv
├── bad-test-emails.csv
├── package.json
└── README.md
```

## CSV Format

Use one email address per line, or a normal CSV where email addresses appear in fields:

```csv
john@company.com
jane@business.org
invalid.email
```

## Deployment

Deploy the project as static files. No environment variables or serverless functions are required.

## Limitations

- No MX record validation
- No mailbox existence checks
- No payments or paid report gate
- Validation runs in the user's browser

## License

MIT
