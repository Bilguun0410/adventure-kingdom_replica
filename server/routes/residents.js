// ============================================================
// /api/residents routes — CRUD + breeding endpoint
// ============================================================

const express = require("express");
const router = express.Router();
const Resident = require("../models/Resident");
const { Inventory, ITEMS } = require("../models/Inventory");
const { getBreedingResult } = require("../data/compatibilityMatrix");

// ── Helpers ───────────────────────────────────────────────────

/** Roll a random stat block for a new Gen1 resident */
function rollGen1Stats(jobClass) {
  const base = {
    Monarch: { hp: 99999, atk: 999, def: 999, int: 999 },
    Knight: { hp: 25, atk: 15, def: 18, int: 8 },
    Mage: { hp: 12, atk: 8, def: 6, int: 22 },
    Warrior: { hp: 22, atk: 18, def: 12, int: 6 },
    Blacksmith: { hp: 18, atk: 14, def: 16, int: 8 },
    Archer: { hp: 16, atk: 16, def: 10, int: 10 },
    Cleric: { hp: 18, atk: 8, def: 12, int: 18 },
    Merchant: { hp: 14, atk: 8, def: 8, int: 14 },
    Farmer: { hp: 16, atk: 10, def: 10, int: 8 },
    "Beast Tamer": { hp: 18, atk: 12, def: 10, int: 14 },
  };
  const b = base[jobClass] || { hp: 15, atk: 10, def: 10, int: 10 };
  // add ±2 variance per stat
  const vary = (v) => v + Math.floor(Math.random() * 5) - 2;
  return {
    hp: vary(b.hp),
    atk: vary(b.atk),
    def: vary(b.def),
    int: vary(b.int),
  };
}

/** Derive Gen2 stats from parents + grade bonus */
function rollGen2Stats(parent1Stats, parent2Stats, bonusPoints, grade) {
  // Average parents, then add bonus distributed proportionally
  const avg = (k) => Math.round((parent1Stats[k] + parent2Stats[k]) / 2);
  const stats = {
    hp: avg("hp"),
    atk: avg("atk"),
    def: avg("def"),
    int: avg("int"),
  };

  // Distribute bonus points randomly across stats
  let remaining = bonusPoints;
  const keys = ["hp", "atk", "def", "int"];
  while (remaining > 0) {
    const k = keys[Math.floor(Math.random() * keys.length)];
    stats[k]++;
    remaining--;
  }
  return stats;
}

/** Average growth modifiers with a slight grade boost */
function inheritGrowthModifiers(p1Mods, p2Mods, grade) {
  const gradeBoost = { S: 0.15, A: 0.1, B: 0.05, C: 0.02, D: 0 };
  const boost = gradeBoost[grade] || 0;
  const keys = ["hp", "atk", "def", "int"];
  const result = {};
  keys.forEach((k) => {
    result[k] = Math.min(2.0, (p1Mods[k] + p2Mods[k]) / 2 + boost);
  });
  return result;
}

// ── Routes ────────────────────────────────────────────────────

// List all residents for a save
router.get("/", async (req, res) => {
  const { saveId } = req.query;
  if (!saveId)
    return res.status(400).json({ error: "saveId query param required" });
  try {
    const residents = await Resident.find({ saveId, isAlive: true })
      .populate("marriedTo", "name jobClass gender")
      .sort({ generation: 1, createdAt: 1 });
    res.json(residents);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single resident
router.get("/:id", async (req, res) => {
  try {
    const r = await Resident.findById(req.params.id)
      .populate("marriedTo", "name jobClass gender")
      .populate("lineage.parent1", "name jobClass")
      .populate("lineage.parent2", "name jobClass");
    if (!r) return res.status(404).json({ error: "Resident not found" });
    res.json(r);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create a new Gen1 resident
router.post("/", async (req, res) => {
  try {
    const { name, gender, jobClass, saveId, roomId } = req.body;
    if (!name || !gender || !jobClass || !saveId)
      return res
        .status(400)
        .json({ error: "name, gender, jobClass, saveId required" });

    const stats = rollGen1Stats(jobClass);
    const r = new Resident({
      name,
      gender,
      jobClass,
      saveId,
      roomId: roomId || null,
      stats,
      generation: 1,
      growthModifiers: { hp: 1.0, atk: 1.0, def: 1.0, int: 1.0 },
    });
    await r.save();
    res.status(201).json(r);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Marry two residents (consume 1× Love Wine from inventory)
router.post("/marry", async (req, res) => {
  const { residentAId, residentBId, saveId } = req.body;
  if (!residentAId || !residentBId || !saveId)
    return res
      .status(400)
      .json({ error: "residentAId, residentBId, saveId required" });

  try {
    const [a, b] = await Promise.all([
      Resident.findById(residentAId),
      Resident.findById(residentBId),
    ]);
    if (!a || !b) return res.status(404).json({ error: "Resident not found" });
    if (a.marriedTo || b.marriedTo)
      return res
        .status(409)
        .json({ error: "One or both residents are already married" });
    if (a.gender === b.gender)
      return res
        .status(409)
        .json({ error: "Residents must be of different genders" });

    // Consume Love Wine from inventory
    const inv = await Inventory.findOne({ saveId });
    if (!inv)
      return res
        .status(404)
        .json({ error: "Inventory not found for this save" });
    const consumed = await inv.consumeItem("love_wine");
    if (!consumed)
      return res
        .status(409)
        .json({ error: "Need 1× Love Wine to marry residents" });

    a.marriedTo = b._id;
    b.marriedTo = a._id;
    await Promise.all([a.save(), b.save()]);

    console.log(
      `💍  Married ${a.name} (${a.jobClass}) ↔ ${b.name} (${b.jobClass})`,
    );
    res.json({ ok: true, residentA: a, residentB: b });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Breed — create a Gen2 child from two married Gen1 parents
router.post("/breed", async (req, res) => {
  const { parent1Id, parent2Id, childName, saveId } = req.body;
  if (!parent1Id || !parent2Id || !childName || !saveId)
    return res
      .status(400)
      .json({ error: "parent1Id, parent2Id, childName, saveId required" });

  try {
    const [p1, p2] = await Promise.all([
      Resident.findById(parent1Id),
      Resident.findById(parent2Id),
    ]);
    if (!p1 || !p2) return res.status(404).json({ error: "Parent not found" });
    if (p1.generation !== 1 || p2.generation !== 1)
      return res
        .status(400)
        .json({ error: "Both parents must be Generation 1" });
    if (!p1.marriedTo?.equals(p2._id))
      return res
        .status(409)
        .json({ error: "Parents must be married to each other" });

    // Determine outcome via compatibility matrix
    const { childJob, grade, bonusPoints, desc } = getBreedingResult(
      p1.jobClass,
      p2.jobClass,
    );
    const stats = rollGen2Stats(p1.stats, p2.stats, bonusPoints, grade);
    const growthModifiers = inheritGrowthModifiers(
      p1.growthModifiers,
      p2.growthModifiers,
      grade,
    );

    // Child gender is random
    const childGender = Math.random() < 0.5 ? "male" : "female";

    const child = new Resident({
      name: childName,
      gender: childGender,
      generation: 2,
      jobClass: childJob,
      saveId,
      stats,
      growthModifiers,
      compatibilityGrade: grade,
      lineage: { parent1: p1._id, parent2: p2._id },
    });
    await child.save();

    console.log(
      `👶  Born ${child.name} — Gen2 ${childJob} [Grade ${grade}] (+${bonusPoints} stat bonus)`,
    );
    res.status(201).json({
      child,
      breedingResult: { childJob, grade, bonusPoints, desc },
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Preview breeding result without creating a child
router.get("/preview-breed", async (req, res) => {
  const { jobA, jobB } = req.query;
  if (!jobA || !jobB)
    return res
      .status(400)
      .json({ error: "jobA and jobB query params required" });
  try {
    const result = getBreedingResult(jobA, jobB);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update resident (room assignment, etc.)
router.put("/:id", async (req, res) => {
  try {
    const r = await Resident.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!r) return res.status(404).json({ error: "Resident not found" });
    res.json(r);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Soft-delete resident
router.delete("/:id", async (req, res) => {
  try {
    const r = await Resident.findByIdAndUpdate(
      req.params.id,
      { isAlive: false },
      { new: true },
    );
    if (!r) return res.status(404).json({ error: "Resident not found" });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
