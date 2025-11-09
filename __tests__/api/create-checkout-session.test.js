// Mock Stripe before requiring the handler
const mockCreateSession = jest.fn();
jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    checkout: {
      sessions: {
        create: mockCreateSession
      }
    }
  }));
});

const handler = require('../../api/create-checkout-session');

// Import Stripe test helpers
const {
  createTestEmailData,
  TEST_PRICE_AMOUNTS
} = require('../helpers/stripe-test-helpers');

// Test constants
const TEST_ORIGIN = 'https://email-validator.pattens.tech';

describe('Create Checkout Session API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateSession.mockClear();
  });

  // Helper to create mock request
  const createMockRequest = (method, body = {}, headers = {}) => ({
    method,
    body,
    headers: {
      origin: TEST_ORIGIN,
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

  describe('HTTP Methods', () => {
    test('should handle OPTIONS request', async () => {
      const req = createMockRequest('OPTIONS');
      const res = createMockResponse();

      await handler(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.end).toHaveBeenCalled();
    });

    test('should reject GET request', async () => {
      const req = createMockRequest('GET');
      const res = createMockResponse();

      await handler(req, res);

      expect(res.statusCode).toBe(405);
      expect(res.body.error).toBe('Method not allowed');
    });

    test('should accept POST request', async () => {
      const emails = [
        { email: 'test@example.com', status: 'Valid' },
        { email: 'invalid@test.com', status: 'Invalid' }
      ];
      
      const req = createMockRequest('POST', { emails });
      const res = createMockResponse();

      mockCreateSession.mockResolvedValue({
        id: 'cs_test_123',
        url: 'https://checkout.stripe.com/test'
      });

      await handler(req, res);

      expect(mockCreateSession).toHaveBeenCalled();
      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('sessionId');
      expect(res.body).toHaveProperty('url');
    });
  });

  describe('Request Validation', () => {
    test('should reject request without emails', async () => {
      const req = createMockRequest('POST', {});
      const res = createMockResponse();

      await handler(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toBe('Invalid email data');
    });

    test('should reject request with empty emails array', async () => {
      const req = createMockRequest('POST', { emails: [] });
      const res = createMockResponse();

      await handler(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toBe('Invalid email data');
    });

    test('should reject request with non-array emails', async () => {
      const req = createMockRequest('POST', { emails: 'not an array' });
      const res = createMockResponse();

      await handler(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toBe('Invalid email data');
    });
  });

  describe('Email Data Sanitization', () => {
    test('should accept valid email data', async () => {
      const emails = [
        { email: 'test@example.com', status: 'Valid' },
        { email: 'test2@example.com', status: 'Invalid' }
      ];
      
      const req = createMockRequest('POST', { emails });
      const res = createMockResponse();

      mockCreateSession.mockResolvedValue({
        id: 'cs_test_123',
        url: 'https://checkout.stripe.com/test'
      });

      await handler(req, res);

      expect(res.statusCode).toBe(200);
      expect(mockCreateSession).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            emailCount: '2'
          })
        })
      );
    });

    test('should filter out invalid email objects', async () => {
      const emails = [
        { email: 'test@example.com', status: 'Valid' },
        { invalid: 'object' }, // Invalid structure
        { email: '', status: 'Valid' }, // Empty email
        { email: 'test2@example.com', status: 'WrongStatus' }, // Invalid status
        { email: 'test3@example.com', status: 'Invalid' }
      ];
      
      const req = createMockRequest('POST', { emails });
      const res = createMockResponse();

      mockCreateSession.mockResolvedValue({
        id: 'cs_test_123',
        url: 'https://checkout.stripe.com/test'
      });

      await handler(req, res);

      expect(res.statusCode).toBe(200);
      // Should only accept 2 valid entries (first and last)
      expect(mockCreateSession).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            emailCount: '2'
          })
        })
      );
    });

    test('should reject if all emails are invalid after sanitization', async () => {
      const emails = [
        { invalid: 'object' },
        { email: '', status: 'Valid' }
      ];
      
      const req = createMockRequest('POST', { emails });
      const res = createMockResponse();

      await handler(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toBe('No valid email data provided');
    });
  });

  describe('Security Headers', () => {
    test('should include security headers in response', async () => {
      const req = createMockRequest('OPTIONS');
      const res = createMockResponse();

      await handler(req, res);

      expect(res.headers['X-Content-Type-Options']).toBe('nosniff');
      expect(res.headers['X-Frame-Options']).toBe('DENY');
      expect(res.headers['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
    });

    test('should include CORS headers', async () => {
      const req = createMockRequest('OPTIONS');
      const res = createMockResponse();

      await handler(req, res);

      expect(res.headers['Access-Control-Allow-Origin']).toBe(TEST_ORIGIN);
      expect(res.headers['Access-Control-Allow-Methods']).toBe('POST, OPTIONS');
      expect(res.headers['Access-Control-Allow-Headers']).toBe('Content-Type');
    });
  });

  describe('Stripe Integration', () => {
    test('should create checkout session with correct parameters', async () => {
      const emails = [
        { email: 'test@example.com', status: 'Valid' }
      ];
      
      const req = createMockRequest('POST', { emails });
      const res = createMockResponse();

      mockCreateSession.mockResolvedValue({
        id: 'cs_test_123',
        url: 'https://checkout.stripe.com/test'
      });

      await handler(req, res);

      expect(mockCreateSession).toHaveBeenCalledWith(
        expect.objectContaining({
          payment_method_types: ['card'],
          mode: 'payment',
          line_items: expect.arrayContaining([
            expect.objectContaining({
              price_data: expect.objectContaining({
                currency: 'gbp',
                unit_amount: 999
              })
            })
          ])
        })
      );
    });

    test('should handle Stripe errors gracefully', async () => {
      const emails = [
        { email: 'test@example.com', status: 'Valid' }
      ];
      
      const req = createMockRequest('POST', { emails });
      const res = createMockResponse();

      mockCreateSession.mockRejectedValue(
        new Error('Stripe API error')
      );

      await handler(req, res);

      expect(res.statusCode).toBe(500);
      expect(res.body.error).toContain('error');
    });
  });
});
