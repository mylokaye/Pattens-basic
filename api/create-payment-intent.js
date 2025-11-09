const Stripe = require('stripe');

// Initialize Stripe with secret key from environment variable
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

if (!stripeSecretKey) {
    throw new Error('STRIPE_SECRET_KEY environment variable is not set');
}

const stripe = new Stripe(stripeSecretKey);

// Constants
const MAX_METADATA_SIZE = 500 * 1024; // Stripe metadata limit is 500KB per key

// Sanitize email data for metadata storage
function sanitizeEmailData(emails) {
    if (!Array.isArray(emails)) {
        return [];
    }
    
    // Limit to 300 emails and sanitize each entry
    return emails.slice(0, 300).map(item => {
        if (!item || typeof item !== 'object') {
            return null;
        }
        
        const email = String(item.email || '').trim();
        const status = String(item.status || '').trim();
        
        // Basic validation
        if (!email || (status !== 'Valid' && status !== 'Invalid')) {
            return null;
        }
        
        return { email, status };
    }).filter(item => item !== null);
}

// Vercel serverless function handler
module.exports = async (req, res) => {
    // Set headers for all responses
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Content-Type', 'application/json');
    
    // Security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // Parse request body
        const { emails } = req.body;

        if (!emails || !Array.isArray(emails) || emails.length === 0) {
            return res.status(400).json({ error: 'Invalid email data' });
        }

        // Sanitize email data
        const sanitizedEmails = sanitizeEmailData(emails);
        
        if (sanitizedEmails.length === 0) {
            return res.status(400).json({ error: 'No valid email data provided' });
        }

        // Convert emails to JSON string for metadata
        const emailsJson = JSON.stringify(sanitizedEmails);
        
        // Check metadata size limit
        if (emailsJson.length > MAX_METADATA_SIZE) {
            return res.status(400).json({ error: 'Email data too large for processing' });
        }

        // Create Stripe payment intent
        const paymentIntent = await stripe.paymentIntents.create({
            amount: 999, // £9.99 in pence
            currency: 'gbp',
            payment_method_types: ['card'],
            metadata: {
                emails: emailsJson,
                emailCount: sanitizedEmails.length.toString(),
            },
        });

        return res.status(200).json({ 
            clientSecret: paymentIntent.client_secret
        });

    } catch (error) {
        console.error('Payment intent error:', error);
        
        // Handle Stripe-specific errors
        if (error.type === 'StripeCardError') {
            return res.status(400).json({ error: error.message });
        }
        
        return res.status(500).json({ 
            error: error.message || 'Error creating payment intent. Please try again.' 
        });
    }
};
