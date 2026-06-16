// ============================================================
// Job Compatibility Matrix
// Determines Gen2 job outcome and bonus stat grade from
// two Gen1 parent job classes.
// ============================================================
//
// Grade → bonus stat points awarded to Gen2 child:
//   S → +20 bonus points distributed across stats
//   A → +14
//   B → +8
//   C → +4
//   D → +1
// ============================================================

const GRADE_BONUS = { S: 20, A: 14, B: 8, C: 4, D: 1 };

// Each entry is [jobA, jobB] → { childJob, grade, description }
// Order of the pair does not matter (matrix is symmetric).
const MATRIX = [
  // ── Tier S (Royal bloodline) ─────────────────────────────
  { a: 'Monarch',    b: 'Knight',      childJob: 'Royal Heir',    grade: 'S', desc: 'A child of noble destiny.' },
  { a: 'Monarch',    b: 'Mage',        childJob: 'Royal Heir',    grade: 'S', desc: 'A child of noble destiny.' },

  // ── Tier A ───────────────────────────────────────────────
  { a: 'Knight',     b: 'Mage',        childJob: 'Magic Knight',  grade: 'A', desc: 'Masters both blade and spell.' },
  { a: 'Warrior',    b: 'Blacksmith',  childJob: 'Berserker',     grade: 'A', desc: 'Raw power forged in fire.' },
  { a: 'Knight',     b: 'Cleric',      childJob: 'Paladin',       grade: 'A', desc: 'Holy warrior of unbreakable faith.' },
  { a: 'Mage',       b: 'Cleric',      childJob: 'Holy Mage',     grade: 'A', desc: 'Wields sacred and arcane arts.' },

  // ── Tier B ───────────────────────────────────────────────
  { a: 'Warrior',    b: 'Mage',        childJob: 'Dark Knight',   grade: 'B', desc: 'A shadowy blend of strength and sorcery.' },
  { a: 'Knight',     b: 'Archer',      childJob: 'Ranger Knight', grade: 'B', desc: 'Skilled with both sword and bow.' },
  { a: 'Blacksmith', b: 'Mage',        childJob: 'Runesmith',     grade: 'B', desc: 'Inscribes magical runes into weapons.' },
  { a: 'Mage',       b: 'Beast Tamer', childJob: 'Summoner',      grade: 'B', desc: 'Calls magical beasts from the arcane realm.' },

  // ── Tier C ───────────────────────────────────────────────
  { a: 'Archer',     b: 'Beast Tamer', childJob: 'Ranger',        grade: 'C', desc: 'Tracker and hunter of wild lands.' },
  { a: 'Merchant',   b: 'Farmer',      childJob: 'Tycoon',        grade: 'C', desc: 'Turns harvests into enormous wealth.' },
  { a: 'Warrior',    b: 'Archer',      childJob: 'Hunter',        grade: 'C', desc: 'Relentless pursuit — never misses prey.' },
  { a: 'Cleric',     b: 'Farmer',      childJob: 'Tycoon',        grade: 'C', desc: 'A simple but prosperous life.' },

  // ── Tier D (fallback — mismatched vocations) ─────────────
  // All other combinations produce a D-grade child inheriting
  // the weaker parent's job class (handled in getBreedingResult).
];

/**
 * Look up the breeding result for two parent job classes.
 *
 * @param {string} jobA - Gen1 parent A job class
 * @param {string} jobB - Gen1 parent B job class
 * @returns {{ childJob: string, grade: 'S'|'A'|'B'|'C'|'D', bonusPoints: number, desc: string }}
 */
function getBreedingResult(jobA, jobB) {
  const entry = MATRIX.find(
    e => (e.a === jobA && e.b === jobB) || (e.a === jobB && e.b === jobA)
  );

  if (entry) {
    return {
      childJob:    entry.childJob,
      grade:       entry.grade,
      bonusPoints: GRADE_BONUS[entry.grade],
      desc:        entry.desc,
    };
  }

  // D-grade fallback: child inherits the stat-weaker parent's job
  return {
    childJob:    jobB,   // caller can choose which parent
    grade:       'D',
    bonusPoints: GRADE_BONUS['D'],
    desc:        'An ordinary upbringing — potential lies within.',
  };
}

/**
 * Return every possible pairing grade for a given job class.
 * Useful for the UI compatibility preview.
 *
 * @param {string} job - the job class to check against all others
 * @returns {Array<{ partnerJob: string, childJob: string, grade: string }>}
 */
function getCompatibilityFor(job) {
  const GEN1_JOBS = [
    'Monarch', 'Knight', 'Mage', 'Warrior', 'Blacksmith',
    'Archer', 'Cleric', 'Merchant', 'Farmer', 'Beast Tamer',
  ];
  return GEN1_JOBS
    .filter(j => j !== job)
    .map(partnerJob => {
      const r = getBreedingResult(job, partnerJob);
      return { partnerJob, childJob: r.childJob, grade: r.grade };
    })
    .sort((a, b) => 'SABCD'.indexOf(a.grade) - 'SABCD'.indexOf(b.grade));
}

module.exports = { MATRIX, GRADE_BONUS, getBreedingResult, getCompatibilityFor };
