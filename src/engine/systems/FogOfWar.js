import * as Phaser from "phaser";
import { cartToIso, MAP_SIZE, isInBounds } from '../utils/iso.js';
import { saveMapPayload } from '../utils/api.js';

/**
 * Native Phaser 3 fog-of-war layer.
 * Each fogged tile is an isometric diamond sprite in a Group.
 */
export class FogOfWar {
  constructor(scene) {
    this.scene = scene;
    this.state = scene.state;
    this.group = scene.add.group();
    this.sprites = new Map(); // key: "x,y" => sprite
  }

  static preloadTexture(scene) {
    const g = scene.make.graphics({ x: 0, y: 0, add: false });

    // Dark semi-transparent diamond
    g.fillStyle(0x0a0500, 0.82);
    g.beginPath();
    g.moveTo(32, 0);
    g.lineTo(64, 16);
    g.lineTo(32, 32);
    g.lineTo(0, 16);
    g.closePath();
    g.fillPath();

    g.generateTexture('fog', 64, 32);
    g.destroy();
  }

  /* ── Build overlay from current state.fogData ───────────────────────── */
  buildFromState() {
    this.group.clear(true, true);
    this.sprites.clear();

    for (let y = 0; y < MAP_SIZE; y++) {
      for (let x = 0; x < MAP_SIZE; x++) {
        if (!this.state.fogData[y][x]) {
          this._addFogTile(x, y);
        }
      }
    }
  }

  _addFogTile(x, y) {
    const iso = cartToIso(x, y);
    const sprite = this.scene.add.sprite(iso.x, iso.y, 'fog');
    sprite.setOrigin(0.5, 0.5);
    sprite.setDepth(iso.y + 2000); // above terrain, below UI
    this.group.add(sprite);
    this.sprites.set(`${x},${y}`, sprite);
  }

  /* ── Reveal a circular area centred on grid tile ────────────────────── */
  clearFogArea(gridX, gridY, radius = 3) {
    const toClear = [];

    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (dx * dx + dy * dy > radius * radius) continue;
        const x = gridX + dx;
        const y = gridY + dy;
        if (!isInBounds(x, y)) continue;
        if (this.state.fogData[y][x]) continue; // already clear
        toClear.push({ x, y });
      }
    }

    if (!toClear.length) return;

    for (const { x, y } of toClear) {
      this.state.fogData[y][x] = true;
      const key = `${x},${y}`;
      const sprite = this.sprites.get(key);
      if (!sprite) continue;

      this.scene.tweens.add({
        targets: sprite,
        alpha: 0,
        duration: 450,
        ease: 'Sine.easeOut',
        onComplete: () => {
          sprite.destroy();
          this.sprites.delete(key);
        },
      });
    }

    this._save();
  }

  async _save() {
    if (!this.state.saveId) return;
    try {
      await saveMapPayload(this.state.saveId, {
        tiles: this.state.toSparseTiles(),
        buildings: this.state.buildings.map(({ sprite, ...b }) => b),
        fog: this.state.toSparseFog(),
      });
    } catch (e) {
      console.warn('Fog save failed:', e.message);
    }
  }
}
