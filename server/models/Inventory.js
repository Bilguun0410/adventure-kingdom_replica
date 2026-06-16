// ============================================================
// Inventory Schema — Global town item/material storage
// ============================================================

const mongoose = require("mongoose");

const inventoryItemSchema = new mongoose.Schema(
  {
    // Item identity
    itemId: { type: String, required: true }, // e.g. 'love_wine', 'awakening_book_knight'
    name: { type: String, required: true }, // Display name
    category: {
      type: String,
      enum: ["special", "material", "weapon", "armor", "consumable"],
      default: "material",
    },
    quantity: { type: Number, default: 1, min: 0 },

    // Optional metadata (e.g. which job class the Awakening Book unlocks)
    meta: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { _id: false },
);

const inventorySchema = new mongoose.Schema(
  {
    saveId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Save",
      required: true,
      unique: true,
      index: true,
    },
    items: { type: [inventoryItemSchema], default: [] },
  },
  { timestamps: true },
);

// ── Helpers ───────────────────────────────────────────────────

/**
 * Add or increment an item by itemId.
 * Returns the updated inventory document.
 */
inventorySchema.methods.addItem = async function (
  itemId,
  name,
  qty = 1,
  category = "material",
  meta = null,
) {
  const existing = this.items.find((i) => i.itemId === itemId);
  if (existing) {
    existing.quantity += qty;
  } else {
    this.items.push({ itemId, name, quantity: qty, category, meta });
  }
  return this.save();
};

/**
 * Consume qty units of an item. Returns false if insufficient stock.
 */
inventorySchema.methods.consumeItem = async function (itemId, qty = 1) {
  const item = this.items.find((i) => i.itemId === itemId);
  if (!item || item.quantity < qty) return false;
  item.quantity -= qty;
  await this.save();
  return true;
};

// ── Well-known item definitions (used by game logic) ──────────
const ITEMS = {
  LOVE_WINE: { itemId: "love_wine", name: "Love Wine", category: "special" },
  AWAKENING_BOOK: (jobClass) => ({
    itemId: `awakening_book_${jobClass.toLowerCase().replace(/ /g, "_")}`,
    name: `Awakening Book (${jobClass})`,
    category: "special",
    meta: { unlocksJob: jobClass },
  }),
};

module.exports = {
  Inventory: mongoose.model("Inventory", inventorySchema),
  ITEMS,
};
