// Mock Stripe before requiring the handler
const mockCreatePaymentIntent = jest.fn();
jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    paymentIntents: {
      create: mockCreatePaymentIntent
    }
  }));
});

const handler = require('../../api/create-payment-intent');

// Import test helpers
const {
  createTestEmailData
} = require('../helpers/stripe-test-helpers');

// Test constants
const TEST_ORIGIN = 'https://email-validator.pattens.tech';

describe('Create Payment Intent API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreatePaymentIntent.mockClear();
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
      const emails = createTestEmailData(2);
      
      const req = createMockRequest('POST', { emails });
      const res = createMockResponse();

      mockCreatePaymentIntent.mockResolvedValue({
        id: 'pi_test_123',
        client_secret: 'pi_test_123_secret_abc'
      });

      await handler(req, res);

      expect(mockCreatePaymentIntent).toHaveBeenCalled();
      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('clientSecret');
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

  describe('Payment Intent Creation', () => {
    test('should create payment intent with correct parameters', async () => {
      const emails = createTestEmailData(5);
      
      const req = createMockRequest('POST', { emails });
      const res = createMockResponse();

      mockCreatePaymentIntent.mockResolvedValue({
        id: 'pi_test_123',
        client_secret: 'pi_test_123_secret_abc'
      });

      await handler(req, res);

      expect(mockCreatePaymentIntent).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 999, // £9.99 in pence
          currency: 'gbp',
          payment_method_types: ['card'],
          metadata: expect.objectContaining({
            emailCount: '5'
          })
        })
      );
    });

    test('should return client secret', async () => {
      const emails = createTestEmailData(3);
      
      const req = createMockRequest('POST', { emails });
      const res = createMockResponse();

      const testClientSecret = 'pi_test_secret_xyz789';
      mockCreatePaymentIntent.mockResolvedValue({
        id: 'pi_test_456',
        client_secret: testClientSecret
      });

      await handler(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.clientSecret).toBe(testClientSecret);
    });

    test('should handle Stripe errors gracefully', async () => {
      const emails = createTestEmailData(2);
      
      const req = createMockRequest('POST', { emails });
      const res = createMockResponse();

      mockCreatePaymentIntent.mockRejectedValue(
        new Error('Stripe API error')
      );

      await handler(req, res);

      expect(res.statusCode).toBe(500);
      expect(res.body.error).toContain('error');
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

      mockCreatePaymentIntent.mockResolvedValue({
        id: 'pi_test_123',
        client_secret: 'pi_test_123_secret_abc'
      });

      await handler(req, res);

      expect(res.statusCode).toBe(200);
      expect(mockCreatePaymentIntent).toHaveBeenCalledWith(
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

      mockCreatePaymentIntent.mockResolvedValue({
        id: 'pi_test_123',
        client_secret: 'pi_test_123_secret_abc'
      });

      await handler(req, res);

      expect(res.statusCode).toBe(200);
      // Should only accept 2 valid entries (first and last)
      expect(mockCreatePaymentIntent).toHaveBeenCalledWith(
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

      expect(res.headers['Access-Control-Allow-Origin']).toBe('*');
      expect(res.headers['Access-Control-Allow-Methods']).toBe('POST, OPTIONS');
      expect(res.headers['Access-Control-Allow-Headers']).toBe('Content-Type');
    });
  });
});
