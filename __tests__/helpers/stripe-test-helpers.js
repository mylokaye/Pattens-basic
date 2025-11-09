/**
 * Stripe Test Helpers
 * 
 * Based on Stripe's testing documentation: https://docs.stripe.com/testing
 * These helpers provide test card numbers and utilities for simulating Stripe transactions
 */

/**
 * Stripe Test Card Numbers
 * Use these card numbers in test mode to simulate different payment scenarios
 */
const STRIPE_TEST_CARDS = {
  // Successful payments
  VISA_SUCCESS: '4242424242424242',
  VISA_DEBIT_SUCCESS: '4000056655665556',
  MASTERCARD_SUCCESS: '5555555555554444',
  MASTERCARD_DEBIT_SUCCESS: '5200828282828210',
  MASTERCARD_PREPAID_SUCCESS: '5105105105105100',
  AMEX_SUCCESS: '378282246310005',
  DISCOVER_SUCCESS: '6011111111111117',
  DINERS_CLUB_SUCCESS: '30569309025904',
  JCB_SUCCESS: '3566002020360505',

  // Card errors - Different decline codes
  GENERIC_DECLINE: '4000000000000002',
  INSUFFICIENT_FUNDS: '4000000000009995',
  LOST_CARD: '4000000000009987',
  STOLEN_CARD: '4000000000009979',
  EXPIRED_CARD: '4000000000000069',
  INCORRECT_CVC: '4000000000000127',
  PROCESSING_ERROR: '4000000000000119',
  INCORRECT_NUMBER: '4242424242424241',

  // Authentication required (3D Secure)
  AUTHENTICATION_REQUIRED: '4000002500003155',
  AUTHENTICATION_SUCCESS: '4000002760003184',

  // Additional test scenarios
  ALWAYS_INCOMPLETE: '4000000000006975', // Card payments succeed but the charge remains pending
  ALWAYS_DECLINE_CHARGE: '4000000000000341', // Charge succeeds but is declined when captured
};

/**
 * Test card details helper
 * Returns a complete test card object for use in Stripe test mode
 * 
 * @param {string} cardNumber - The test card number (use STRIPE_TEST_CARDS constants)
 * @param {string} expMonth - Expiration month (default: '12')
 * @param {string} expYear - Expiration year (default: '2034')
 * @param {string} cvc - Card CVC (default: '123')
 * @returns {object} Card details object
 */
function createTestCard(cardNumber = STRIPE_TEST_CARDS.VISA_SUCCESS, expMonth = '12', expYear = '2034', cvc = '123') {
  return {
    number: cardNumber,
    exp_month: expMonth,
    exp_year: expYear,
    cvc: cvc,
  };
}

/**
 * Test billing details helper
 * Returns test billing details for Stripe test mode
 * 
 * @param {string} email - Email address (default: test@example.com)
 * @param {string} name - Cardholder name (default: Test User)
 * @returns {object} Billing details object
 */
function createTestBillingDetails(email = 'test@example.com', name = 'Test User') {
  return {
    email: email,
    name: name,
    address: {
      line1: '123 Test Street',
      city: 'Test City',
      state: 'TS',
      postal_code: '12345',
      country: 'GB', // UK
    },
  };
}

/**
 * Test payment method tokens
 * These are pre-made PaymentMethod IDs you can use in Stripe test mode
 */
const STRIPE_TEST_PAYMENT_METHODS = {
  VISA: 'pm_card_visa',
  VISA_DEBIT: 'pm_card_visa_debit',
  MASTERCARD: 'pm_card_mastercard',
  MASTERCARD_PREPAID: 'pm_card_mastercard_prepaid',
  AMEX: 'pm_card_amex',
  DISCOVER: 'pm_card_discover',
  DINERS: 'pm_card_diners',
  JCB: 'pm_card_jcb',
  UNION_PAY: 'pm_card_unionpay',
};

/**
 * Test checkout session helper
 * Creates sample email data for testing checkout session creation
 * 
 * @param {number} count - Number of test emails to generate (default: 5)
 * @returns {array} Array of test email objects
 */
function createTestEmailData(count = 5) {
  const emails = [];
  for (let i = 1; i <= count; i++) {
    emails.push({
      email: `test${i}@example.com`,
      status: i % 2 === 0 ? 'Invalid' : 'Valid',
    });
  }
  return emails;
}

/**
 * Test price amounts (in smallest currency unit - pence for GBP)
 */
const TEST_PRICE_AMOUNTS = {
  PRODUCT_PRICE_GBP: 999, // £9.99 in pence
  TEST_PRICE_1_GBP: 100,  // £1.00 in pence
  TEST_PRICE_10_GBP: 1000, // £10.00 in pence
};

/**
 * Validate test mode API key
 * Ensures the provided key is a test key (starts with sk_test_)
 * 
 * @param {string} apiKey - Stripe API key to validate
 * @returns {boolean} True if valid test key
 */
function isTestApiKey(apiKey) {
  return !!(apiKey && apiKey.startsWith('sk_test_'));
}

/**
 * Environment check helper
 * Verifies that Stripe test API key is available
 * 
 * @returns {boolean} True if test environment is properly configured
 */
function isStripeTestEnvironmentConfigured() {
  const apiKey = process.env.STRIPE_TEST_API_KEY || process.env.STRIPE_SECRET_KEY;
  return apiKey && isTestApiKey(apiKey);
}

module.exports = {
  // Test card numbers
  STRIPE_TEST_CARDS,
  
  // Test payment methods
  STRIPE_TEST_PAYMENT_METHODS,
  
  // Test prices
  TEST_PRICE_AMOUNTS,
  
  // Helper functions
  createTestCard,
  createTestBillingDetails,
  createTestEmailData,
  isTestApiKey,
  isStripeTestEnvironmentConfigured,
};
