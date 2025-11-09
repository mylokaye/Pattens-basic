/**
 * Integration test for the payment flow with validation data
 * Tests that email validation results can be successfully used to create a payment intent
 */

// Mock Stripe before requiring handlers
const mockCreatePaymentIntent = jest.fn();
jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    paymentIntents: {
      create: mockCreatePaymentIntent
    }
  }));
});

// Mock DNS for validation
jest.mock('dns', () => ({
  promises: {
    resolveMx: jest.fn()
  }
}));

const dns = require('dns').promises;
const validateCsvHandler = require('../../api/validate-csv');
const createPaymentIntentHandler = require('../../api/create-payment-intent');

describe('Payment Flow Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreatePaymentIntent.mockClear();
  });

  // Helper to create mock request
  const createMockRequest = (method, body = {}, headers = {}) => ({
    method,
    body,
    headers: {
      'content-type': 'application/json',
      ...headers
    }
  });

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

  test('should accept validation results with detailed status codes for payment', async () => {
    // Simulate validation results from validate-csv API
    // These have detailed status codes like 'Success', 'AtSignNotFound', etc.
    const validationResults = [
      { email: 'valid1@example.com', status: 'Success', valid: true },
      { email: 'valid2@example.com', status: 'Success', valid: true },
      { email: 'invalid@', status: 'AtSignNotFound', valid: false },
      { email: 'bad@nodomain', status: 'DomainDoesNotExist', valid: false }
    ];

    // Transform the data as the frontend would (mapping to 'Valid'/'Invalid')
    const transformedEmails = validationResults.map(item => ({
      email: item.email,
      status: item.valid ? 'Valid' : 'Invalid'
    }));

    const req = createMockRequest('POST', { emails: transformedEmails });
    const res = createMockResponse();

    mockCreatePaymentIntent.mockResolvedValue({
      id: 'pi_test_123',
      client_secret: 'pi_test_123_secret_abc'
    });

    await createPaymentIntentHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.clientSecret).toBeDefined();
    expect(mockCreatePaymentIntent).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 999,
        currency: 'gbp',
        metadata: expect.objectContaining({
          emailCount: '4' // All 4 emails should be accepted
        })
      })
    );
  });

  test('should reject untransformed validation results with detailed status codes', async () => {
    // Simulate what happens if frontend sends raw validation results
    // These have detailed status codes that payment API doesn't recognize
    const rawValidationResults = [
      { email: 'valid1@example.com', status: 'Success', valid: true },
      { email: 'invalid@', status: 'AtSignNotFound', valid: false }
    ];

    const req = createMockRequest('POST', { emails: rawValidationResults });
    const res = createMockResponse();

    await createPaymentIntentHandler(req, res);

    // Should fail because status codes don't match 'Valid' or 'Invalid'
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('No valid email data provided');
  });

  test('should handle mixed valid and invalid emails correctly', async () => {
    const transformedEmails = [
      { email: 'test1@example.com', status: 'Valid' },
      { email: 'test2@example.com', status: 'Invalid' },
      { email: 'test3@example.com', status: 'Valid' },
      { email: 'test4@example.com', status: 'Invalid' }
    ];

    const req = createMockRequest('POST', { emails: transformedEmails });
    const res = createMockResponse();

    mockCreatePaymentIntent.mockResolvedValue({
      id: 'pi_test_456',
      client_secret: 'pi_test_456_secret_xyz'
    });

    await createPaymentIntentHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(mockCreatePaymentIntent).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          emailCount: '4'
        })
      })
    );
  });

  test('should verify the complete flow from validation to payment', async () => {
    // This test verifies that:
    // 1. validate-csv returns emails with detailed status codes
    // 2. Frontend transforms them to 'Valid'/'Invalid'
    // 3. create-payment-intent accepts the transformed data

    // Step 1: Validate emails (simulated - we're checking the data structure)
    const mockValidationResponse = {
      total: 10,
      valid: 7,
      invalid: 3,
      percentage: 70,
      skipped: 0,
      emails: [
        { email: 'user1@domain.com', status: 'Success', valid: true },
        { email: 'user2@domain.com', status: 'Success', valid: true },
        { email: 'user3@', status: 'AtSignNotFound', valid: false }
      ]
    };

    // Step 2: Transform emails as frontend would do
    const transformedForPayment = mockValidationResponse.emails.map(item => ({
      email: item.email,
      status: item.valid ? 'Valid' : 'Invalid'
    }));

    // Step 3: Create payment intent with transformed data
    const req = createMockRequest('POST', { emails: transformedForPayment });
    const res = createMockResponse();

    mockCreatePaymentIntent.mockResolvedValue({
      id: 'pi_test_789',
      client_secret: 'pi_test_789_secret_complete'
    });

    await createPaymentIntentHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.clientSecret).toBe('pi_test_789_secret_complete');
    expect(mockCreatePaymentIntent).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          emailCount: '3'
        })
      })
    );
  });
});
