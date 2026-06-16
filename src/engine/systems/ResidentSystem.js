import { ResidentSprite } from '../objects/ResidentSprite.js';
import { MAP_SIZE, isInBounds } from '../utils/iso.js';
import { apiGet } from '../utils/api.js';

/**
 * Manages the visual resident sprites on the isometric map.
 * Keeps backend resident records in sync and caps visible walkers at 20.
 */
export class ResidentSystem {
  constructor(scene) {
    this.scene = scene;
    this.state = scene.state;
    this.sprites = [];
    this.maxVisible = 20;
  }

  /* ── Load residents from backend and spawn sprites ──────────────────── */
  async loadResidents() {
    if (!this.state.saveId) return;
    try {
      const residents = await apiGet(`/residents?saveId=${this.state.saveId}`);
      this.state.residents = residents.filter((r) => r.isAlive !== false);
      this._syncSprites();
    } catch (e) {
      console.warn('Could not load residents:', e.message);
    }
  }

  /* ── Spawn a new resident sprite from a backend record ──────────────── */
  addResident(resident) {
    this.state.residents.push(resident);
    this._syncSprites();
  }

  _syncSprites() {
    // Reconcile: keep existing, add new, cap at maxVisible
    const alive = this.state.residents.filter((r) => r.isAlive !== false);
    const target = alive.slice(0, this.maxVisible);

    // Simple approach: destroy all and respawn (fine for <= 20)
    this.sprites.forEach((s) => s.destroy());
    this.sprites = [];

    for (const r of target) {
      const pos = this._findSpawnTile();
      if (!pos) break;
      const sprite = new ResidentSprite(this.scene, pos.x, pos.y, r);
      sprite.pickWanderTarget((gx, gy) => this._getPassableNeighbor(gx, gy));
      this.sprites.push(sprite);
    }
  }

  _findSpawnTile() {
    // Prefer near the castle if one exists
    const castle = this.state.buildings.find((b) => b.type === 'castle');
    const center = castle ? { x: castle.tx, y: castle.ty } : { x: 25, y: 25 };

    for (let i = 0; i < 30; i++) {
      const x = center.x + Math.floor(Math.random() * 9) - 4;
      const y = center.y + Math.floor(Math.random() * 9) - 4;
      if (isInBounds(x, y) && !this.state.isTileBlocked(x, y)) {
        return { x, y };
      }
    }
    return null;
  }

  _getPassableNeighbor(gx, gy) {
    const candidates = [];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const x = gx + dx;
        const y = gy + dy;
        if (isInBounds(x, y) && !this.state.isTileBlocked(x, y)) {
          candidates.push({ x, y });
        }
      }
    }
    if (!candidates.length) return null;
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  getCombatResidents() {
    return this.sprites.filter((s) => s.isCombatClass() && s.active);
  }

  update(time, delta) {
    for (const sprite of this.sprites) {
      if (sprite.active) {
        sprite.update(time, delta, (gx, gy) =>
          this._getPassableNeighbor(gx, gy)
        );
      }
    }
  }
}
