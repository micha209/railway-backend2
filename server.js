const express = require('express');
const cors = require('cors');
require('dotenv').config();

const db = require('./firebase');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Test
app.get('/', (req, res) => {
  res.json({
    message: '🚀 Backend Firebase opérationnel',
    status: 'OK',
    timestamp: new Date().toISOString()
  });
});

// Health
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// 🔥 USERS DEPUIS FIREBASE
app.get('/api/users', async (req, res) => {
  try {
    const snapshot = await db.ref('materials').once('value');
    const data = snapshot.val();
    res.json(data ? Object.values(data) : []);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Injecter des users (1 seule fois)
app.post('/api/users/seed', async (req, res) => {
  try {
    const users = [
      { id: 1, name: 'Alice', email: 'alice@example.com' },
      { id: 2, name: 'Bob', email: 'bob@example.com' },
      { id: 3, name: 'Charlie', email: 'charlie@example.com' }
    ];

    for (const user of users) {
      await db.ref(`users/${user.id}`).set(user);
    }

    res.json({ message: '✅ Utilisateurs ajoutés dans Firebase' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Echo
app.post('/api/echo', (req, res) => {
  res.json({
    received: req.body.message,
    echoed: `Vous avez dit: ${req.body.message}`,
    timestamp: new Date().toISOString()
  });
});

// Infos système
app.get('/api/info', (req, res) => {
  res.json({
    platform: process.platform,
    nodeVersion: process.version,
    uptime: process.uptime(),
    memoryUsage: process.memoryUsage()
  });
});

// 404
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route non trouvée' });
});

// Start
app.listen(PORT, () => {
  console.log(`✅ Serveur démarré sur le port ${PORT}`);
});


