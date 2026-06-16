// ============================================================
// /api/save-map — atomic map/fog/buildings persistence
// ============================================================

const express = require('express');
const router = express.Router();
const Save = require('../models/GameSave');

/**
 * POST /api/save-map
 * Body: { saveId, tiles?, buildings?, fog? }
 * Updates the full map payload (terrain tiles, buildings, fog-of-war)
 * without touching resident or inventory collections.
 */
router.post('/', async (req, res) => {
  try {
    const { saveId, tiles, buildings, fog } = req.body;
    if (!saveId) return res.status(400).json({ error: 'saveId required' });

    const update = { savedAt: new Date() };
    if (Array.isArray(tiles)) update.tiles = tiles;
    if (Array.isArray(buildings)) update.buildings = buildings;
    if (Array.isArray(fog)) update.fog = fog;

    const save = await Save.findByIdAndUpdate(
      saveId,
      update,
      { new: true, runValidators: true }
    );

    if (!save) return res.status(404).json({ error: 'Save not found' });
    res.json({ ok: true, save });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
