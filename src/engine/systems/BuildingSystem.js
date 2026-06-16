import * as Phaser from "phaser";
import { BDEF } from '../data/buildings.js';
import {
  cartToIso,
  footprintCenterIso,
  isInBounds,
  forFootprint,
} from '../utils/iso.js';
import { saveMapPayload } from '../utils/api.js';
import { FloatingText } from '../objects/FloatingText.js';

/**
 * Native Phaser 3 replacement for the legacy canvas building placement.
 * Handles selection, validation, placement, demolition and rendering.
 */
export class BuildingSystem {
  constructor(scene) {
    this.scene = scene;
    this.state = scene.state;

    this.group = scene.add.group();
    this.ghost = null;
    this.selectedBuildType = null;
    this.demolishMode = false;
    this.selectedBuildingId = null;

    this._createGhost();
  }

  /* ── Textures ───────────────────────────────────────────────────────── */
  static preloadTextures(scene) {
    Object.values(BDEF).forEach((d) => {
      const g = scene.make.graphics({ x: 0, y: 0, add: false });

      // Main block
      g.fillStyle(d.color, 1);
      g.fillRect(12, 8, 40, 40);

      // Roof / highlight
      g.fillStyle(0xffffff, 0.25);
      g.fillRect(12, 8, 40, 8);

      // Outline
      g.lineStyle(2, 0x1a0a00, 1);
      g.strokeRect(12, 8, 40, 40);

      // Initial letter for readability
      g.fillStyle(0xffffff, 0.9);
      g.fillRect(26, 22, 12, 12);

      g.generateTexture(d.id, 64, 64);
      g.destroy();
    });
  }

  /* ── State transitions ──────────────────────────────────────────────── */
  selectBuild(type) {
    this.selectedBuildType = type;
    this.demolishMode = false;
    this.selectedBuildingId = null;
    this._updateGhostTexture();
    this._emitMode(`Place ${BDEF[type].name}`);
  }

  toggleDemolish() {
    this.demolishMode = !this.demolishMode;
    this.selectedBuildType = null;
    this.selectedBuildingId = null;
    this._hideGhost();
    this._emitMode(this.demolishMode ? 'Demolish' : 'Explore');
  }

  clearMode() {
    this.selectedBuildType = null;
    this.demolishMode = false;
    this.selectedBuildingId = null;
    this._hideGhost();
    this._emitMode('Explore');
  }

  /* ── Placement validation ───────────────────────────────────────────── */
  canPlace(type, tx, ty) {
    const d = BDEF[type];
    const [sw, sh] = d.size;

    if (!isInBounds(tx, ty) || !isInBounds(tx + sw - 1, ty + sh - 1))
      return false;

    let blocked = false;
    forFootprint(tx, ty, sw, sh, (x, y) => {
      if (this.state.mapData[y][x] === 'water') blocked = true;
    });
    if (blocked) return false;

    for (const b of this.state.buildings) {
      const bd = BDEF[b.type];
      const [bw, bh] = bd.size;
      if (
        tx < b.tx + bw &&
        tx + sw > b.tx &&
        ty < b.ty + bh &&
        ty + sh > b.ty
      )
        return false;
    }
    return true;
  }

  placeBuilding(type, tx, ty) {
    const d = BDEF[type];
    if (this.state.resources.gold < d.cost) {
      this._log(`Need ${d.cost}g for ${d.name}!`, 'bad');
      return false;
    }
    if (d.unique && this.state.buildings.some((b) => b.type === type)) {
      this._log(`Only one ${d.name} allowed!`, 'bad');
      return false;
    }
    if (!this.canPlace(type, tx, ty)) {
      this._log("Can't place here!", 'bad');
      return false;
    }

    this.state.resources.gold -= d.cost;
    const building = {
      id: Date.now() + Math.floor(Math.random() * 9999),
      type,
      tx,
      ty,
    };
    this.state.buildings.push(building);

    this._createBuildingSprite(building);
    this.state.recalc();
    this._emitResources();
    this._log(
      `Built ${d.name}${d.cost > 0 ? ' (-' + d.cost + 'g)' : ''}!`,
      'good'
    );

    if (d.hap > 0) {
      const iso = cartToIso(tx, ty);
      new FloatingText(this.scene, iso.x, iso.y, `+${d.hap}😊`, '#80ff80');
    }

    this._save();
    return true;
  }

  demolishAt(tx, ty) {
    const hit = this.findBuilding(tx, ty);
    if (!hit) return;

    if (hit.type === 'castle') {
      this._log('Cannot demolish the Castle!', 'bad');
      return;
    }

    const d = BDEF[hit.type];
    const refund = Math.floor(d.cost * 0.5);
    this.state.resources.gold += refund;

    const idx = this.state.buildings.findIndex((b) => b.id === hit.id);
    if (idx >= 0) this.state.buildings.splice(idx, 1);

    if (hit.sprite) {
      hit.sprite.destroy();
    }

    this.state.recalc();
    this._emitResources();
    this._log(`Demolished ${d.name}. +${refund}g refund.`, 'bad');
    this._save();
  }

  selectBuilding(tx, ty) {
    const hit = this.findBuilding(tx, ty);
    if (!hit) {
      this.selectedBuildingId = null;
      window.dispatchEvent(new CustomEvent('building-info', { detail: null }));
      return;
    }
    this.selectedBuildingId = hit.id;
    const d = BDEF[hit.type];
    const prod =
      Object.entries(d.prod)
        .map(([k, v]) => `+${v} ${k}`)
        .join(', ') || 'None';
    window.dispatchEvent(
      new CustomEvent('building-info', {
        detail: {
          name: d.name,
          desc: d.desc,
          cost: d.cost,
          prod,
          pop: d.pop,
          hap: d.hap,
          tile: `(${hit.tx}, ${hit.ty})`,
        },
      })
    );
  }

  findBuilding(tx, ty) {
    return this.state.buildings.find((b) => {
      const d = BDEF[b.type];
      return (
        tx >= b.tx &&
        tx < b.tx + d.size[0] &&
        ty >= b.ty &&
        ty < b.ty + d.size[1]
      );
    });
  }

  /* ── Rendering from loaded state ────────────────────────────────────── */
  loadBuildings(buildings) {
    this.group.clear(true, true);
    this.state.buildings = buildings || [];
    this.state.buildings.forEach((b) => this._createBuildingSprite(b));
    this.state.recalc();
    this._emitResources();
  }

  _createBuildingSprite(b) {
    const d = BDEF[b.type];
    const iso = footprintCenterIso(b.tx, b.ty, d.size[0], d.size[1]);
    const sprite = this.scene.add.sprite(iso.x, iso.y, d.id);
    sprite.setOrigin(0.5, 1);
    sprite.setDepth(iso.y);
    sprite.setData('buildingId', b.id);
    this.group.add(sprite);
    b.sprite = sprite;
    return sprite;
  }

  /* ── Placement ghost ────────────────────────────────────────────────── */
  _createGhost() {
    this.ghost = this.scene.add.sprite(0, 0, 'house');
    this.ghost.setOrigin(0.5, 1);
    this.ghost.setAlpha(0.65);
    this.ghost.setVisible(false);
    this.ghost.setDepth(100000);
  }

  _updateGhostTexture() {
    if (!this.selectedBuildType || !this.ghost) return;
    this.ghost.setTexture(this.selectedBuildType);
  }

  _hideGhost() {
    if (this.ghost) this.ghost.setVisible(false);
  }

  updateGhost(gridX, gridY) {
    if (!this.selectedBuildType || !this.ghost) {
      this._hideGhost();
      return;
    }
    const d = BDEF[this.selectedBuildType];
    const iso = footprintCenterIso(gridX, gridY, d.size[0], d.size[1]);
    this.ghost.setPosition(iso.x, iso.y);
    this.ghost.setVisible(true);

    const ok = this.canPlace(this.selectedBuildType, gridX, gridY);
    this.ghost.setTint(ok ? 0x88ff88 : 0xff6666);
  }

  /* ── Persistence ────────────────────────────────────────────────────── */
  async _save() {
    if (!this.state.saveId) return;
    try {
      await saveMapPayload(this.state.saveId, {
        tiles: this.state.toSparseTiles(),
        buildings: this.state.buildings.map(({ sprite, ...b }) => b),
        fog: this.state.toSparseFog(),
      });
    } catch (e) {
      console.warn('Map save failed:', e.message);
    }
  }

  /* ── UI event helpers ───────────────────────────────────────────────── */
  _emitMode(mode) {
    window.dispatchEvent(new CustomEvent('mode-change', { detail: mode }));
  }

  _emitResources() {
    window.dispatchEvent(
      new CustomEvent('resources-change', { detail: this.state.resources })
    );
    window.dispatchEvent(
      new CustomEvent('population-change', {
        detail: { pop: this.state.population, maxPop: this.state.maxPop },
      })
    );
  }

  _log(msg, type = 'info') {
    window.dispatchEvent(new CustomEvent('game-log', { detail: { msg, type } }));
  }
}
