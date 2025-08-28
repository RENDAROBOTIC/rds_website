require("dotenv").config();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const express = require("express");
const app = express();

app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Canadian tax rates by province
const TAX_RATES = {
  'BC': { gst: 0.05, pst: 0.07, total: 0.12 }, // Vancouver
  'AB': { gst: 0.05, pst: 0.00, total: 0.05 },
  'ON': { hst: 0.13, total: 0.13 },
  'QC': { gst: 0.05, pst: 0.09975, total: 0.14975 },
  // Add other provinces as needed
};

// Endpoint to get publishable key securely
app.get('/api/config', (req, res) => {
  res.json({
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY
  });
});

// Create checkout session with Canadian tax calculation
app.post("/api/create-checkout-session", async (req, res) => {
  try {
    const { lineItems, province = 'BC' } = req.body;
    
    if (!lineItems || lineItems.length === 0) {
      return res.status(400).json({ error: 'No items in cart' });
    }

    // Get tax rate for province
    const taxRate = TAX_RATES[province] || TAX_RATES['BC'];
    
    // Create line items for Stripe
    const stripeLineItems = lineItems.map(item => ({
      price_data: {
        currency: 'cad', // Canadian dollars
        product_data: {
          name: item.name,
          description: item.description,
        },
        unit_amount: Math.round(item.amount), // Amount in cents
      },
      quantity: item.quantity,
    }));

    // Add tax as a separate line item
    const subtotal = lineItems.reduce((sum, item) => sum + (item.amount * item.quantity), 0);
    const taxAmount = Math.round(subtotal * taxRate.total);
    const path = require('path');
    
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
      success_url: `${process.env.DOMAIN}/checkout/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.DOMAIN}/checkout/cart.html`,
      shipping_address_collection: {
        allowed_countries: ['CA'], // Canada only
      },
      automatic_tax: {
        enabled: false, // We're handling tax manually
      },
    });

    return res.json({ sessionId: session.id });
    
  } catch (error) {
    console.error('Error creating checkout session:', error);
    return res.status(500).json({ error: error.message });
  }
});

// Webhook to handle successful payments
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
    // Add your order fulfillment logic here
  }

  res.json({received: true});
});

app.listen(4242, () => console.log("Secure server running on port 4242"));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'renda_design_supply.html'));
});
