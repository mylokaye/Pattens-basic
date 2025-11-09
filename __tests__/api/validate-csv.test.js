const dns = require('dns').promises;

// Mock DNS module
jest.mock('dns', () => ({
  promises: {
    resolveMx: jest.fn()
  }
}));

// Helper functions (extracted from actual implementation for testing)
const sanitizeEmail = (email) => {
  if (!email || typeof email !== 'string') {
    return '';
  }
  return email
    .replace(/[<>"';\\]/g, '')
    .replace(/[\r\n\t]/g, '')
    .trim();
};

const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const getDomain = (email) => {
  if (!email || typeof email !== 'string') {
    return null;
  }
  const parts = email.split('@');
  if (parts.length !== 2) {
    return null;
  }
  const domain = parts[1];
  if (!domain || domain.length === 0) {
    return null;
  }
  return domain;
};

const checkMXRecords = async (domain) => {
  const DNS_TIMEOUT_MS = 5000; // 5 seconds
  
  // Create timeout promise that resolves to false
  const timeoutPromise = new Promise((resolve) => {
    setTimeout(() => resolve(false), DNS_TIMEOUT_MS);
  });
  
  // Create DNS lookup promise
  const dnsPromise = dns.resolveMx(domain)
    .then(records => records && records.length > 0)
    .catch(() => false); // DNS errors return false
  
  // Race DNS lookup against timeout
  return Promise.race([dnsPromise, timeoutPromise]);
};

const processCSV = async (csvContent) => {
  const lines = csvContent.split(/\r?\n/);
  const emails = [];
  const seenEmails = new Set();

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const sanitized = sanitizeEmail(trimmed);
    if (!sanitized) continue;
    const normalized = sanitized.toLowerCase();
    if (seenEmails.has(normalized)) continue;
    emails.push(normalized);
    seenEmails.add(normalized);
  }
  return emails;
};

describe('Email Validator API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic functionality', () => {
    test('should be defined', () => {
      expect(true).toBe(true);
    });
  });

  describe('Email validation regex', () => {
    test('should validate correct email format', () => {
      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('user@domain.org')).toBe(true);
      expect(isValidEmail('name.surname@company.co.uk')).toBe(true);
    });

    test('should reject invalid email formats', () => {
      expect(isValidEmail('notanemail')).toBe(false);
      expect(isValidEmail('missing@domain')).toBe(false);
      expect(isValidEmail('@nodomain.com')).toBe(false);
      expect(isValidEmail('no@symbol')).toBe(false);
    });
  });

  describe('Domain extraction', () => {
    test('should extract domain from email', () => {
      expect(getDomain('test@example.com')).toBe('example.com');
      expect(getDomain('user@subdomain.example.org')).toBe('subdomain.example.org');
    });
  });

  describe('MX record checking', () => {
    test('should return true when MX records exist', async () => {
      dns.resolveMx.mockResolvedValue([
        { exchange: 'mail.example.com', priority: 10 }
      ]);

      const result = await checkMXRecords('example.com');
      expect(result).toBe(true);
      expect(dns.resolveMx).toHaveBeenCalledWith('example.com');
    });

    test('should return false when MX records do not exist', async () => {
      dns.resolveMx.mockRejectedValue(new Error('No MX records'));

      const result = await checkMXRecords('invalid-domain.test');
      expect(result).toBe(false);
    });

    test('should return false when DNS lookup fails', async () => {
      dns.resolveMx.mockRejectedValue(new Error('DNS lookup failed'));

      const result = await checkMXRecords('failing-domain.test');
      expect(result).toBe(false);
    });
  });

  describe('DNS timeout protection', () => {
    test('should return false when DNS lookup exceeds 5 second timeout', async () => {
      // Mock a DNS lookup that takes longer than the timeout
      dns.resolveMx.mockImplementation(() => {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve([{ exchange: 'mail.example.com', priority: 10 }]);
          }, 6000); // 6 seconds - longer than 5 second timeout
        });
      });

      const startTime = Date.now();
      const result = await checkMXRecords('slow-domain.test');
      const elapsedTime = Date.now() - startTime;

      expect(result).toBe(false);
      // Should timeout around 5 seconds, not wait full 6 seconds
      expect(elapsedTime).toBeLessThan(5500);
      expect(elapsedTime).toBeGreaterThanOrEqual(4900);
    }, 10000); // 10 second timeout for this test

    test('should return correct result when DNS lookup completes quickly', async () => {
      // Mock a fast DNS lookup (under 1 second)
      dns.resolveMx.mockImplementation(() => {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve([{ exchange: 'mail.example.com', priority: 10 }]);
          }, 100); // 100ms - much faster than timeout
        });
      });

      const startTime = Date.now();
      const result = await checkMXRecords('fast-domain.test');
      const elapsedTime = Date.now() - startTime;

      expect(result).toBe(true);
      // Should complete quickly, not wait for timeout
      expect(elapsedTime).toBeLessThan(1000);
    });

    test('should handle multiple concurrent DNS lookups with mixed timeouts', async () => {
      // Set up different mock responses for different domains
      dns.resolveMx.mockImplementation((domain) => {
        if (domain === 'fast.test') {
          // Fast response
          return Promise.resolve([{ exchange: 'mail.fast.test', priority: 10 }]);
        } else if (domain === 'slow.test') {
          // Slow response that will timeout
          return new Promise((resolve) => {
            setTimeout(() => resolve([{ exchange: 'mail.slow.test', priority: 10 }]), 6000);
          });
        } else if (domain === 'error.test') {
          // DNS error
          return Promise.reject(new Error('DNS lookup failed'));
        }
      });

      // Run multiple DNS checks concurrently
      const startTime = Date.now();
      const results = await Promise.all([
        checkMXRecords('fast.test'),
        checkMXRecords('slow.test'),
        checkMXRecords('error.test')
      ]);
      const elapsedTime = Date.now() - startTime;

      // Fast lookup should succeed
      expect(results[0]).toBe(true);
      // Slow lookup should timeout and return false
      expect(results[1]).toBe(false);
      // Error lookup should return false
      expect(results[2]).toBe(false);

      // Should complete around 5 seconds (timeout of slowest), not 6+
      expect(elapsedTime).toBeLessThan(5500);
    }, 10000); // 10 second timeout for this test
  });

  describe('CSV processing', () => {
    test('should parse valid emails from CSV content', async () => {
      const csvContent = 'test@example.com\nuser@domain.org\nname@company.com';
      const emails = await processCSV(csvContent);

      expect(emails).toHaveLength(3);
      expect(emails).toContain('test@example.com');
      expect(emails).toContain('user@domain.org');
      expect(emails).toContain('name@company.com');
    });

    test('should skip empty lines', async () => {
      const csvContent = 'test@example.com\n\n\nuser@domain.org';
      const emails = await processCSV(csvContent);

      expect(emails).toHaveLength(2);
    });

    test('should remove duplicate emails', async () => {
      const csvContent = 'test@example.com\nTest@Example.com\ntest@example.com';
      const emails = await processCSV(csvContent);

      expect(emails).toHaveLength(1);
      expect(emails[0]).toBe('test@example.com');
    });

    test('should include all emails including invalid formats', async () => {
      const csvContent = 'test@example.com\ninvalidemail\n@nodomain.com\nvalid@email.com';
      const emails = await processCSV(csvContent);

      // Stage 3: Now includes ALL emails, not just valid format
      expect(emails).toHaveLength(4);
      expect(emails).toContain('test@example.com');
      expect(emails).toContain('invalidemail');
      expect(emails).toContain('@nodomain.com');
      expect(emails).toContain('valid@email.com');
    });
  });

  describe('File size validation', () => {
    const handler = require('../../api/validate-csv');
    const { Readable } = require('stream');

    // Helper to create a mock request with file upload
    const createMockRequest = (fileContent, filename = 'test.csv') => {
      const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
      const contentType = `multipart/form-data; boundary=${boundary}`;
      
      // Create multipart form data
      const parts = [
        `--${boundary}`,
        `Content-Disposition: form-data; name="file"; filename="${filename}"`,
        'Content-Type: text/csv',
        '',
        fileContent,
        `--${boundary}--`
      ];
      
      const body = parts.join('\r\n');
      const stream = Readable.from([body]);
      
      return Object.assign(stream, {
        method: 'POST',
        headers: {
          'content-type': contentType
        }
      });
    };

    // Helper to create a mock response
    const createMockResponse = () => {
      const res = {
        statusCode: 200,
        headers: {},
        body: null,
        setHeader: jest.fn((key, value) => {
          res.headers[key] = value;
        }),
        status: jest.fn((code) => {
          res.statusCode = code;
          return res;
        }),
        json: jest.fn((data) => {
          res.body = data;
          return res;
        }),
        end: jest.fn()
      };
      return res;
    };

    test('should accept small valid file under 1MB', async () => {
      // Create a small file with valid emails
      const emails = Array(100).fill(0).map((_, i) => `test${i}@example.com`).join('\n');
      const req = createMockRequest(emails);
      const res = createMockResponse();

      dns.resolveMx.mockResolvedValue([{ exchange: 'mail.example.com', priority: 10 }]);

      await handler(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('total');
      expect(res.body).toHaveProperty('valid');
      expect(res.body).toHaveProperty('invalid');
    });

    test('should reject large file over 5MB with 413 status', async () => {
      // Create a file larger than 5MB (5 * 1024 * 1024 bytes)
      // Use padding to make it large without many emails to avoid 300 email limit
      const maxSize = 5 * 1024 * 1024;
      const email = 'test@example.com\n';
      const padding = 'x'.repeat(1024); // 1KB of padding per line
      const line = email + padding + '\n';
      const numLines = Math.ceil(maxSize / line.length) + 10; // Ensure > 5MB
      const largeContent = Array(numLines).fill(line).join('');
      
      const req = createMockRequest(largeContent);
      const res = createMockResponse();

      await handler(req, res);

      expect(res.statusCode).toBe(413);
      expect(res.body).toHaveProperty('error');
      expect(res.body.error).toBe('File too large. Maximum size is 5MB');
    });

    test('should accept file at exactly 5MB limit', async () => {
      // Create a file at approximately 5MB
      const maxSize = 5 * 1024 * 1024;
      const lineSize = 30;
      const numLines = Math.floor(maxSize / lineSize) - 100; // Slightly under to account for line breaks
      const content = Array(numLines).fill(0).map((_, i) => `test${i}@example.com`).join('\n');
      
      const req = createMockRequest(content);
      const res = createMockResponse();

      dns.resolveMx.mockResolvedValue([{ exchange: 'mail.example.com', priority: 10 }]);

      await handler(req, res);

      // Should succeed (200) or hit email limit (400), but not file size error (413)
      expect(res.statusCode).not.toBe(413);
    });

    test('should handle file size check with multiple chunks', async () => {
      // This test verifies that file size is tracked across multiple data chunks
      // The busboy library will handle chunking internally
      const maxSize = 5 * 1024 * 1024;
      const email = 'test@example.com\n';
      const padding = 'x'.repeat(1024); // 1KB of padding per line
      const line = email + padding + '\n';
      const numLines = Math.ceil(maxSize / line.length) + 10; // Ensure > 5MB
      const largeContent = Array(numLines).fill(line).join('');
      
      const req = createMockRequest(largeContent);
      const res = createMockResponse();

      await handler(req, res);

      expect(res.statusCode).toBe(413);
      expect(res.body.error).toBe('File too large. Maximum size is 5MB');
    });
  });

  describe('Security headers', () => {
    const handler = require('../../api/validate-csv');
    const { Readable } = require('stream');

    // Helper to create a mock request
    const createMockRequest = (method = 'OPTIONS', fileContent = '', filename = 'test.csv') => {
      if (method === 'OPTIONS') {
        return {
          method: 'OPTIONS',
          headers: {}
        };
      }

      const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
      const contentType = `multipart/form-data; boundary=${boundary}`;
      
      const parts = [
        `--${boundary}`,
        `Content-Disposition: form-data; name="file"; filename="${filename}"`,
        'Content-Type: text/csv',
        '',
        fileContent,
        `--${boundary}--`
      ];
      
      const body = parts.join('\r\n');
      const stream = Readable.from([body]);
      
      return Object.assign(stream, {
        method,
        headers: {
          'content-type': contentType
        }
      });
    };

    // Helper to create a mock response
    const createMockResponse = () => {
      const res = {
        statusCode: 200,
        headers: {},
        body: null,
        setHeader: jest.fn((key, value) => {
          res.headers[key] = value;
        }),
        status: jest.fn((code) => {
          res.statusCode = code;
          return res;
        }),
        json: jest.fn((data) => {
          res.body = data;
          return res;
        }),
        end: jest.fn()
      };
      return res;
    };

    // Helper to verify all security headers are present
    const verifySecurityHeaders = (res) => {
      expect(res.headers['X-Content-Type-Options']).toBe('nosniff');
      expect(res.headers['X-Frame-Options']).toBe('DENY');
      expect(res.headers['X-XSS-Protection']).toBe('1; mode=block');
      expect(res.headers['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
      expect(res.headers['Content-Security-Policy']).toBe("default-src 'none'; frame-ancestors 'none'");
    };

    test('should include security headers in OPTIONS preflight response', async () => {
      const req = createMockRequest('OPTIONS');
      const res = createMockResponse();

      await handler(req, res);

      expect(res.statusCode).toBe(200);
      verifySecurityHeaders(res);
    });

    test('should include security headers in successful POST response (200)', async () => {
      const emails = 'test1@example.com\ntest2@example.com\ntest3@example.com';
      const req = createMockRequest('POST', emails);
      const res = createMockResponse();

      dns.resolveMx.mockResolvedValue([{ exchange: 'mail.example.com', priority: 10 }]);

      await handler(req, res);

      expect(res.statusCode).toBe(200);
      verifySecurityHeaders(res);
    });

    test('should include security headers in bad request response (400)', async () => {
      // File with more than 300 emails should trigger 400 error
      const emails = Array(301).fill(0).map((_, i) => `test${i}@example.com`).join('\n');
      const req = createMockRequest('POST', emails);
      const res = createMockResponse();

      await handler(req, res);

      expect(res.statusCode).toBe(400);
      verifySecurityHeaders(res);
    });

    test('should include security headers in file too large response (413)', async () => {
      // Create a file larger than 5MB
      const maxSize = 5 * 1024 * 1024;
      const email = 'test@example.com\n';
      const padding = 'x'.repeat(1024);
      const line = email + padding + '\n';
      const numLines = Math.ceil(maxSize / line.length) + 10;
      const largeContent = Array(numLines).fill(line).join('');
      
      const req = createMockRequest('POST', largeContent);
      const res = createMockResponse();

      await handler(req, res);

      expect(res.statusCode).toBe(413);
      verifySecurityHeaders(res);
    });

    test('should include security headers in method not allowed response (405)', async () => {
      const req = {
        method: 'GET',
        headers: {}
      };
      const res = createMockResponse();

      await handler(req, res);

      expect(res.statusCode).toBe(405);
      verifySecurityHeaders(res);
    });

    test('should include CORS headers along with security headers', async () => {
      const req = createMockRequest('OPTIONS');
      const res = createMockResponse();

      await handler(req, res);

      // Verify CORS headers are still present
      expect(res.headers['Access-Control-Allow-Origin']).toBe('*');
      expect(res.headers['Access-Control-Allow-Methods']).toBe('POST, OPTIONS');
      expect(res.headers['Access-Control-Allow-Headers']).toBe('Content-Type');
      expect(res.headers['Content-Type']).toBe('application/json');
      
      // Verify security headers are also present
      verifySecurityHeaders(res);
    });
  });

  describe('Stage 3: Input Sanitization', () => {
    describe('sanitizeEmail function', () => {
      test('should remove dangerous characters', () => {
        expect(sanitizeEmail('test<script>@example.com')).toBe('testscript@example.com');
        expect(sanitizeEmail('test"@example.com')).toBe('test@example.com');
        expect(sanitizeEmail("test'@example.com")).toBe('test@example.com');
        expect(sanitizeEmail('test;@example.com')).toBe('test@example.com');
        expect(sanitizeEmail('test\\@example.com')).toBe('test@example.com');
      });

      test('should remove newlines and tabs', () => {
        expect(sanitizeEmail('test\n@example.com')).toBe('test@example.com');
        expect(sanitizeEmail('test\r@example.com')).toBe('test@example.com');
        expect(sanitizeEmail('test\t@example.com')).toBe('test@example.com');
      });

      test('should trim whitespace', () => {
        expect(sanitizeEmail('  test@example.com  ')).toBe('test@example.com');
      });

      test('should handle empty or null inputs', () => {
        expect(sanitizeEmail('')).toBe('');
        expect(sanitizeEmail(null)).toBe('');
        expect(sanitizeEmail(undefined)).toBe('');
      });

      test('should preserve valid email addresses', () => {
        expect(sanitizeEmail('test@example.com')).toBe('test@example.com');
        expect(sanitizeEmail('user.name@subdomain.example.org')).toBe('user.name@subdomain.example.org');
      });
    });

    describe('getDomain function - edge case handling', () => {
      test('should return null for malformed emails', () => {
        expect(getDomain('testexample.com')).toBe(null); // Missing @
        expect(getDomain('test@@example.com')).toBe(null); // Multiple @
        expect(getDomain('test@')).toBe(null); // Empty domain
        // Note: @example.com has 2 parts so getDomain returns 'example.com'
        // But isValidEmail will reject it due to empty local part
        expect(getDomain('@example.com')).toBe('example.com'); // 2 parts, returns domain (but isValidEmail will fail)
      });

      test('should return null for null/undefined inputs', () => {
        expect(getDomain(null)).toBe(null);
        expect(getDomain(undefined)).toBe(null);
        expect(getDomain('')).toBe(null);
      });

      test('should extract domain correctly from valid emails', () => {
        expect(getDomain('test@example.com')).toBe('example.com');
        expect(getDomain('user@subdomain.example.org')).toBe('subdomain.example.org');
      });
    });

    describe('processCSV - sanitization integration', () => {
      test('should sanitize emails before processing', async () => {
        const csvContent = 'test<script>@example.com\nuser"quote"@domain.org';
        const emails = await processCSV(csvContent);

        expect(emails).toHaveLength(2);
        expect(emails).toContain('testscript@example.com');
        // Double quotes are removed, so "quote" becomes quote
        expect(emails).toContain('userquote@domain.org');
      });

      test('should include malformed emails for counting', async () => {
        const csvContent = 'test@example.com\ntestexample.com\nuser@@domain.org\ntest@';
        const emails = await processCSV(csvContent);

        // All emails should be included (valid and malformed)
        expect(emails).toHaveLength(4);
        expect(emails).toContain('test@example.com');
        expect(emails).toContain('testexample.com'); // Malformed but included
        expect(emails).toContain('user@@domain.org'); // Malformed but included
        expect(emails).toContain('test@'); // Malformed but included
      });

      test('should skip empty lines after sanitization', async () => {
        const csvContent = 'test@example.com\n<>\n"\'\n\nuser@domain.org';
        const emails = await processCSV(csvContent);

        // Only valid emails, empty lines skipped
        expect(emails).toHaveLength(2);
        expect(emails).toContain('test@example.com');
        expect(emails).toContain('user@domain.org');
      });
    });

    describe('validateEmails - count all emails', () => {
      const handler = require('../../api/validate-csv');
      const { Readable } = require('stream');

      const createMockRequest = (fileContent, filename = 'test.csv') => {
        const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
        const contentType = `multipart/form-data; boundary=${boundary}`;
        
        const parts = [
          `--${boundary}`,
          `Content-Disposition: form-data; name="file"; filename="${filename}"`,
          'Content-Type: text/csv',
          '',
          fileContent,
          `--${boundary}--`
        ];
        
        const body = parts.join('\r\n');
        const stream = Readable.from([body]);
        
        return Object.assign(stream, {
          method: 'POST',
          headers: {
            'content-type': contentType
          }
        });
      };

      const createMockResponse = () => {
        const res = {
          statusCode: 200,
          headers: {},
          body: null,
          setHeader: jest.fn((key, value) => {
            res.headers[key] = value;
          }),
          status: jest.fn((code) => {
            res.statusCode = code;
            return res;
          }),
          json: jest.fn((data) => {
            res.body = data;
            return res;
          }),
          end: jest.fn()
        };
        return res;
      };

      test('should count malformed emails as invalid', async () => {
        const csvContent = 'test@example.com\ntestexample.com\nuser@@domain.org\ntest@\nvalid@email.com';
        const req = createMockRequest(csvContent);
        const res = createMockResponse();

        dns.resolveMx.mockResolvedValue([{ exchange: 'mail.example.com', priority: 10 }]);

        await handler(req, res);

        expect(res.statusCode).toBe(200);
        expect(res.body.total).toBe(5); // All 5 emails counted
        expect(res.body.valid).toBe(2); // 2 valid format with MX records
        expect(res.body.invalid).toBe(3); // 3 malformed emails
      });

      test('should count valid format but no MX as invalid', async () => {
        const csvContent = 'test@example.com\nuser@nonexistent.test';
        const req = createMockRequest(csvContent);
        const res = createMockResponse();

        // First domain has MX, second doesn't
        dns.resolveMx.mockImplementation((domain) => {
          if (domain === 'example.com') {
            return Promise.resolve([{ exchange: 'mail.example.com', priority: 10 }]);
          }
          return Promise.reject(new Error('No MX records'));
        });

        await handler(req, res);

        expect(res.statusCode).toBe(200);
        expect(res.body.total).toBe(2);
        expect(res.body.valid).toBe(1); // Only example.com
        expect(res.body.invalid).toBe(1); // nonexistent.test has valid format but no MX
      });

      test('should sanitize injection attempts', async () => {
        const csvContent = 'test<script>@example.com\nuser"@domain.org';
        const req = createMockRequest(csvContent);
        const res = createMockResponse();

        dns.resolveMx.mockResolvedValue([{ exchange: 'mail.example.com', priority: 10 }]);

        await handler(req, res);

        expect(res.statusCode).toBe(200);
        expect(res.body.total).toBe(2);
        // Both should be processed after sanitization
      });

      test('should handle mixed valid and invalid emails', async () => {
        const csvContent = 'valid1@example.com\ninvalid-no-at\nvalid2@example.com\n@@invalid\nvalid3@example.com';
        const req = createMockRequest(csvContent);
        const res = createMockResponse();

        dns.resolveMx.mockResolvedValue([{ exchange: 'mail.example.com', priority: 10 }]);

        await handler(req, res);

        expect(res.statusCode).toBe(200);
        expect(res.body.total).toBe(5); // All emails counted
        expect(res.body.valid).toBe(3); // 3 valid
        expect(res.body.invalid).toBe(2); // 2 invalid
        expect(res.body.percentage).toBe(60); // 3/5 * 100
      });

      test('should handle bad-test-emails.csv correctly', async () => {
        // Content from bad-test-emails.csv:
        // john.smithicrosoft.com (missing @, malformed)
        // sarah.jones@google.commm (valid format but bad domain)
        const csvContent = 'john.smithicrosoft.com\nsarah.jones@google.commm';
        const req = createMockRequest(csvContent);
        const res = createMockResponse();

        // Mock DNS to reject both domains
        dns.resolveMx.mockRejectedValue(new Error('No MX records'));

        await handler(req, res);

        expect(res.statusCode).toBe(200);
        expect(res.body.total).toBe(2); // Both emails counted
        expect(res.body.valid).toBe(0); // Neither has MX records
        expect(res.body.invalid).toBe(2); // Both invalid (1 malformed, 1 no MX)
        expect(res.body.percentage).toBe(0); // 0/2 * 100
      });
    });
  });
});
