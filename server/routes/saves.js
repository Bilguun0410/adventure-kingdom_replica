// ============================================================
// /api/saves routes
// ============================================================

const express = require("express");
const router = express.Router();
const Save = require("../models/GameSave");

// List all saves (no buildings payload, most recent first)
router.get("/", async (req, res) => {
  try {
    const saves = await Save.find({}, "-buildings -tiles")
      .sort({ createdAt: -1 })
      .limit(20);
    res.json(saves);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single save (full)
router.get("/:id", async (req, res) => {
  try {
    const save = await Save.findById(req.params.id);
    if (!save) return res.status(404).json({ error: "Save not found" });
    res.json(save);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create new save
router.post("/", async (req, res) => {
  try {
    // Migrate flat fields into resources sub-doc if needed
    const body = req.body;
    if (!body.resources) {
      body.resources = {
        gold: body.gold ?? 999999,
        food: body.food ?? 10,
        silverCoins: body.silverCoins ?? 0,
        copperCoins: body.copperCoins ?? 0,
      };
    }
    const save = new Save(body);
    await save.save();
    console.log(`💾  New save: "${save.name}" (Day ${save.day})`);
    res.status(201).json(save);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Update existing save (overwrites fields sent)
router.put("/:id", async (req, res) => {
  try {
    const save = await Save.findByIdAndUpdate(
      req.params.id,
      { ...req.body, savedAt: new Date() },
      { new: true, runValidators: true },
    );
    if (!save) return res.status(404).json({ error: "Save not found" });
    res.json(save);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Delete a save
router.delete("/:id", async (req, res) => {
  try {
    const save = await Save.findByIdAndDelete(req.params.id);
    if (!save) return res.status(404).json({ error: "Save not found" });
    console.log(`🗑️   Deleted save: ${req.params.id}`);
    res.json({ ok: true, deleted: req.params.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
