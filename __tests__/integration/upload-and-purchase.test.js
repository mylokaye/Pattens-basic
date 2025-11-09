/**
 * Upload and Purchase Integration Test
 * 
 * This test validates the complete end-to-end flow:
 * 1. Upload a CSV file with test emails
 * 2. Validate the emails using the validate-csv API
 * 3. Create a Stripe checkout session for purchase
 * 4. Verify the checkout session is created successfully
 * 
 * Based on Stripe's testing documentation: https://docs.stripe.com/testing
 */

const fs = require('fs');
const path = require('path');
const {
  STRIPE_TEST_CARDS,
  createTestEmailData,
} = require('../helpers/stripe-test-helpers');

// Mock DNS module for consistent test results
jest.mock('dns', () => ({
  promises: {
    resolveMx: jest.fn()
  }
}));

const dns = require('dns').promises;

// Mock Stripe
const mockCreateSession = jest.fn();
jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    checkout: {
      sessions: {
        create: mockCreateSession,
      }
    }
  }));
});

const validateCsvHandler = require('../../api/validate-csv');
const createCheckoutSessionHandler = require('../../api/create-checkout-session');

// Test constants
const VALID_TEST_DOMAINS = [
  'microsoft.com', 'google.com', 'apple.com', 'amazon.com',
  'salesforce.com', 'oracle.com', 'ibm.com', 'adobe.com',
  'cisco.com', 'netflix.com'
];

describe('Upload and Purchase Integration Test', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateSession.mockClear();
    dns.resolveMx.mockClear();
  });

  // Helper to convert validation results to checkout format
  const convertToCheckoutFormat = (validatedEmails) => {
    return validatedEmails.map(result => ({
      email: result.email,
      status: result.valid ? 'Valid' : 'Invalid'
    }));
  };

  // Helper to create mock request for file upload
  const createFileUploadRequest = (fileContent) => {
    const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
    const body = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="file"; filename="test-emails.csv"',
      'Content-Type: text/csv',
      '',
      fileContent,
      `--${boundary}--`
    ].join('\r\n');

    return {
      method: 'POST',
      headers: {
        'content-type': `multipart/form-data; boundary=${boundary}`
      },
      pipe: jest.fn(function(bb) {
        // Simulate streaming the body to busboy
        process.nextTick(() => {
          bb.write(Buffer.from(body));
          bb.end();
        });
      })
    };
  };

  // Helper to create mock response
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

  // Helper to create mock request for checkout session
  const createCheckoutRequest = (emails) => ({
    method: 'POST',
    headers: {
      origin: 'https://email-validator.pattens.tech'
    },
    body: {
      emails
    }
  });

  test('should successfully upload test-emails.csv and create purchase session', async () => {
    // Step 1: Load the test-emails.csv file from the root folder
    const csvPath = path.join(__dirname, '../../test-emails.csv');
    expect(fs.existsSync(csvPath)).toBe(true);
    
    const csvContent = fs.readFileSync(csvPath, 'utf8');
    expect(csvContent).toBeTruthy();
    expect(csvContent.length).toBeGreaterThan(0);

    // Mock DNS responses - first 10 are real companies (valid MX), rest are fake (invalid)
    dns.resolveMx.mockImplementation((domain) => {
      if (VALID_TEST_DOMAINS.includes(domain)) {
        return Promise.resolve([{ exchange: `mail.${domain}`, priority: 10 }]);
      }
      return Promise.reject({ code: 'ENOTFOUND' });
    });

    // Step 2: Upload and validate the CSV file
    const uploadReq = createFileUploadRequest(csvContent);
    const uploadRes = createMockResponse();

    await validateCsvHandler(uploadReq, uploadRes);

    // Verify the upload was successful
    expect(uploadRes.statusCode).toBe(200);
    expect(uploadRes.body).toBeDefined();
    expect(uploadRes.body.total).toBeGreaterThan(0);
    expect(uploadRes.body.valid).toBeDefined();
    expect(uploadRes.body.invalid).toBeDefined();
    expect(uploadRes.body.percentage).toBeDefined();

    // Verify we got the expected number of emails (20 in test-emails.csv)
    expect(uploadRes.body.total).toBe(20);
    
    // We expect 10 valid (real company domains) and 10 invalid (fake domains)
    expect(uploadRes.body.valid).toBe(10);
    expect(uploadRes.body.invalid).toBe(10);
    expect(uploadRes.body.percentage).toBe(50);

    // Verify security headers are set
    expect(uploadRes.setHeader).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
    expect(uploadRes.setHeader).toHaveBeenCalledWith('X-Frame-Options', 'DENY');

    // Step 3: Create email data for checkout based on validation results
    const validatedEmails = uploadRes.body.emails || [];
    
    // Convert to format expected by checkout session
    const checkoutEmails = convertToCheckoutFormat(validatedEmails);

    expect(checkoutEmails.length).toBeGreaterThan(0);

    // Step 4: Create Stripe checkout session (simulate purchase)
    mockCreateSession.mockResolvedValue({
      id: 'cs_test_successful_purchase',
      url: 'https://checkout.stripe.com/test_success',
      payment_status: 'unpaid',
      status: 'open',
      metadata: {
        emailCount: checkoutEmails.length.toString(),
        validEmails: checkoutEmails.filter(e => e.status === 'Valid').length.toString(),
        invalidEmails: checkoutEmails.filter(e => e.status === 'Invalid').length.toString(),
      }
    });

    const checkoutReq = createCheckoutRequest(checkoutEmails);
    const checkoutRes = createMockResponse();

    await createCheckoutSessionHandler(checkoutReq, checkoutRes);

    // Step 5: Verify the checkout session was created successfully
    expect(checkoutRes.statusCode).toBe(200);
    expect(checkoutRes.body).toBeDefined();
    expect(checkoutRes.body.sessionId).toBe('cs_test_successful_purchase');
    expect(checkoutRes.body.url).toBe('https://checkout.stripe.com/test_success');

    // Verify Stripe session was created with correct parameters
    expect(mockCreateSession).toHaveBeenCalledWith(
      expect.objectContaining({
        payment_method_types: ['card'],
        mode: 'payment',
        line_items: expect.arrayContaining([
          expect.objectContaining({
            price_data: expect.objectContaining({
              currency: 'gbp',
              unit_amount: 999, // £9.99 in pence
            }),
          }),
        ]),
        metadata: expect.objectContaining({
          emailCount: checkoutEmails.length.toString(),
        }),
      })
    );

    // Verify security headers are set on checkout response
    expect(checkoutRes.setHeader).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
    expect(checkoutRes.setHeader).toHaveBeenCalledWith('X-Frame-Options', 'DENY');
  });

  test('should handle upload and successful Visa payment simulation', async () => {
    // Load test CSV
    const csvPath = path.join(__dirname, '../../test-emails.csv');
    const csvContent = fs.readFileSync(csvPath, 'utf8');

    // Mock DNS for all domains as valid for this test
    dns.resolveMx.mockResolvedValue([{ exchange: 'mail.example.com', priority: 10 }]);

    // Upload and validate
    const uploadReq = createFileUploadRequest(csvContent);
    const uploadRes = createMockResponse();
    await validateCsvHandler(uploadReq, uploadRes);

    expect(uploadRes.statusCode).toBe(200);

    // Prepare email data for purchase
    const validatedEmails = uploadRes.body.emails || [];
    const checkoutEmails = convertToCheckoutFormat(validatedEmails);

    // Simulate successful Visa payment using test card from Stripe documentation
    // Card number: 4242 4242 4242 4242 (from https://docs.stripe.com/testing)
    mockCreateSession.mockResolvedValue({
      id: 'cs_test_visa_success',
      url: 'https://checkout.stripe.com/test_visa_payment',
      payment_status: 'unpaid',
      status: 'open',
    });

    const checkoutReq = createCheckoutRequest(checkoutEmails);
    const checkoutRes = createMockResponse();
    await createCheckoutSessionHandler(checkoutReq, checkoutRes);

    // Verify successful checkout session creation
    expect(checkoutRes.statusCode).toBe(200);
    expect(checkoutRes.body.sessionId).toBe('cs_test_visa_success');
    expect(checkoutRes.body.url).toContain('checkout.stripe.com');

    // In manual testing, would use card: 4242 4242 4242 4242
    // This is the test card number from Stripe's testing documentation
    expect(STRIPE_TEST_CARDS.VISA_SUCCESS).toBe('4242424242424242');
  });

  test('should provide clear documentation on test card usage', () => {
    // This test documents the test card numbers that can be used
    // Based on: https://docs.stripe.com/testing
    
    const testCards = {
      visaSuccess: STRIPE_TEST_CARDS.VISA_SUCCESS,
      mastercardSuccess: STRIPE_TEST_CARDS.MASTERCARD_SUCCESS,
      amexSuccess: STRIPE_TEST_CARDS.AMEX_SUCCESS,
      genericDecline: STRIPE_TEST_CARDS.GENERIC_DECLINE,
    };

    // Successful payment cards
    expect(testCards.visaSuccess).toBe('4242424242424242');
    expect(testCards.mastercardSuccess).toBe('5555555555554444');
    expect(testCards.amexSuccess).toBe('378282246310005');
    
    // Declined card
    expect(testCards.genericDecline).toBe('4000000000000002');

    // Document test card details for manual testing:
    // - Card: 4242 4242 4242 4242
    // - Exp: Any future date (e.g., 12/34)
    // - CVC: Any 3 digits (e.g., 123)
    // - ZIP: Any valid format (e.g., 12345)
  });

  test('should verify complete flow matches real-world usage', async () => {
    // This test simulates the exact flow a user would take:
    // 1. User uploads CSV file
    // 2. System validates emails
    // 3. User clicks "Unlock Full Report" / "Purchase"
    // 4. System creates Stripe checkout session
    // 5. User enters payment details (in test mode, uses test card)
    // 6. Payment succeeds
    // 7. User is redirected to success page

    // Load actual test file from repository
    const csvPath = path.join(__dirname, '../../test-emails.csv');
    const csvContent = fs.readFileSync(csvPath, 'utf8');

    // Mock mixed DNS results (some valid, some invalid)
    dns.resolveMx.mockImplementation((domain) => {
      // Simulate that major company domains are valid (use first 4 for this test)
      const validDomains = VALID_TEST_DOMAINS.slice(0, 4);
      if (validDomains.includes(domain)) {
        return Promise.resolve([{ exchange: `mail.${domain}`, priority: 10 }]);
      }
      return Promise.reject({ code: 'ENOTFOUND' });
    });

    // Step 1: Upload CSV
    const uploadReq = createFileUploadRequest(csvContent);
    const uploadRes = createMockResponse();
    await validateCsvHandler(uploadReq, uploadRes);

    expect(uploadRes.statusCode).toBe(200);
    expect(uploadRes.body.total).toBeGreaterThan(0);

    // Step 2: Prepare checkout data
    const validatedEmails = uploadRes.body.emails || [];
    const checkoutEmails = convertToCheckoutFormat(validatedEmails);

    // Step 3: Create checkout session
    mockCreateSession.mockResolvedValue({
      id: 'cs_test_complete_flow',
      url: 'https://checkout.stripe.com/test_complete_flow',
      payment_status: 'unpaid',
      status: 'open',
      success_url: 'https://email-validator.pattens.tech/?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: 'https://email-validator.pattens.tech/',
    });

    const checkoutReq = createCheckoutRequest(checkoutEmails);
    const checkoutRes = createMockResponse();
    await createCheckoutSessionHandler(checkoutReq, checkoutRes);

    // Verify complete flow succeeded
    expect(uploadRes.statusCode).toBe(200);
    expect(checkoutRes.statusCode).toBe(200);
    expect(checkoutRes.body.url).toBeDefined();
    expect(checkoutRes.body.sessionId).toBeDefined();

    // Verify the flow maintains data integrity
    expect(mockCreateSession).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          emailCount: checkoutEmails.length.toString(),
        }),
      })
    );
  });
});
