require("dotenv").config();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const express = require("express");
const app = express();
const path = require('path');

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// IMPORTANT: Don't use express.static on Vercel for root directory
// Vercel will handle static files automatically

// Canadian tax rates by province
const TAX_RATES = {
  'BC': { gst: 0.05, pst: 0.07, total: 0.12 },
  'AB': { gst: 0.05, pst: 0.00, total: 0.05 },
  'ON': { hst: 0.13, total: 0.13 },
  'QC': { gst: 0.05, pst: 0.09975, total: 0.14975 },
  'SK': { gst: 0.05, pst: 0.06, total: 0.11 },
  'MB': { gst: 0.05, pst: 0.07, total: 0.12 },
  'NB': { hst: 0.15, total: 0.15 },
  'NS': { hst: 0.15, total: 0.15 },
  'PE': { hst: 0.15, total: 0.15 },
  'NL': { hst: 0.15, total: 0.15 }
};

// API Routes ONLY - Let Vercel handle HTML files
app.get('/api/config', (req, res) => {
  res.json({
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY
  });
});

app.get('/api/test', (req, res) => {
  res.json({ message: 'Server is working!', timestamp: new Date().toISOString() });
});

app.post("/api/create-checkout-session", async (req, res) => {
  try {
    const { lineItems, province = 'BC' } = req.body;
    
    if (!lineItems || lineItems.length === 0) {
      return res.status(400).json({ error: 'No items in cart' });
    }

    const taxRate = TAX_RATES[province] || TAX_RATES['BC'];
    
    const stripeLineItems = lineItems.map(item => ({
      price_data: {
        currency: 'cad',
        product_data: {
          name: item.name,
          description: item.description || '',
        },
        unit_amount: Math.round(item.amount),
      },
      quantity: item.quantity,
    }));

    const subtotal = lineItems.reduce((sum, item) => sum + (item.amount * item.quantity), 0);
    const taxAmount = Math.round(subtotal * taxRate.total);
    
    if (taxAmount > 0) {
      stripeLineItems.push({
        price_data: {
          currency: 'cad',
          product_data: {
            name: `${province} Tax (${(taxRate.total * 100).toFixed(1)}%)`,
            description: 'Sales Tax',
          },
          unit_amount: taxAmount,
        },
        quantity: 1,
      });
    }

    // Get the correct domain
    const domain = process.env.DOMAIN || `https://${req.headers.host}`;

    // Build session configuration
    const sessionConfig = {
      payment_method_types: ['card'],
      line_items: stripeLineItems,
      mode: 'payment',
      success_url: `${domain}/checkout/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${domain}/checkout/cancelled.html`,
      shipping_address_collection: {
        allowed_countries: ['US', 'CA'],
      },
      automatic_tax: {
        enabled: false,
      },
    };

    // Add shipping options if shipping rate ID is configured
    if (process.env.STRIPE_SHIPPING_RATE_ID) {
      sessionConfig.shipping_options = [
        { shipping_rate: process.env.STRIPE_SHIPPING_RATE_ID }
      ];
    }

    const session = await stripe.checkout.sessions.create(sessionConfig);

    return res.json({ sessionId: session.id });
    
  } catch (error) {
    console.error('Error creating checkout session:', error);
    return res.status(500).json({ error: error.message });
  }
});

app.post('/api/webhook', express.raw({type: 'application/json'}), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    console.log('Webhook secret not configured');
    return res.json({received: true});
  }

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.log(`Webhook signature verification failed:`, err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    console.log('Payment successful for session:', session.id);
    // Add your fulfillment logic here
  }

  res.json({received: true});
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    stripe_configured: !!process.env.STRIPE_SECRET_KEY
  });
});

// IMPORTANT: Don't add catch-all routes for HTML files
// Let Vercel handle static file serving

const port = process.env.PORT || 4242;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  console.log('Stripe configured:', !!process.env.STRIPE_SECRET_KEY);
});
