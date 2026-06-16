import { BDEF } from '../data/buildings.js';
import { MAP_SIZE } from '../utils/iso.js';

/**
 * Central game state object that replaces the legacy flat `S` object.
 */
export class KingdomState {
  constructor() {
    this.saveId = null;

    this.resources = { gold: 99999, food: 10, silverCoins: 0, copperCoins: 0 };
    this.population = 0;
    this.maxPop = 0;
    this.happiness = 50;
    this.defense = 0;
    this.day = 1;

    this.mapData = []; // [y][x] => 'grass' | 'water' | 'dirt'
    this.fogData = []; // [y][x] => true (clear) | false (fogged)
    this.buildings = [];
    this.residents = [];

    this._goldRate = 0;
    this._foodRate = 0;

    this._initArrays();
  }

  _initArrays() {
    this.mapData = [];
    this.fogData = [];
    for (let y = 0; y < MAP_SIZE; y++) {
      const row = [];
      const fogRow = [];
      for (let x = 0; x < MAP_SIZE; x++) {
        row.push('grass');
        fogRow.push(false);
      }
      this.mapData.push(row);
      this.fogData.push(fogRow);
    }
  }

  /* ── Map generation / loading ───────────────────────────────────────── */
  generateMap() {
    this._initArrays();
    for (let y = 0; y < MAP_SIZE; y++) {
      for (let x = 0; x < MAP_SIZE; x++) {
        const d1 = Math.hypot(x - 8, y - 8);
        const d2 = Math.hypot(x - 40, y - 38);
        const d3 = Math.hypot(x - 14, y - 42);
        if (d1 < 5 || d2 < 6 || d3 < 5) {
          this.mapData[y][x] = 'water';
        } else if (Math.random() > 0.82) {
          this.mapData[y][x] = 'dirt';
        }
      }
    }
  }

  loadSave(save) {
    this.saveId = save._id ?? null;
    this.resources = save.resources ?? {
      gold: save.gold ?? 99999,
      food: save.food ?? 10,
      silverCoins: 0,
      copperCoins: 0,
    };
    this.population = save.population ?? save.pop ?? 0;
    this.maxPop = save.maxPop ?? 0;
    this.happiness = save.happiness ?? save.hap ?? 50;
    this.defense = save.defense ?? 0;
    this.day = save.day ?? 1;

    this.buildings = save.buildings ?? [];

    // Apply sparse tiles onto the default grass map
    this._initArrays();
    if (Array.isArray(save.tiles)) {
      for (const t of save.tiles) {
        if (t.y >= 0 && t.y < MAP_SIZE && t.x >= 0 && t.x < MAP_SIZE) {
          this.mapData[t.y][t.x] = t.type;
        }
      }
    }

    // Apply sparse fog (true = cleared)
    if (Array.isArray(save.fog)) {
      for (const f of save.fog) {
        if (f.y >= 0 && f.y < MAP_SIZE && f.x >= 0 && f.x < MAP_SIZE) {
          this.fogData[f.y][f.x] = true;
        }
      }
    }

    this.recalc();
  }

  toSparseTiles() {
    const tiles = [];
    for (let y = 0; y < MAP_SIZE; y++) {
      for (let x = 0; x < MAP_SIZE; x++) {
        if (this.mapData[y][x] !== 'grass') {
          tiles.push({ x, y, type: this.mapData[y][x] });
        }
      }
    }
    return tiles;
  }

  toSparseFog() {
    const fog = [];
    for (let y = 0; y < MAP_SIZE; y++) {
      for (let x = 0; x < MAP_SIZE; x++) {
        if (this.fogData[y][x]) fog.push({ x, y });
      }
    }
    return fog;
  }

  /* ── Economy recalculation (ported from legacy recalc) ──────────────── */
  recalc() {
    let maxPop = 0;
    let hap = 50;
    let def = 0;
    let gr = 0;
    let fr = 0;

    for (const b of this.buildings) {
      const d = BDEF[b.type];
      if (!d) continue;
      maxPop += d.pop || 0;
      hap += d.hap || 0;
      def += d.prod.defense || 0;
      gr += d.prod.gold || 0;
      fr += d.prod.food || 0;
    }

    if (this.resources.food < 0) hap = Math.max(0, hap - 15);

    this.maxPop = maxPop;
    this.population = Math.min(this.population, this.maxPop);
    this.happiness = Math.min(100, Math.max(0, hap));
    this.defense = def;
    this._goldRate = gr;
    this._foodRate = fr;
  }

  /* ── Helpers ────────────────────────────────────────────────────────── */
  isTileBlocked(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= MAP_SIZE || ty >= MAP_SIZE) return true;
    if (this.mapData[ty][tx] === 'water') return true;
    return this.buildings.some((b) => {
      const d = BDEF[b.type];
      return (
        tx >= b.tx &&
        tx < b.tx + d.size[0] &&
        ty >= b.ty &&
        ty < b.ty + d.size[1]
      );
    });
  }
}
