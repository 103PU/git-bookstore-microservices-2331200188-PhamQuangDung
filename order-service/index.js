import express from 'express';
import axios from 'axios';
import db from './db.js';
import { connectToBroker, publishMessage } from './broker.js';

const app = express();
app.use(express.json());

// RabbitMQ
connectToBroker().catch(err => console.error('Broker init error', err));

// Create order
app.post('/', async (req, res) => {
  try {
    const { productId, quantity } = req.body;
    
    // 1. Validate request body
    if (!productId || !quantity || quantity <= 0) {
      return res.status(400).json({ error: 'Invalid productId or quantity' });
    }

    // 2. Call product service to verify product exists
    const productServiceUrl = process.env.PRODUCT_SERVICE_URL || 'http://product-service:8002';
    try {
      const productRes = await axios.get(`${productServiceUrl}/${productId}`, { timeout: 3000 });
      if (!productRes.data) {
        return res.status(404).json({ error: 'Product not found' });
      }
    } catch (err) {
      console.error('Product service error:', err.message);
      return res.status(err.response?.status || 500).json({ 
        error: 'Could not verify product', 
        details: err.message 
      });
    }

    // 3. Insert order into database
    const r = await db.query(
      'INSERT INTO orders (product_id, quantity, status) VALUES ($1, $2, $3) RETURNING *',
      [productId, quantity, 'PENDING']
    );
    const order = r.rows[0];

    // 4. Publish order.created event to message broker
    await publishMessage('order_events', {
      event: 'ORDER_CREATED',
      orderId: order.id,
      productId: order.product_id,
      quantity: order.quantity,
      timestamp: order.created_at
    });
    console.log(`Order ${order.id} created and published to RabbitMQ`);

    // 5. Return success response
    res.status(201).json(order);
  } catch (err) {
    console.error('Create order error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// List orders
app.get('/', async (_req, res) => {
  const r = await db.query('SELECT * FROM orders ORDER BY id DESC');
  res.json(r.rows);
});

// Get order by id
app.get('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const r = await db.query('SELECT * FROM orders WHERE id = $1', [id]);
  if (r.rows.length === 0) return res.status(404).json({ error: 'Order not found' });
  res.json(r.rows[0]);
});

const PORT = 8003;
app.listen(PORT, () => console.log(`Order Service running on ${PORT}`));
