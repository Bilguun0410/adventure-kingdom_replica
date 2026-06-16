// ============================================================
// Resident Schema — supports Breeding, Lineage, Generation Jobs
// ============================================================

const mongoose = require('mongoose');

const statsSchema = new mongoose.Schema({
  hp:  { type: Number, default: 100 },
  atk: { type: Number, default: 25 },
  def: { type: Number, default: 24 },
  int: { type: Number, default: 32 },
}, { _id: false });

// Growth modifiers are multipliers inherited from parents (0.5 – 2.0 range)
const growthModifiersSchema = new mongoose.Schema({
  hp:  { type: Number, default: 2.0 },
  atk: { type: Number, default: 2.0 },
  def: { type: Number, default: 2.0 },
  int: { type: Number, default: 2.0 },
}, { _id: false });

const residentSchema = new mongoose.Schema({
  // Identity
  name:       { type: String, required: true },
  gender:     { type: String, enum: ['male', 'female'], required: true },
  generation: { type: Number, enum: [1, 2], default: 1 },

  // Job class
  jobClass: {
    type: String,
    enum: [
      // Gen 1 jobs
      'Monarch', 'Knight', 'Mage', 'Warrior', 'Blacksmith',
      'Archer', 'Cleric', 'Merchant', 'Farmer', 'Beast Tamer',
      // Gen 2 jobs (from breeding)
      'Magic Knight', 'Berserker', 'Paladin', 'Holy Mage',
      'Dark Knight', 'Ranger Knight', 'Runesmith', 'Summoner',
      'Ranger', 'Tycoon', 'Hunter', 'Royal Heir',
    ],
    required: true,
  },

  // Base stats + growth modifiers for level-up scaling
  stats:          { type: statsSchema,          default: () => ({}) },
  growthModifiers:{ type: growthModifiersSchema, default: () => ({}) },

  // Relationship / housing
  marriedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Resident', default: null },
  roomId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Building',  default: null },

  // Lineage (null for Gen 1)
  lineage: {
    parent1: { type: mongoose.Schema.Types.ObjectId, ref: 'Resident', default: null },
    parent2: { type: mongoose.Schema.Types.ObjectId, ref: 'Resident', default: null },
  },

  // Derived from breeding
  compatibilityGrade: { type: String, enum: ['S', 'A', 'B', 'C', 'D', null], default: null },

  // Link to the game save this resident belongs to
  saveId: { type: mongoose.Schema.Types.ObjectId, ref: 'Save', required: true, index: true },

  // Soft-delete / activity
  isAlive: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('Resident', residentSchema);
