# GitHub Copilot Instructions - Email Validator

This repository contains a serverless email validation application built with Node.js and Vercel. Follow these guidelines when contributing code.

## Project Overview

- **Stack**: Node.js serverless functions (Vercel), vanilla JavaScript frontend, Jest for testing
- **Purpose**: Validates email addresses from CSV files by checking MX records
- **Key Dependencies**: busboy (file uploads), dns (MX validation), Stripe (payments), Jest (testing)

## Code Style & Conventions

### JavaScript
- Use `const` and `let` (never use `var`)
- Use single quotes for strings
- Use semicolons at the end of statements
- Use descriptive variable names (e.g., `MAX_FILE_SIZE`, not `mfs`)
- Add comments for complex logic and security-critical code
- Use arrow functions for callbacks and short functions
- Use async/await for asynchronous operations (prefer over .then() chains)

### File Organization
- API endpoints go in `api/` directory
- Tests go in `__tests__/` directory, mirroring the structure of `api/`
- Test files must end with `.test.js`
- Keep serverless functions focused and single-purpose

### Documentation
- Document all exported functions with clear comments
- Explain the purpose of constants (especially limits and timeouts)
- Add inline comments for security-critical operations
- Update README.md when adding new features or changing behavior

## Security Requirements (Critical)

### Input Sanitization
- **Always** sanitize user input before processing
- Remove dangerous characters: `<`, `>`, `"`, `'`, `;`, `\`, newlines, tabs
- Validate email format before MX record checks
- Never trust client-provided data

### File Upload Protection
- Maximum file size: 5MB (use `MAX_FILE_SIZE` constant)
- Maximum emails per request: 300
- Only accept CSV files
- Track file size during upload and reject oversized files immediately
- Return HTTP 413 for oversized files

### Security Headers
All API responses must include these headers:
```javascript
res.setHeader('X-Content-Type-Options', 'nosniff');
res.setHeader('X-Frame-Options', 'DENY');
res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
```

### CORS Headers
Include CORS headers for cross-origin requests:
```javascript
res.setHeader('Access-Control-Allow-Origin', '*');
res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
```

### DNS Timeout Protection
- Always set a timeout for DNS lookups (5 seconds)
- Use `Promise.race()` to implement timeouts
- Treat timeouts as validation failures, not errors
- Never let DNS lookups hang indefinitely

### Error Handling
- Use `console.error()` for logging errors (not `console.log()`)
- Never expose sensitive information in error messages
- Return appropriate HTTP status codes:
  - 200: Success
  - 400: Bad request (invalid input)
  - 413: File too large
  - 405: Method not allowed
  - 429: Rate limit exceeded
  - 500: Server error

### Secrets Management
- Never commit API keys, secrets, or credentials to the repository
- Use environment variables for sensitive data (e.g., `process.env.STRIPE_SECRET_KEY`)
- Store Stripe keys and other secrets in Vercel environment variables

## Testing Requirements

### Test Framework
- Use Jest for all tests
- Run tests with: `npm test`
- Watch mode: `npm run test:watch`
- Coverage: `npm run test:coverage`

### Test Structure
- Mock external dependencies (DNS, Stripe API) in tests
- Test both success and failure cases
- Test edge cases and boundary conditions
- Test security features (input sanitization, file size limits)
- Verify security headers are present in all responses
- Use descriptive test names that explain what is being tested

### Test Coverage
- Write tests for all new API endpoints
- Test validation logic thoroughly
- Test error handling and edge cases
- Include tests for security features

### Mock Examples
```javascript
// Mock DNS module
jest.mock('dns', () => ({
  promises: {
    resolveMx: jest.fn()
  }
}));

// Mock Stripe
jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    checkout: {
      sessions: {
        create: jest.fn()
      }
    }
  }));
});
```

## Email Validation Logic

### Processing Rules
1. Sanitize input to remove dangerous characters
2. Validate email format using regex: `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`
3. Extract domain safely with null checks
4. Check MX records for the domain with timeout protection
5. Count all processed emails: `total = valid + invalid`
6. Malformed emails are counted as invalid, not skipped
7. Empty lines and duplicates are skipped (not counted)

### Score Calculation
- Percentage = `(valid emails / total emails) × 100`
- Only count emails that were actually processed
- Report: `total`, `valid`, `invalid`, `percentage`, `skipped`

## API Design

### Request Handling
- Support OPTIONS method for CORS preflight
- Validate HTTP method (typically POST for operations)
- Parse multipart form data with busboy
- Validate request body structure before processing

### Response Format
Always return JSON with consistent structure:
```javascript
{
  "total": 100,
  "valid": 87,
  "invalid": 13,
  "percentage": 87.0,
  "skipped": 0
}
```

### Error Response Format
```javascript
{
  "error": "Clear error message for users"
}
```

## Constants and Configuration

### Define Constants at the Top
```javascript
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const DNS_TIMEOUT_MS = 5000; // 5 seconds
const MAX_EMAILS = 300;
```

### Environment Variables
- Access using `process.env.VARIABLE_NAME`
- Provide fallbacks for non-critical variables
- Never use hardcoded secrets

## Performance Considerations

- Use concurrent DNS lookups with `Promise.all()` for batch processing
- Implement proper timeout handling to prevent hanging requests
- Limit concurrent operations to prevent resource exhaustion
- Track file size during upload (don't load entire file into memory first)

## Deployment

- Target: Vercel serverless functions
- Node version: >= 18.x
- Deploy command: `npm run deploy`
- Dev server: `npm run dev`

## Privacy & Data Handling

- Never store or log email addresses
- Process data ephemerally (delete after validation)
- No PII retention or tracking
- GDPR compliant by design

## Common Patterns

### Vercel Serverless Function Template
```javascript
module.exports = async (req, res) => {
    // Set security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
    
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Content-Type', 'application/json');
    
    // Handle OPTIONS
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }
    
    try {
        // Implementation
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
```

## Don'ts

- ❌ Don't use `console.log()` for error logging (use `console.error()`)
- ❌ Don't remove or modify existing security headers
- ❌ Don't increase file size or email limits without careful consideration
- ❌ Don't skip input sanitization
- ❌ Don't commit sensitive credentials
- ❌ Don't expose internal error details to users
- ❌ Don't use blocking synchronous operations in serverless functions
- ❌ Don't skip writing tests for new features
- ❌ Don't remove existing tests unless they're truly invalid

## References

- [Vercel Serverless Functions Documentation](https://vercel.com/docs/functions)
- [busboy File Upload Library](https://github.com/mscdex/busboy)
- [Node.js DNS Module](https://nodejs.org/api/dns.html)
- [Jest Testing Framework](https://jestjs.io/)
