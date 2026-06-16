/**
 * Tests for the Email Validator functions
 * @jest-environment jsdom
 */

// Replicate the validator functions from index.html for isolated testing
const VALIDATOR_MAX_FILE_SIZE = 5 * 1024 * 1024;
const VALIDATOR_MAX_EMAILS = 300;
const VALIDATOR_MAX_EMAIL_LENGTH = 254;
const VALIDATOR_MAX_LOCAL_PART_LENGTH = 64;

function sanitizeEmail(email) {
  return String(email || '')
    .replace(/[<>"';\\]/g, '')
    .replace(/[\r\n\t]/g, '')
    .trim();
}

function isValidEmailSyntax(email) {
  if (!email || typeof email !== 'string') return false;
  if (email.length > VALIDATOR_MAX_EMAIL_LENGTH) return false;
  if ((email.match(/@/g) || []).length !== 1) return false;
  if (email.includes('..')) return false;

  const [localPart, domainPart] = email.split('@');
  if (!localPart || !domainPart) return false;
  if (localPart.length > VALIDATOR_MAX_LOCAL_PART_LENGTH) return false;
  if (!/^[a-zA-Z0-9._+-]+$/.test(localPart)) return false;
  if (localPart.startsWith('.') || localPart.endsWith('.')) return false;
  if (!domainPart.includes('.')) return false;
  if (!/^[a-zA-Z0-9.-]+$/.test(domainPart)) return false;
  if (domainPart.startsWith('.') || domainPart.endsWith('.')) return false;
  if (domainPart.startsWith('-') || domainPart.endsWith('-')) return false;

  const labels = domainPart.split('.');
  if (labels.some((label) => !label || label.startsWith('-') || label.endsWith('-'))) return false;

  const tld = labels[labels.length - 1];
  return /^[a-zA-Z]{2,63}$/.test(tld);
}

function extractEmailsFromText(text) {
  const rows = parseCSV(text);
  const emails = [];

  rows.forEach((row) => {
    row.forEach((field) => {
      String(field)
        .split(/[\s;]+/)
        .map((value) => sanitizeEmail(value))
        .filter(Boolean)
        .forEach((candidate) => emails.push(candidate));
    });
  });

  return emails;
}

function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      field += '"';
      i++;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      row.push(field);
      field = '';
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') i++;
      row.push(field);
      if (row.some((value) => value.trim() !== '')) rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }

  row.push(field);
  if (row.some((value) => value.trim() !== '')) rows.push(row);
  return rows;
}

function validateEmails(emails) {
  const seen = new Set();
  const emailResults = [];
  let validCount = 0;
  let invalidCount = 0;
  let duplicateCount = 0;

  emails.forEach((email) => {
    const normalized = email.toLowerCase();

    if (seen.has(normalized)) {
      duplicateCount++;
      emailResults.push({
        email,
        status: 'Duplicate',
        valid: false,
      });
      return;
    }

    seen.add(normalized);
    const valid = isValidEmailSyntax(email);

    if (valid) {
      validCount++;
    } else {
      invalidCount++;
    }

    emailResults.push({
      email,
      status: valid ? 'Valid' : 'Invalid',
      valid,
    });
  });

  const checkedTotal = validCount + invalidCount;
  const validRate = checkedTotal > 0 ? Math.round((validCount / checkedTotal) * 100) : 0;

  return {
    summary: {
      total: emailResults.length,
      checked: checkedTotal,
      valid: validCount,
      invalid: invalidCount,
      duplicate: duplicateCount,
      validRate,
    },
    emails: emailResults,
  };
}

describe('isValidEmailSyntax', () => {
  test('validates a standard email', () => {
    expect(isValidEmailSyntax('user@example.com')).toBe(true);
  });

  test('validates email with plus sign', () => {
    expect(isValidEmailSyntax('user+tag@example.com')).toBe(true);
  });

  test('validates email with subdomain', () => {
    expect(isValidEmailSyntax('user@mail.example.co.uk')).toBe(true);
  });

  test('rejects email without @', () => {
    expect(isValidEmailSyntax('userexample.com')).toBe(false);
  });

  test('rejects email with multiple @', () => {
    expect(isValidEmailSyntax('user@@example.com')).toBe(false);
  });

  test('rejects email with consecutive dots', () => {
    expect(isValidEmailSyntax('user..name@example.com')).toBe(false);
  });

  test('rejects email with leading dot in local part', () => {
    expect(isValidEmailSyntax('.user@example.com')).toBe(false);
  });

  test('rejects email with trailing dot in local part', () => {
    expect(isValidEmailSyntax('user.@example.com')).toBe(false);
  });

  test('rejects email with invalid characters', () => {
    expect(isValidEmailSyntax('user name@example.com')).toBe(false);
  });

  test('rejects email exceeding max length', () => {
    const longLocal = 'a'.repeat(65);
    expect(isValidEmailSyntax(`${longLocal}@example.com`)).toBe(false);
  });

  test('rejects email with empty domain', () => {
    expect(isValidEmailSyntax('user@')).toBe(false);
  });

  test('rejects email with domain starting with dot', () => {
    expect(isValidEmailSyntax('user@.example.com')).toBe(false);
  });

  test('rejects email with domain starting with hyphen', () => {
    expect(isValidEmailSyntax('user@-example.com')).toBe(false);
  });

  test('rejects null/undefined', () => {
    expect(isValidEmailSyntax(null)).toBe(false);
    expect(isValidEmailSyntax(undefined)).toBe(false);
  });

  test('rejects non-string', () => {
    expect(isValidEmailSyntax(123)).toBe(false);
  });

  test('rejects email with non-alpha TLD', () => {
    expect(isValidEmailSyntax('user@example.123')).toBe(false);
  });

  test('rejects email with TLD too short', () => {
    expect(isValidEmailSyntax('user@example.a')).toBe(false);
  });
});

describe('sanitizeEmail', () => {
  test('removes dangerous characters', () => {
    expect(sanitizeEmail('<user@example.com>')).toBe('user@example.com');
    expect(sanitizeEmail('user@example.com"')).toBe('user@example.com');
    expect(sanitizeEmail("user'@example.com")).toBe('user@example.com');
  });

  test('trims whitespace', () => {
    expect(sanitizeEmail('  user@example.com  ')).toBe('user@example.com');
  });

  test('removes newlines and tabs', () => {
    expect(sanitizeEmail('user@example.com\r\n')).toBe('user@example.com');
  });

  test('handles empty input', () => {
    expect(sanitizeEmail('')).toBe('');
  });
});

describe('extractEmailsFromText', () => {
  test('extracts emails from newline-separated text', () => {
    const result = extractEmailsFromText(
      'user@example.com\nother@test.com'
    );
    expect(result).toEqual(['user@example.com', 'other@test.com']);
  });

  test('extracts emails from CSV', () => {
    const result = extractEmailsFromText(
      'user@example.com,other@test.com'
    );
    expect(result).toEqual(['user@example.com', 'other@test.com']);
  });

  test('handles quoted CSV fields', () => {
    const result = extractEmailsFromText(
      '"user@example.com","other@test.com"'
    );
    expect(result).toEqual(['user@example.com', 'other@test.com']);
  });

  test('skips empty lines', () => {
    const result = extractEmailsFromText(
      'user@example.com\n\nother@test.com\n'
    );
    expect(result).toEqual(['user@example.com', 'other@test.com']);
  });

  test('handles empty input', () => {
    const result = extractEmailsFromText('');
    expect(result).toEqual([]);
  });
});

describe('validateEmails', () => {
  test('counts valid and invalid emails', () => {
    const result = validateEmails([
      'user@example.com',
      'invalid@@example.com',
      'another@test.com',
    ]);
    expect(result.summary.valid).toBe(2);
    expect(result.summary.invalid).toBe(1);
    expect(result.summary.total).toBe(3);
  });

  test('detects duplicates', () => {
    const result = validateEmails([
      'user@example.com',
      'user@example.com',
      'USER@EXAMPLE.COM',
    ]);
    expect(result.summary.duplicate).toBe(2);
    expect(result.summary.valid).toBe(1);
  });

  test('calculates valid rate', () => {
    const result = validateEmails([
      'user@example.com',
      'invalid',
      'other@test.com',
    ]);
    expect(result.summary.validRate).toBe(67); // 2/3 rounded
  });

  test('returns 0 rate for empty input', () => {
    const result = validateEmails([]);
    expect(result.summary.validRate).toBe(0);
  });

  test('assigns correct status to each email', () => {
    const result = validateEmails(['good@example.com', 'bad@@example.com']);
    expect(result.emails[0].status).toBe('Valid');
    expect(result.emails[1].status).toBe('Invalid');
  });
});

describe('parseCSV', () => {
  test('parses simple CSV', () => {
    const result = parseCSV('a,b,c\nd,e,f');
    expect(result).toEqual([['a', 'b', 'c'], ['d', 'e', 'f']]);
  });

  test('handles quoted fields with commas', () => {
    const result = parseCSV('"Hello, World",test');
    expect(result).toEqual([['Hello, World', 'test']]);
  });

  test('handles escaped quotes', () => {
    const result = parseCSV('"She said ""hi""",ok');
    expect(result).toEqual([['She said "hi"', 'ok']]);
  });

  test('handles empty input', () => {
    const result = parseCSV('');
    expect(result).toEqual([]);
  });
});
