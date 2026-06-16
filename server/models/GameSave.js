// ============================================================
// GameSave Schema — Player profile, 50x50 town grid, buildings
// ============================================================

const mongoose = require("mongoose");

// ── Player resources ─────────────────────────────────────────
const resourcesSchema = new mongoose.Schema(
  {
    gold: { type: Number, default: 99999 },
    food: { type: Number, default: 10 },
    silverCoins: { type: Number, default: 0 },
    copperCoins: { type: Number, default: 0 },
  },
  { _id: false },
);

// ── Single placed building ────────────────────────────────────
const buildingSchema = new mongoose.Schema(
  {
    id: { type: mongoose.Schema.Types.Mixed }, // client-generated numeric id
    type: { type: String, required: true },
    tx: { type: Number, required: true },
    ty: { type: Number, required: true },
  },
  { _id: false },
);

// ── Town grid tile (sparse — only non-default tiles are stored) ─
const tileSchema = new mongoose.Schema(
  {
    x: { type: Number, required: true },
    y: { type: Number, required: true },
    type: {
      type: String,
      enum: ["grass", "water", "dirt", "stone"],
      default: "grass",
    },
  },
  { _id: false },
);

// ── Main save document ────────────────────────────────────────
const gameSaveSchema = new mongoose.Schema(
  {
    name: { type: String, default: "Unnamed Kingdom" },

    // Player profile
    resources: { type: resourcesSchema, default: () => ({}) },

    // Legacy flat fields kept for backward compat with old saves
    gold: { type: Number },
    food: { type: Number },
    defense: { type: Number },
    pop: { type: Number },
    hap: { type: Number },

    // Game progression
    day: { type: Number, default: 1 },
    happiness: { type: Number, default: 50 },
    defense: { type: Number, default: 0 },
    population: { type: Number, default: 0 },
    maxPop: { type: Number, default: 0 },

    // Town grid — 50×50 map; only non-grass tiles stored (sparse)
    mapSize: {
      width: { type: Number, default: 50 },
      height: { type: Number, default: 50 },
    },
    tiles: { type: [tileSchema], default: [] },

    // Placed buildings
    buildings: { type: [buildingSchema], default: [] },

    savedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

// ── Pre-save migration: promote flat gold/food into resources ──
gameSaveSchema.pre("save", function (next) {
  if (this.gold != null && !this.resources?.gold)
    this.resources.gold = this.gold;
  if (this.food != null && !this.resources?.food)
    this.resources.food = this.food;
  if (this.pop != null && !this.population) this.population = this.pop;
  if (this.hap != null && !this.happiness) this.happiness = this.hap;
  next();
});

module.exports = mongoose.model("Save", gameSaveSchema);
