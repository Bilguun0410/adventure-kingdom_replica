// ============================================================
// /api/inventory routes
// ============================================================

const express = require("express");
const router = express.Router();
const { Inventory, ITEMS } = require("../models/Inventory");

// Get inventory for a save (create if missing)
router.get("/", async (req, res) => {
  const { saveId } = req.query;
  if (!saveId) return res.status(400).json({ error: "saveId required" });
  try {
    let inv = await Inventory.findOne({ saveId });
    if (!inv) {
      // Bootstrap with starter items
      inv = new Inventory({
        saveId,
        items: [{ ...ITEMS.LOVE_WINE, quantity: 2 }],
      });
      await inv.save();
    }
    res.json(inv);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add item(s) to inventory
router.post("/add", async (req, res) => {
  const {
    saveId,
    itemId,
    name,
    qty = 1,
    category = "material",
    meta = null,
  } = req.body;
  if (!saveId || !itemId || !name)
    return res.status(400).json({ error: "saveId, itemId, name required" });
  try {
    let inv = await Inventory.findOne({ saveId });
    if (!inv) inv = new Inventory({ saveId });
    await inv.addItem(itemId, name, qty, category, meta);
    res.json(inv);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Consume item(s)
router.post("/consume", async (req, res) => {
  const { saveId, itemId, qty = 1 } = req.body;
  if (!saveId || !itemId)
    return res.status(400).json({ error: "saveId, itemId required" });
  try {
    const inv = await Inventory.findOne({ saveId });
    if (!inv) return res.status(404).json({ error: "Inventory not found" });
    const ok = await inv.consumeItem(itemId, qty);
    if (!ok) return res.status(409).json({ error: "Insufficient stock" });
    res.json(inv);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
