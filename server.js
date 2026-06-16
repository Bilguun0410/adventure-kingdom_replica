// ============================================================
// Adventure Kingdom — Express + MongoDB backend (modular)
// ============================================================
// Install: npm install
// Run:     npm start  (or: node server.js)
// Requires MongoDB running locally on port 27017,
// or set MONGO_URI env var to your Atlas connection string.
// ============================================================

const express  = require('express');
const mongoose = require('mongoose');
const cors     = require('cors');
const path     = require('path');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Serve index.html statically so you can open localhost:3001
app.use(express.static(path.join(__dirname)));

// ── MongoDB connection ────────────────────────────────────────
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/adventure_kingdom';

mongoose.connect(MONGO_URI)
  .then(() => console.log(`✅  MongoDB connected: ${MONGO_URI}`))
  .catch(err => {
    console.error('❌  MongoDB connection failed:', err.message);
    console.error('    Make sure MongoDB is running, or set MONGO_URI env var.');
    process.exit(1);
  });

// ── Mount routes ──────────────────────────────────────────────
app.use('/api/saves',     require('./server/routes/saves'));
app.use('/api/save-map',  require('./server/routes/saveMap'));
app.use('/api/residents', require('./server/routes/residents'));
app.use('/api/inventory', require('./server/routes/inventory'));

// ── Compatibility preview (no auth needed) ────────────────────
const { getBreedingResult, getCompatibilityFor } = require('./server/data/compatibilityMatrix');

app.get('/api/compatibility', (req, res) => {
  const { jobA, jobB } = req.query;
  if (jobA && jobB) return res.json(getBreedingResult(jobA, jobB));
  if (jobA)         return res.json(getCompatibilityFor(jobA));
  res.status(400).json({ error: 'Provide jobA (and optionally jobB) query params' });
});

// ── Health check ──────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
  });
});

// ── Start ─────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`⚔️   Adventure Kingdom server → http://localhost:${PORT}`);
  console.log(`     Open http://localhost:${PORT} in your browser to play.`);
  console.log(`\n  API endpoints:`);
  console.log(`     GET/POST   /api/saves`);
  console.log(`     GET/PUT/DELETE /api/saves/:id`);
  console.log(`     GET/POST   /api/residents?saveId=...`);
  console.log(`     POST       /api/residents/marry`);
  console.log(`     POST       /api/residents/breed`);
  console.log(`     GET        /api/inventory?saveId=...`);
  console.log(`     GET        /api/compatibility?jobA=Knight&jobB=Mage`);
});
