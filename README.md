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
- Convert the HTML into a Dynamics-ready structure
- Preview the original email
- Preview the converted email
- Copy the converted HTML
- Refresh previews after making changes
- See a conversion summary
- Review warnings when the source HTML may need attention

The converter is useful when adapting email templates from other tools into a format that is easier to work with in Dynamics.

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

## Files Included

The project includes:

- `index.html` for the combined main app
- `app.js` for the converter behaviour
- Sample CSV files for testing the validator
- Visual assets used by the interface
- `archive/` for older standalone pages and reference material

## Credits

Copyright Pattens 2026.

Built by Mylo Kaye.
