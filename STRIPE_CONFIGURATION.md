# Stripe Configuration Guide

## Overview
This document describes the Stripe configuration for the Email Validator application, which uses **Stripe Payment Intents** with an integrated, embedded payment form.

## Configuration Summary

### ✅ Stripe Keys Configured

**Backend API (Server-side)**
- **Location**: `api/create-payment-intent.js`
- **Configuration**: Uses environment variable `STRIPE_SECRET_KEY`
- **Key Format**: `sk_test_XXXXXXXXXX...` (stored in Vercel environment variables)
- **Approach**: Payment Intents API (integrated, embedded payment form)

**Frontend (Client-side)**
- **Location**: `index.html` (line 790)
- **Configuration**: Publishable key (safe for client-side)
- **Key Format**: `pk_test_XXXXXXXXXX...` (can be publicly visible)
- **Integration**: Stripe Elements with custom styling matching the Email Validator theme

## Environment Variables

### Vercel Deployment

The application uses the following environment variable in Vercel:

```
STRIPE_SECRET_KEY=sk_test_YOUR_SECRET_KEY_HERE
```

**Note**: The actual secret key is stored securely in Vercel and should never be committed to source control.

### Setting Environment Variables in Vercel

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add the variable:
   - **Name**: `STRIPE_SECRET_KEY`
   - **Value**: Your Stripe secret key from the Stripe Dashboard
   - **Environment**: Production, Preview, Development (all)
4. Click **Save**
5. Redeploy your application for changes to take effect

## Integration Approach

### Integrated Payment Form (Payment Intents)

The application uses **Stripe Payment Intents** with **Stripe Elements** to provide a seamless, integrated payment experience:

✅ **Benefits**:
- Payment form embedded directly in the application
- No redirect to external Stripe pages
- Consistent styling matching the Email Validator theme
- Better user experience with modal-based workflow
- Custom branding and design control

❌ **Alternative NOT Used**: Stripe Checkout Sessions (redirect-based approach)

## API Endpoint Details

### `/api/create-payment-intent`

**Purpose**: Creates a Stripe Payment Intent for purchasing email validation reports with embedded payment form

**Method**: POST

**Request Body**:
```json
{
  "emails": [
    { "email": "test@example.com", "status": "Valid" },
    { "email": "invalid@test.com", "status": "Invalid" }
  ]
}
```

**Response** (Success - 200):
```json
{
  "clientSecret": "pi_xxx_secret_xxx"
}
```

**Response** (Error - 400):
```json
{
  "error": "Invalid email data"
}
```

**Response** (Error - 500):
```json
{
  "error": "Error creating payment intent. Please try again."
}
```

## Stripe Product Configuration

- **Product Name**: Full Report Access
- **Price**: £9.99 (999 pence)
- **Currency**: GBP (British Pounds)
- **Payment Methods**: Card (via Stripe Elements)
- **Mode**: Payment Intent (one-time payment)
- **Integration**: Embedded payment form with custom styling

## Payment Flow

1. User uploads and validates CSV file
2. Results displayed with summary (percentage, counts)
3. User clicks "Unlock Full Report - £9.99"
4. **Payment modal opens** (no redirect)
5. Payment Intent created via `/api/create-payment-intent`
6. Stripe Elements form rendered with custom theme
7. User enters card details in embedded form
8. Payment processed within the application
9. Success message displayed in modal
10. User clicks "View Full Report" to see detailed results
11. Full report with all emails and CSV download unlocked

## Security Features

### Headers
All API responses include:
- `Access-Control-Allow-Origin: *`
- `Access-Control-Allow-Methods: POST, OPTIONS`
- `Access-Control-Allow-Headers: Content-Type`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`

### Input Validation
- Validates email data structure
- Sanitizes email objects
- Filters out invalid entries
- Requires non-empty arrays

### Supported Methods
- `POST`: Create payment intent
- `OPTIONS`: CORS preflight

## Stripe Elements Styling

The payment form is styled to match the Email Validator's dark theme:

```javascript
const appearance = {
    theme: 'night',
    variables: {
        colorPrimary: '#3b82f6',      // Blue accent
        colorBackground: '#0f172a',   // Dark slate background
        colorText: '#e2e8f0',         // Light text
        colorDanger: '#ef4444',       // Red for errors
        fontFamily: 'system-ui, sans-serif',
        spacingUnit: '4px',
        borderRadius: '8px',
    },
    rules: {
        '.Input': {
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
        },
        '.Input:focus': {
            border: '1px solid #3b82f6',
            boxShadow: '0 0 0 1px #3b82f6',
        },
    }
};
```

## Testing

All Stripe integration tests are passing:

```bash
npm test -- __tests__/api/create-payment-intent.test.js
```

**Test Coverage**:
- HTTP method validation (OPTIONS, GET, POST)
- Request validation
- Email data sanitization
- Security headers
- Stripe Payment Intent API integration
- Error handling
- Card error handling

## Local Development

For local development:

1. Create a `.env.local` file in the project root (not committed to git)
2. Add your Stripe secret key:
   ```
   STRIPE_SECRET_KEY=sk_test_YOUR_SECRET_KEY_HERE
   ```
3. Run with `vercel dev` to test locally

```bash
npm install
vercel dev
```

**Note**: The `.env.local` file is gitignored and should never be committed to source control.

## Production Checklist

- [x] Stripe publishable key configured in `index.html`
- [x] Stripe secret key environment variable set in Vercel
- [x] Payment Intent API endpoint implemented and tested
- [x] Stripe Elements integration with custom styling
- [x] Payment modal embedded in application (no redirect)
- [x] Security headers configured
- [x] Error handling implemented
- [x] CORS configured for cross-origin requests
- [x] All tests passing
- [x] Payment flow matches Email Validator UI/UX

## Key Validation

To verify your Stripe configuration:
1. Both keys should share the same account ID prefix
2. Publishable key should start with `pk_test_` (test mode) or `pk_live_` (production)
3. Secret key should start with `sk_test_` (test mode) or `sk_live_` (production)
4. Both keys must be from the same Stripe account

## Switching to Production

When ready for production:

1. Obtain production keys from Stripe dashboard:
   - Production publishable key (starts with `pk_live_`)
   - Production secret key (starts with `sk_live_`)

2. Update frontend (`index.html`, line 790):
   ```javascript
   const stripe = Stripe('pk_live_YOUR_PRODUCTION_KEY');
   ```

3. Update Vercel environment variable:
   ```
   STRIPE_SECRET_KEY=sk_live_YOUR_PRODUCTION_SECRET_KEY
   ```

4. Test the payment flow thoroughly in production mode
5. Verify Stripe Elements styling still matches the theme
6. Redeploy application

## Migration Notes

### Previous Implementation (Deprecated)

The application previously had a `create-checkout-session.js` endpoint that used Stripe Checkout (redirect-based approach). This has been replaced with the integrated Payment Intent approach for better UX.

**Old approach**: Redirect users to Stripe's hosted checkout page
**New approach**: Embedded payment form within the application modal

The old endpoint and tests are kept for reference but are not used in production.

## Support

For Stripe-related issues:
- Stripe Dashboard: https://dashboard.stripe.com
- Stripe Documentation: https://stripe.com/docs
- Test Mode: Currently using test keys (no real charges)
