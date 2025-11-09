# Email Validator

A beautiful, modern web application that validates email addresses from CSV files by checking MX records. Features an animated gradient background with smooth hero-to-upload transitions.

## Features

### User Experience
- **Hero Landing Page**: Welcome screen with clear value proposition
- **Smooth Transitions**: Animated hero → upload interface transition
- **Drag & Drop Upload**: Simple CSV file upload with visual feedback
- **Real-time Validation**: Validates up to 300 emails per upload using MX record checks
- **Progress Tracking**: Visual progress bar during validation
- **Clean Results**: Single percentage score showing valid email addresses
- **Terms & Privacy Modal**: Accessible modal with keyboard navigation

### Design
- **Animated Background**: Multiple gradient orbs with smooth animations
- **Twinkling Stars**: Canvas-based star field effect
- **Bottom Glow**: Elegant glow effect at the bottom of the page
- **Responsive**: Mobile-first design that works on all devices
- **Accessible**: ARIA labels, keyboard navigation, focus management

### Technical
- **SEO Optimized**: Comprehensive meta tags and Schema.org markup
- **Fast Loading**: Tailwind CSS via CDN
- **Modern Stack**: Vanilla JavaScript, no frameworks needed
- **Serverless**: Vercel serverless functions for backend

## Live Demo

Visit: [https://email-validation-neon.vercel.app)

## How It Works

1. **Land on Hero**: See the value proposition and "verify now" button
2. **Upload CSV**: Click to transition to upload interface
3. **Drag & Drop**: Upload your CSV file (or click to browse)
4. **Validation**: System validates each email's domain by checking MX records
5. **Results**: Get instant percentage of valid email addresses

## Technical Stack

### Frontend
- **HTML5**: Semantic markup with ARIA accessibility
- **Tailwind CSS**: Utility-first CSS framework (CDN)
- **Vanilla JavaScript**: No dependencies, pure JS
- **Canvas API**: For animated star field
- **CSS Animations**: Smooth transitions and gradient animations

### Backend
- **Node.js**: Serverless function (Vercel)
- **DNS MX Validation**: Checks domain mail exchange records
- **Rate Limited**: Max 300 emails per request

## File Structure

```
email-validator/
├── index.html              # Main application (hero + upload interface)
├── api/
│   └── validate-csv.js    # Backend API endpoint
├── assets/                 # Images and icons
├── vercel.json            # Vercel configuration
├── package.json           # Node.js dependencies
├── test-emails.csv        # Sample CSV file
└── README.md              # This file
```

## CSV Format

Your CSV file should contain one email address per line:

```
john@company.com
jane@business.org
test@example.com
```

**Requirements**:
- One email per line
- Max 300 unique emails per upload (after duplicates removed)
- Empty lines are removed during parsing
- Malformed emails are counted as invalid (not removed)
- Duplicate emails are automatically removed during parsing

## Validation Logic

### Email Processing & Input Sanitization

**Input Sanitization**:
- Removes dangerous characters (`<`, `>`, `"`, `'`, `;`, `\`) to prevent injection attacks
- Removes newlines, tabs, and carriage returns
- Trims whitespace

**Validation Process**:
The validator performs comprehensive email validation using a multi-stage process:

1. **Format Validation**: Checks email structure and syntax
2. **DNS Validation**: Verifies domain exists and can receive email (MX records)
3. **Status Classification**: Assigns specific status codes for detailed reporting

**Counting Behavior**:
- All processed emails are counted: `total = valid + invalid`
- Malformed emails are counted as invalid, not skipped
- Empty lines and duplicate emails are removed during CSV parsing (before counting)
- Maximum 300 unique emails per upload; files exceeding this limit are rejected with 400 error
- The `skipped` field in the response is always 0 (reserved for future use)

**Score Calculation**: `(valid emails / total emails) × 100`

### Validation Status Codes

The validator returns detailed status codes for each email, classified into three categories:

#### Pass Status (Valid Emails)
| Status Code | Description |
|-------------|-------------|
| `Success` | Email format is valid and domain has MX records (can receive email) |
| `ServerIsCatchAll` | Mail server accepts all emails (catch-all configuration) |

#### Fail Status (Invalid Emails)
| Status Code | Description |
|-------------|-------------|
| `AtSignNotFound` | Email is missing the @ symbol |
| `DoubleDotSequence` | Email contains two consecutive dots (..) |
| `InvalidAddressLength` | Email exceeds maximum length (254 characters) |
| `InvalidCharacterInSequence` | Email contains invalid characters |
| `InvalidLocalPartLength` | Part before @ is too long (max 64 characters) or empty |
| `DomainPartCompliancyFailure` | Domain part is malformed or doesn't meet format requirements |
| `DnsQueryTimeout` | DNS lookup took too long (>5 seconds) |
| `DomainDoesNotExist` | Domain doesn't exist in DNS |
| `DomainHasNullMx` | Domain exists but has no mail servers (MX records) |
| `DnsConnectionFailure` | Could not connect to DNS to verify domain |
| `UnhandledException` | Unexpected error during validation |

#### Ignore Status (Edge Cases)
| Status Code | Description |
|-------------|-------------|
| `Duplicate` | Email appeared multiple times in the list (counted once) |
| `CatchAllValidationTimeout` | Timeout during catch-all server detection |

### Validation Examples

**Valid Email**:
- `john@example.com` → `Success` (format valid + MX records exist)

**Invalid Emails**:
- `invalid.email` → `AtSignNotFound` (missing @)
- `test@` → `DomainPartCompliancyFailure` (no domain)
- `user..name@domain.com` → `DoubleDotSequence` (double dots)
- `test@nonexistentdomain123xyz.com` → `DomainDoesNotExist` (domain not found)
- `user@valid-domain.com` (no MX) → `DomainHasNullMx` (domain exists but can't receive email)

## Deployment

### Deploy to Vercel (Recommended)

1. Fork this repository
2. Visit [vercel.com](https://vercel.com)
3. Import your forked repository
4. Deploy!

### Or use Vercel CLI:

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy to production
vercel --prod
```

## Local Development

1. Install Vercel CLI:
   ```bash
   npm install -g vercel
   ```

2. Run locally:
   ```bash
   vercel dev
   ```

3. Open [http://localhost:3000](http://localhost:3000)

## Testing

The project uses Jest for testing the validation logic.

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode (for development)
npm run test:watch

# Run tests with coverage report
npm run test:coverage
```

### Test Structure

Tests are located in the `__tests__/` directory:
```
__tests__/
├── api/
│   ├── validate-csv.test.js                    # Email validation logic tests
│   ├── create-payment-intent.test.js           # Stripe Payment Intent tests (integrated approach)
│   └── create-checkout-session.test.js         # Stripe Checkout tests (legacy, not in production)
├── integration/
│   └── stripe-transaction-simulation.test.js   # Stripe transaction simulation tests
└── helpers/
    └── stripe-test-helpers.js                  # Stripe test utilities
```

### Test Files

Sample CSV files for testing:
- `test-emails.csv` - Valid email addresses for testing
- `bad-test-emails.csv` - Malformed emails for testing Stage 3 sanitization

### Test Coverage

**87 tests covering**:
- Comprehensive email format validation with status codes
- Domain extraction with edge cases
- MX record checking with detailed error states
- DNS timeout protection
- CSV processing with input sanitization
- File size validation and protection
- Security headers verification
- Input sanitization (dangerous character removal)
- Malformed email detection and counting
- Stripe Payment Intent creation (integrated embedded payment form)
- Stripe Checkout session creation (legacy tests, not used in production)
- Stripe transaction simulation (success and failure scenarios)
- Stripe payment error handling (card declined, insufficient funds, etc.)

### Stripe Testing

For detailed information on testing Stripe payment integration, including test card numbers and transaction simulation, see **[STRIPE_TESTING.md](STRIPE_TESTING.md)**.

### Writing Tests

- Tests use Jest framework
- Mock DNS lookups for MX record validation
- Mock Stripe API calls for payment testing
- Test files should end with `.test.js`
- Follow existing test patterns in `__tests__/api/`
- Use test helpers from `__tests__/helpers/` for common test utilities

## API Endpoint

### POST `/api/validate-csv`

**Request:**
- Content-Type: `multipart/form-data`
- Body: CSV file with email addresses

**Success Response:**
```json
{
  "total": 100,
  "valid": 87,
  "invalid": 13,
  "percentage": 87.0,
  "skipped": 0,
  "emails": [
    {
      "email": "valid@example.com",
      "status": "Success",
      "valid": true
    },
    {
      "email": "invalid.email",
      "status": "AtSignNotFound",
      "valid": false
    }
  ]
}
```

**Response Fields:**
- `total`: Total number of emails processed (valid + invalid)
- `valid`: Number of emails that passed validation
- `invalid`: Number of emails that failed validation
- `percentage`: Percentage of valid emails (valid/total × 100)
- `skipped`: Number of emails skipped (always 0 - duplicates/empty lines removed during parsing)
- `emails`: Array of individual email results with detailed status codes

**Error Responses:**
- `400`: Invalid file format or no emails found
- `400`: File contains more than 300 emails (entire request rejected)
- `413`: File exceeds 5MB size limit
- `405`: Method not allowed (only POST and OPTIONS are supported)
- `500`: Server error

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)
- Mobile browsers (iOS Safari, Chrome Mobile)

## Performance

- **File Size**: ~15KB (gzipped)
- **Load Time**: < 1s on 3G
- **Validation Time**: 30-60 seconds for 300 emails
- **No Dependencies**: Uses CDN for Tailwind CSS

## 🛡️ Security Features

This application implements comprehensive security protections following industry best practices:

### 1. File Size Protection
- **Maximum upload size**: 5MB
- **Protection**: Prevents memory exhaustion attacks
- **Behavior**: Returns HTTP 413 status for oversized files with clear error message
- **Implementation**: Real-time file size tracking during upload

### 2. DNS Timeout Protection
- **Timeout duration**: 5 seconds per DNS lookup
- **Protection**: Prevents hanging requests from unresponsive DNS servers
- **Behavior**: Timeouts treated as validation failures, not errors
- **Implementation**: Promise.race pattern for non-blocking concurrent lookups

### 3. Input Sanitization
- **Dangerous characters removed**: `<`, `>`, `"`, `'`, `;`, `\`, newlines, tabs
- **Protection**: Prevents injection attacks and handles malformed emails
- **Behavior**: All emails counted (valid + invalid = total processed)
- **Implementation**: 
  - Sanitization before validation
  - Safe domain extraction with null checks
  - Malformed emails counted as invalid, not skipped

### 4. Rate Limiting
- **Limit**: 10 requests per minute per IP address
- **Protection**: Prevents denial-of-service (DoS) attacks
- **Behavior**: HTTP 429 status returned when limit exceeded
- **Implementation**: In-memory rate tracking with automatic reset

### 5. Security Headers
Comprehensive HTTP security headers on all API responses:
- **X-Content-Type-Options**: `nosniff` - Prevents MIME sniffing attacks
- **X-Frame-Options**: `DENY` - Prevents clickjacking via iframe embedding
- **X-XSS-Protection**: `1; mode=block` - Enables browser XSS filter
- **Referrer-Policy**: `strict-origin-when-cross-origin` - Protects user privacy
- **Content-Security-Policy**: `default-src 'none'; frame-ancestors 'none'` - Blocks unauthorized content loading

## 📊 Analytics & Monitoring

### Vercel Analytics Integration

This application uses [Vercel Analytics](https://vercel.com/docs/analytics) to track:

**User Events**:
- ✅ **Validation Success**: Tracks successful email validations with metrics
  - Total emails processed
  - Valid email count
  - Invalid email count
  - Success percentage
- ❌ **Validation Error**: Tracks validation failures with error messages
  - Error type and message
  - Helps identify common issues

**Benefits**:
- Real-time performance monitoring
- User engagement insights
- Error detection and debugging
- Privacy-focused (no PII tracked)

### Data Privacy

- **No email storage**: Email addresses are never stored or logged
- **Ephemeral processing**: All data deleted after validation completes
- **Anonymous analytics**: Only aggregated, anonymized metrics tracked
- **GDPR compliant**: No personal data retention

## 🎨 UX Features

### Real-time Feedback
- Live email count during validation
- Detailed results breakdown (valid/invalid/total)
- Clear error messages with recovery options
- Smooth transitions between states

### Responsive Design
- Mobile-first approach
- Drag-and-drop file upload
- Touch-friendly interactions
- Adaptive layouts for all screen sizes

## Limitations

- Maximum 300 unique emails per upload (after duplicates removed)
- MX validation only (does not verify mailbox existence)
- Synchronous processing (no background jobs)
- No authentication required (public tool)
- No data storage (privacy-focused)

## SEO Features

- Comprehensive meta tags (title, description, keywords)
- Open Graph tags for social sharing
- Twitter Card tags
- Schema.org structured data (WebApplication, Organization, BreadcrumbList)
- Canonical URL
- Mobile-optimized

## Accessibility

- ARIA labels and roles
- Keyboard navigation support
- Focus management
- Screen reader compatible
- High contrast colors
- Visible focus indicators

## Social Links

- GitHub: [github.com/pattens-tech](https://github.com/pattens-tech)
- X (Twitter): [x.com/pattens-tech](https://x.com/pattens-tech)

## License

MIT License - feel free to use this project for any purpose

## Author

**PATTENS**
- GitHub: [@pattens-tech](https://github.com/pattens-tech)
- X: [@pattens-tech](https://x.com/pattens-tech)

## Contributing

Contributions are welcome! Feel free to:
- Report bugs
- Suggest features
- Submit pull requests

## Acknowledgments

- Animated gradient background inspired by modern design trends
- Built with accessibility and performance in mind
- Optimized for SEO and social sharing
