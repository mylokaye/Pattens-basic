# Stripe Integration Guide - Embedded Payment Flow

This guide explains how Stripe is integrated into the Email Validator application using the **Payment Intents API** with **Stripe Elements** for a seamless, integrated payment experience.

## Architecture Overview

### Integration Approach: Payment Intents with Stripe Elements

The application uses a **fully integrated** payment solution where:
- ✅ Payment form is **embedded** within the application
- ✅ Users **never leave** the Email Validator interface
- ✅ Custom **dark theme styling** matches the application design
- ✅ **Modal-based** workflow for smooth UX
- ✅ Full control over **branding and design**

### Why This Approach?

| Feature | Payment Intents (✅ Used) | Checkout Sessions (❌ Not Used) |
|---------|-------------------------|--------------------------------|
| User Experience | Seamless, no redirect | Redirects to Stripe page |
| Styling | Full customization | Limited customization |
| Branding | App branding throughout | Stripe branding |
| UI Integration | Embedded modal | External page |
| User Flow | Uninterrupted | Breaks flow with redirect |
| Design Control | Complete control | Limited control |

## Payment Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│  1. User Uploads CSV → Email Validation                     │
│                                                              │
│     [Upload CSV] → [Validate] → [Show Results Summary]      │
│                                                              │
│     Results: 87% valid (87 valid, 13 invalid, 100 total)   │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  2. User Clicks "Unlock Full Report - £9.99"               │
│                                                              │
│     [Button] → Opens Payment Modal (no page navigation)     │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  3. Payment Modal Opens - Loading State                     │
│                                                              │
│     ╔════════════════════════════════════════╗              │
│     ║  Unlock Full Report               [×]  ║              │
│     ╠════════════════════════════════════════╣              │
│     ║  Full Report Access        £9.99       ║              │
│     ║  ⟳ Preparing checkout...              ║              │
│     ╚════════════════════════════════════════╝              │
│                                                              │
│     Frontend calls: /api/create-payment-intent              │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  4. Backend Creates Payment Intent                          │
│                                                              │
│     Server: api/create-payment-intent.js                    │
│     ├─ Validates email data                                 │
│     ├─ Sanitizes email list (max 300)                       │
│     ├─ Creates Stripe Payment Intent (£9.99)               │
│     └─ Returns clientSecret                                 │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  5. Stripe Elements Form Renders (Embedded)                 │
│                                                              │
│     ╔════════════════════════════════════════╗              │
│     ║  Unlock Full Report               [×]  ║              │
│     ╠════════════════════════════════════════╣              │
│     ║  Full Report Access        £9.99       ║              │
│     ║                                        ║              │
│     ║  ┌──────────────────────────────────┐ ║              │
│     ║  │ Card Number                      │ ║              │
│     ║  │ •••• •••• •••• ••••             │ ║              │
│     ║  └──────────────────────────────────┘ ║              │
│     ║  ┌──────────┐  ┌───────────────────┐ ║              │
│     ║  │ MM / YY  │  │ CVC               │ ║              │
│     ║  └──────────┘  └───────────────────┘ ║              │
│     ║  ┌──────────────────────────────────┐ ║              │
│     ║  │ ZIP Code                         │ ║              │
│     ║  └──────────────────────────────────┘ ║              │
│     ║                                        ║              │
│     ║      [Pay £9.99]                       ║              │
│     ║  Secure payment powered by Stripe      ║              │
│     ╚════════════════════════════════════════╝              │
│                                                              │
│     Form styled with dark theme matching app colors         │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  6. User Submits Payment                                     │
│                                                              │
│     [Pay £9.99] → Stripe.confirmPayment()                   │
│     ├─ Validates card with Stripe                           │
│     ├─ Processes payment (no redirect)                      │
│     └─ Returns payment status                               │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  7a. Success - Payment Confirmed                            │
│                                                              │
│     ╔════════════════════════════════════════╗              │
│     ║  Unlock Full Report               [×]  ║              │
│     ╠════════════════════════════════════════╣              │
│     ║         ✓                              ║              │
│     ║   Payment Successful!                  ║              │
│     ║   Your full report is now available.   ║              │
│     ║                                        ║              │
│     ║      [View Full Report]                ║              │
│     ╚════════════════════════════════════════╝              │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  8. Full Report Unlocked                                     │
│                                                              │
│     ╔════════════════════════════════════════╗              │
│     ║  Full Report                           ║              │
│     ║  100 emails analyzed                   ║              │
│     ║                                        ║              │
│     ║  ┌──────────────────────────────────┐ ║              │
│     ║  │ user@example.com      [Valid]    │ ║              │
│     ║  │ invalid.email    [Invalid]       │ ║              │
│     ║  │ test@domain.com       [Valid]    │ ║              │
│     ║  │ ...                              │ ║              │
│     ║  └──────────────────────────────────┘ ║              │
│     ║                                        ║              │
│     ║  [Download CSV]  [Validate Another]   ║              │
│     ╚════════════════════════════════════════╝              │
└─────────────────────────────────────────────────────────────┘

                    OR (if payment fails)

┌─────────────────────────────────────────────────────────────┐
│  7b. Error - Payment Declined                               │
│                                                              │
│     ╔════════════════════════════════════════╗              │
│     ║  Unlock Full Report               [×]  ║              │
│     ╠════════════════════════════════════════╣              │
│     ║  Full Report Access        £9.99       ║              │
│     ║                                        ║              │
│     ║  [Payment Form]                        ║              │
│     ║                                        ║              │
│     ║  ⚠ Your card was declined             ║              │
│     ║                                        ║              │
│     ║      [Pay £9.99]                       ║              │
│     ╚════════════════════════════════════════╝              │
│                                                              │
│     User can retry with different card                      │
└─────────────────────────────────────────────────────────────┘
```

## Technical Implementation

### Frontend: Stripe Elements Integration

**File**: `index.html` (lines 788-1150)

```javascript
// 1. Initialize Stripe with publishable key
const stripe = Stripe('pk_test_...');

// 2. When payment modal opens, create Payment Intent
async function openPaymentModal() {
    const response = await fetch('/api/create-payment-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emails })
    });
    
    const { clientSecret } = await response.json();
    
    // 3. Initialize Stripe Elements with custom styling
    const appearance = {
        theme: 'night',
        variables: {
            colorPrimary: '#3b82f6',
            colorBackground: '#0f172a',
            colorText: '#e2e8f0',
            // ... more styling
        }
    };
    
    elements = stripe.elements({ clientSecret, appearance });
    paymentElement = elements.create('payment');
    paymentElement.mount('#paymentElement');
}

// 4. Handle payment submission
async function handleSubmit(e) {
    e.preventDefault();
    
    const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
            return_url: window.location.origin + '/?payment=success',
        },
        redirect: 'if_required', // Stay on page if possible
    });
    
    if (paymentIntent && paymentIntent.status === 'succeeded') {
        // Show success message
        showPaymentSuccess();
    } else if (error) {
        // Show error message
        displayError(error.message);
    }
}
```

### Backend: Payment Intent API

**File**: `api/create-payment-intent.js`

```javascript
const Stripe = require('stripe');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

module.exports = async (req, res) => {
    // 1. Set security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    // ... more headers
    
    // 2. Validate and sanitize email data
    const { emails } = req.body;
    const sanitizedEmails = sanitizeEmailData(emails);
    
    // 3. Create Payment Intent
    const paymentIntent = await stripe.paymentIntents.create({
        amount: 999, // £9.99 in pence
        currency: 'gbp',
        payment_method_types: ['card'],
        metadata: {
            emails: JSON.stringify(sanitizedEmails),
            emailCount: sanitizedEmails.length.toString(),
        },
    });
    
    // 4. Return client secret
    return res.status(200).json({ 
        clientSecret: paymentIntent.client_secret
    });
};
```

## Styling Customization

The payment form uses custom Stripe Elements styling to match the Email Validator's dark theme:

### Color Scheme

```css
Dark Background:  #0f172a (slate-950)
Light Text:       #e2e8f0 (slate-200)
Primary Blue:     #3b82f6 (blue-500)
Purple Accent:    #a855f7 (purple-500)
Error Red:        #ef4444 (red-500)
Success Green:    #10b981 (emerald-500)
```

### Modal Styling

```css
Modal Background: linear-gradient(135deg, rgb(15 23 42) 0%, rgb(30 41 59) 100%)
Border:           border-white/10
Backdrop:         bg-black/85 backdrop-blur
Border Radius:    rounded-2xl (16px)
```

### Button Styling

```css
Primary Button:   bg-gradient-to-r from-blue-500 to-purple-600
Hover State:      hover:from-blue-600 hover:to-purple-700
Text:             text-white font-semibold
Padding:          px-6 py-3
Border Radius:    rounded-lg (8px)
```

## Security Features

### Input Validation

1. **Email Data Validation**
   - Checks for array type
   - Validates email format
   - Sanitizes dangerous characters
   - Limits to 300 emails

2. **Metadata Size Check**
   - Maximum 500KB per metadata key (Stripe limit)
   - Rejects requests exceeding limit

### Security Headers

All API responses include:
```javascript
'X-Content-Type-Options': 'nosniff'
'X-Frame-Options': 'DENY'
'Referrer-Policy': 'strict-origin-when-cross-origin'
'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'"
'Access-Control-Allow-Origin': '*'
'Access-Control-Allow-Methods': 'POST, OPTIONS'
'Access-Control-Allow-Headers': 'Content-Type'
```

### PCI Compliance

- ✅ Card data **never touches** our servers
- ✅ All card processing handled by **Stripe Elements**
- ✅ PCI DSS compliance through **Stripe**
- ✅ Secure HTTPS communication
- ✅ Client-side validation before submission

## Error Handling

### Payment Errors

The integration handles various payment scenarios:

| Error Type | Code | Display |
|-----------|------|---------|
| Card Declined | `card_declined` | Red alert box: "Your card was declined" |
| Insufficient Funds | `insufficient_funds` | Red alert box: "Your card has insufficient funds" |
| Expired Card | `expired_card` | Red alert box: "Your card has expired" |
| Invalid CVC | `incorrect_cvc` | Red alert box: "Your card's security code is incorrect" |
| Processing Error | `processing_error` | Red alert box: "An error occurred processing your card" |

### UI States

1. **Loading**: Spinner with "Preparing checkout..."
2. **Form Ready**: Stripe Elements form displayed
3. **Processing**: Button disabled, spinner shown
4. **Success**: Green checkmark, "Payment Successful!"
5. **Error**: Red alert with specific error message

## Testing

### Test Cards (Stripe Test Mode)

Use these test cards to simulate different scenarios:

| Scenario | Card Number | Expected Result |
|----------|-------------|-----------------|
| ✅ Success | `4242 4242 4242 4242` | Payment succeeds |
| ❌ Declined | `4000 0000 0000 0002` | Generic decline error |
| 💰 Insufficient Funds | `4000 0000 0000 9995` | Insufficient funds error |
| ⏱️ Expired | `4000 0000 0000 0069` | Expired card error |
| 🔢 Wrong CVC | `4000 0000 0000 0127` | CVC check fails |

**Note**: Use any future expiry date (e.g., `12/34`), any CVC (e.g., `123`), and any ZIP code (e.g., `12345`).

## Comparison: Old vs New Approach

### Old Approach: Checkout Sessions (Not Used)

```
User Flow:
1. User clicks "Pay"
2. Redirect to checkout.stripe.com
3. User sees Stripe-branded page
4. User enters card on Stripe's site
5. User redirected back to app
6. App checks session status
```

**Problems**:
- ❌ Breaks user flow with redirect
- ❌ Stripe branding, not app branding
- ❌ Limited customization options
- ❌ Worse user experience
- ❌ Potential redirect issues

### New Approach: Payment Intents (Current)

```
User Flow:
1. User clicks "Unlock Full Report"
2. Modal opens (same page)
3. Payment form renders (styled to match app)
4. User enters card in embedded form
5. Payment processes (no redirect)
6. Success message shown in modal
7. Full report unlocked
```

**Benefits**:
- ✅ Seamless user experience
- ✅ Consistent app branding
- ✅ Full control over UI/UX
- ✅ No page redirects
- ✅ Better conversion rates

## File Structure

```
email-validator/
├── index.html                          # Frontend with Stripe Elements
├── api/
│   ├── create-payment-intent.js       # ✅ Active: Payment Intent API
│   └── create-checkout-session.js     # ⚠️ Legacy: Not used in production
├── __tests__/
│   ├── api/
│   │   ├── create-payment-intent.test.js    # Tests for Payment Intent
│   │   └── create-checkout-session.test.js  # Tests for legacy endpoint
│   └── integration/
│       └── stripe-transaction-simulation.test.js
└── docs/
    ├── STRIPE_CONFIGURATION.md        # Configuration guide
    ├── STRIPE_TESTING.md              # Testing guide
    └── INTEGRATION_GUIDE.md           # This file
```

## Environment Variables

### Required

```bash
# Vercel Environment Variables
STRIPE_SECRET_KEY=sk_test_...   # Server-side secret key
```

### Frontend (Public)

```javascript
// In index.html (line 790)
const stripe = Stripe('pk_test_...');  // Client-side publishable key
```

**Security Note**: The publishable key (`pk_test_...`) is safe to expose in client-side code. The secret key (`sk_test_...`) must never be exposed and should only exist in environment variables.

## Monitoring and Analytics

### Vercel Analytics

The application tracks payment events:

```javascript
// Track payment initiation
window.va('track', 'Payment Modal Opened', {
    emailCount: emails.length
});

// Track payment success
window.va('track', 'Payment Success', {
    amount: 9.99
});

// Track payment errors
window.va('track', 'Payment Error', {
    error: error.message
});
```

### Stripe Dashboard

Monitor payments in Stripe Dashboard:
1. Login to [dashboard.stripe.com](https://dashboard.stripe.com)
2. Switch to **Test Mode**
3. Navigate to **Payments** → **All payments**
4. View Payment Intent transactions

## Best Practices

### Do's ✅

- ✅ Use Payment Intents for full control
- ✅ Style Stripe Elements to match your app
- ✅ Handle errors gracefully with clear messages
- ✅ Test with all test cards before production
- ✅ Keep secret keys in environment variables
- ✅ Use HTTPS in production
- ✅ Implement proper loading states
- ✅ Provide clear payment feedback

### Don'ts ❌

- ❌ Don't handle card data directly on your server
- ❌ Don't store card information
- ❌ Don't commit secret keys to version control
- ❌ Don't use Checkout Sessions for embedded payments
- ❌ Don't skip error handling
- ❌ Don't ignore PCI compliance
- ❌ Don't use production keys in test mode

## Support and Resources

### Official Documentation

- [Stripe Payment Intents](https://stripe.com/docs/payments/payment-intents)
- [Stripe Elements](https://stripe.com/docs/elements)
- [Stripe API Reference](https://stripe.com/docs/api)
- [Stripe Testing Guide](https://stripe.com/docs/testing)

### Project Documentation

- [STRIPE_CONFIGURATION.md](STRIPE_CONFIGURATION.md) - Setup and configuration
- [STRIPE_TESTING.md](STRIPE_TESTING.md) - Testing procedures
- [README.md](README.md) - General project overview

## Conclusion

The Email Validator uses a modern, integrated Stripe payment solution that:

- ✅ Provides seamless user experience
- ✅ Maintains consistent branding
- ✅ Offers full UI/UX control
- ✅ Eliminates page redirects
- ✅ Ensures PCI compliance through Stripe
- ✅ Handles errors gracefully
- ✅ Matches the application's design system

This approach delivers a professional, trustworthy payment experience while maintaining the application's visual identity throughout the entire user journey.
