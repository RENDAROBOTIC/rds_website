require("dotenv").config();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const express = require("express");
const app = express();
const path = require('path');

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Serve static files with proper MIME types
app.use(express.static(__dirname, {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css');
    } else if (filePath.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript');
    } else if (filePath.endsWith('.html')) {
      res.setHeader('Content-Type', 'text/html');
    }
  }
}));

// Canadian tax rates by province
const TAX_RATES = {
  'BC': { gst: 0.05, pst: 0.07, total: 0.12 },
  'AB': { gst: 0.05, pst: 0.00, total: 0.05 },
  'ON': { hst: 0.13, total: 0.13 },
  'QC': { gst: 0.05, pst: 0.09975, total: 0.14975 },
};

// API Routes
app.get('/api/config', (req, res) => {
  res.json({
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY
  });
});

app.get('/test', (req, res) => {
  res.send('Server is working!');
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
          description: item.description,
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
          },
          unit_amount: taxAmount,
        },
        quantity: 1,
      });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: stripeLineItems,
      mode: 'payment',
      success_url: `${process.env.DOMAIN || 'https://your-vercel-app.vercel.app'}/checkout/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.DOMAIN || 'https://your-vercel-app.vercel.app'}/checkout/cart.html`,
      shipping_address_collection: {
        allowed_countries: ['CA'],
      },
      automatic_tax: {
        enabled: false,
      },
    });

    return res.json({ sessionId: session.id });
    
  } catch (error) {
    console.error('Error creating checkout session:', error);
    return res.status(500).json({ error: error.message });
  }
});

app.post('/api/webhook', express.raw({type: 'application/json'}), (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.log(`Webhook signature verification failed.`, err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    console.log('Payment successful for session:', session.id);
  }

  res.json({received: true});
});

// Route handlers for HTML pages
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'renda_design_supply.html'));
});

// Handle other routes that might need special handling
app.get('/tools/tools', (req, res) => {
  res.sendFile(path.join(__dirname, 'tools', 'tools.html'));
});

app.get('/checkout/cart', (req, res) => {
  res.sendFile(path.join(__dirname, 'checkout', 'cart.html'));
});

// Catch-all for other routes - let static serving handle them
app.get('*', (req, res, next) => {
  // If it's an API route that wasn't handled above, return 404
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  
  // For everything else, let the static file handler try
  next();
});

const port = process.env.PORT || 4242;
app.listen(port, () => console.log(`Server running on port ${port}`));
