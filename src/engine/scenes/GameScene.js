import * as Phaser from "phaser";
import {
  TILE_WIDTH,
  TILE_HEIGHT,
  MAP_SIZE,
  cartToIso,
  isoToCart,
  clamp,
  isInBounds,
} from '../utils/iso.js';
import { KingdomState } from '../state/KingdomState.js';
import { BuildingSystem } from '../systems/BuildingSystem.js';
import { FogOfWar } from '../systems/FogOfWar.js';
import { ResidentSystem } from '../systems/ResidentSystem.js';
import { MonsterSystem } from '../systems/MonsterSystem.js';
import { ResidentSprite } from '../objects/ResidentSprite.js';
import { FloatingText } from '../objects/FloatingText.js';
import { apiPost, apiGet } from '../utils/api.js';

const TERRAIN = {
  DIRT: { key: 'dirt', color: 0xB59263 },
  GRASS: { key: 'grass', color: 0x4CA64C },
  WATER: { key: 'water', color: 0x1D70B8 },
};

/**
 * Core isometric kingdom scene.
 *
 * Integrates native Phaser 3 systems:
 *  - isometric tile map rendering with depth sorting
 *  - building placement / demolition
 *  - state-machine resident sprites
 *  - fog-of-war layer
 *  - monster spawners and automated combat
 */
export class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
  }

  /* ── Preload: generate all placeholder textures ─────────────────────── */
  preload() {
    this._createIsoTexture(TERRAIN.DIRT.key, TERRAIN.DIRT.color);
    this._createIsoTexture(TERRAIN.GRASS.key, TERRAIN.GRASS.color);
    this._createIsoTexture(TERRAIN.WATER.key, TERRAIN.WATER.color);

    BuildingSystem.preloadTextures(this);
    FogOfWar.preloadTexture(this);
    ResidentSprite.preloadTexture(this);
    MonsterSystem.preloadTextures(this);
  }

  _createIsoTexture(key, color) {
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(color, 1);
    g.beginPath();
    g.moveTo(TILE_WIDTH / 2, 0);
    g.lineTo(TILE_WIDTH, TILE_HEIGHT / 2);
    g.lineTo(TILE_WIDTH / 2, TILE_HEIGHT);
    g.lineTo(0, TILE_HEIGHT / 2);
    g.closePath();
    g.fillPath();
    g.lineStyle(1, 0x000000, 0.2);
    g.strokePath();
    g.generateTexture(key, TILE_WIDTH, TILE_HEIGHT);
    g.destroy();
  }

  /* ── Create: boot state, render map, init subsystems ────────────────── */
  create() {
    this.state = new KingdomState();
    this.state.generateMap();

    this.mapOffset = { x: 0, y: 0 };
    this.hoverGrid = null;
    this.tick = 0;

    this._renderMap();
    this._setupCamera();

    this.buildingSystem = new BuildingSystem(this);
    this.fogOfWar = new FogOfWar(this);
    this.residentSystem = new ResidentSystem(this);
    this.monsterSystem = new MonsterSystem(this);

    this._setupInput();
    this._setupUIEvents();

    // Free starting castle in the centre of the kingdom
    if (!this.state.buildings.some((b) => b.type === 'castle')) {
      this.buildingSystem.placeBuilding('castle', 25, 25);
    }
    this.fogOfWar.clearFogArea(25, 25, 5);

    // Day ticker (every 3 seconds)
    this.time.addEvent({
      delay: 3000,
      callback: this._gameTick,
      callbackScope: this,
      loop: true,
    });

    // Try to create or resume a backend save
    this._initSave();
  }

  _renderMap() {
    this.tileSprites = [];
    for (let y = 0; y < MAP_SIZE; y++) {
      for (let x = 0; x < MAP_SIZE; x++) {
        const terrain = this.state.mapData[y][x];
        const iso = cartToIso(x, y);
        const sx = iso.x + this.mapOffset.x;
        const sy = iso.y + this.mapOffset.y;

        const sprite = this.add.sprite(sx, sy, terrain);
        sprite.setOrigin(0.5, 0.5);
        sprite.setDepth(sy);
        sprite.setData('grid', { x, y });
        this.tileSprites.push(sprite);
      }
    }
  }

  _setupCamera() {
    const camera = this.cameras.main;
    const halfW = TILE_WIDTH / 2;
    const halfH = TILE_HEIGHT / 2;

    const minIso = cartToIso(0, MAP_SIZE - 1);
    const maxIso = cartToIso(MAP_SIZE - 1, 0);
    const maxYIso = cartToIso(MAP_SIZE - 1, MAP_SIZE - 1);

    camera.setBounds(
      minIso.x - halfW,
      -halfH,
      maxIso.x - minIso.x + TILE_WIDTH,
      maxYIso.y + TILE_HEIGHT
    );
    camera.centerOn(0, maxYIso.y / 2);
    camera.setZoom(1);
    camera.setBackgroundColor('#1c0e05');
  }

  /* ── Input: drag pan + hover ghost + tile tap ───────────────────────── */
  _setupInput() {
    this.isDragging = false;
    this.dragThreshold = 6;
    this.lastPointer = { x: 0, y: 0 };

    this.input.on('pointerdown', (pointer) => {
      this.isDragging = false;
      this.lastPointer.x = pointer.x;
      this.lastPointer.y = pointer.y;
    });

    this.input.on('pointermove', (pointer) => {
      this._updateHover(pointer);

      if (!pointer.isDown) return;
      const dist = Phaser.Math.Distance.Between(
        pointer.downX,
        pointer.downY,
        pointer.x,
        pointer.y
      );
      if (dist > this.dragThreshold) this.isDragging = true;

      if (this.isDragging) {
        const camera = this.cameras.main;
        camera.scrollX +=
          (this.lastPointer.x - pointer.x) / camera.zoom;
        camera.scrollY +=
          (this.lastPointer.y - pointer.y) / camera.zoom;
        this.lastPointer.x = pointer.x;
        this.lastPointer.y = pointer.y;
      }
    });

    this.input.on('pointerup', (pointer) => {
      if (!this.isDragging) {
        const grid = this._screenToGrid(pointer.upX, pointer.upY);
        this._handleGridTap(grid.x, grid.y);
      }
      this.isDragging = false;
    });
  }

  _updateHover(pointer) {
    const grid = this._screenToGrid(pointer.x, pointer.y);
    if (!isInBounds(grid.x, grid.y)) {
      this.hoverGrid = null;
      this.buildingSystem.updateGhost(-1, -1);
      return;
    }
    this.hoverGrid = grid;
    this.buildingSystem.updateGhost(grid.x, grid.y);
  }

  _screenToGrid(screenX, screenY) {
    const worldPoint = this.cameras.main.getWorldPoint(screenX, screenY);
    const cart = isoToCart(
      worldPoint.x - this.mapOffset.x,
      worldPoint.y - this.mapOffset.y
    );
    return {
      x: clamp(cart.x, 0, MAP_SIZE - 1),
      y: clamp(cart.y, 0, MAP_SIZE - 1),
    };
  }

  _handleGridTap(gx, gy) {
    if (this.buildingSystem.selectedBuildType) {
      this.buildingSystem.placeBuilding(this.buildingSystem.selectedBuildType, gx, gy);
      return;
    }
    if (this.buildingSystem.demolishMode) {
      this.buildingSystem.demolishAt(gx, gy);
      return;
    }

    // Explore mode: inspect building and clear nearby fog
    this.buildingSystem.selectBuilding(gx, gy);
    this.fogOfWar.clearFogArea(gx, gy, 2);
  }

  /* ── UI event bridge ────────────────────────────────────────────────── */
  _setupUIEvents() {
    window.addEventListener('build-select', (e) => {
      this.buildingSystem.selectBuild(e.detail);
    });
    window.addEventListener('demolish-toggle', () => {
      this.buildingSystem.toggleDemolish();
    });
    window.addEventListener('cancel-build', () => {
      this.buildingSystem.clearMode();
    });
    window.addEventListener('save-game', () => this.saveGame());
    window.addEventListener('load-game', () => this.loadGame());

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.buildingSystem.clearMode();
    });
  }

  /* ── Save / load integration ────────────────────────────────────────── */
  async _initSave() {
    // Optional: resume from localStorage fallback
    const local = localStorage.getItem('ak_save');
    if (local) {
      try {
        const data = JSON.parse(local);
        this.state.loadSave(data);
        this._rebuildAfterLoad();
        return;
      } catch {}
    }

    // Create a fresh backend save
    await this.saveGame(true);
  }

  _rebuildAfterLoad() {
    // Re-render terrain if tile set changed
    this.tileSprites.forEach((s) => s.destroy());
    this._renderMap();

    this.buildingSystem.loadBuildings(this.state.buildings);
    this.fogOfWar.buildFromState();
    this.monsterSystem.seedSpawners();
    this.residentSystem.loadResidents();
  }

  async saveGame(isFirst = false) {
    const payload = {
      name: `Day ${this.state.day} Kingdom`,
      resources: this.state.resources,
      day: this.state.day,
      happiness: this.state.happiness,
      defense: this.state.defense,
      population: this.state.population,
      maxPop: this.state.maxPop,
      mapSize: { width: MAP_SIZE, height: MAP_SIZE },
      tiles: this.state.toSparseTiles(),
      buildings: this.state.buildings.map(({ sprite, ...b }) => b),
      fog: this.state.toSparseFog(),
    };

    try {
      const save = isFirst
        ? await apiPost('/saves', payload)
        : await apiPost('/save-map', {
            saveId: this.state.saveId,
            tiles: payload.tiles,
            buildings: payload.buildings,
            fog: payload.fog,
          });

      if (isFirst) this.state.saveId = save._id;
      this._emitLog(`Saved kingdom (Day ${this.state.day}).`, 'good');

      this.residentSystem.loadResidents();
      this.monsterSystem.seedSpawners();
    } catch (e) {
      localStorage.setItem('ak_save', JSON.stringify(payload));
      this._emitLog('Server offline — saved locally.', 'info');
    }
  }

  async loadGame() {
    try {
      const saves = await apiGet('/saves');
      if (!saves.length) {
        this._emitLog('No saves found.', 'bad');
        return;
      }
      const latest = saves[0];
      const full = await apiGet(`/saves/${latest._id}`);
      this.state.loadSave(full);
      this._rebuildAfterLoad();
      this._emitLog(`Loaded ${full.name || 'kingdom'}.`, 'good');
    } catch (e) {
      this._emitLog(`Load failed: ${e.message}`, 'bad');
    }
  }

  /* ── Economy tick (replaces old gameTick) ───────────────────────────── */
  _gameTick() {
    this.tick++;
    this.state.day++;
    this.state.recalc();

    // Income
    if (this.state._goldRate > 0) {
      this.state.resources.gold += this.state._goldRate;
      const goldBuildings = this.state.buildings.filter(
        (b) => (b.prod?.gold || 0) > 0
      );
      if (goldBuildings.length) {
        const b = goldBuildings[Math.floor(Math.random() * goldBuildings.length)];
        const iso = cartToIso(b.tx, b.ty);
        new FloatingText(this, iso.x, iso.y, `+${this.state._goldRate}g`, '#f0c060');
      }
      this._emitLog(`Day ${this.state.day}: +${this.state._goldRate} gold`, 'info');
    }

    if (this.state._foodRate > 0) {
      this.state.resources.food = Math.min(999, this.state.resources.food + this.state._foodRate);
    }

    // Population growth
    if (this.state.population < this.state.maxPop && this.state.resources.food >= 0) {
      this.state.population = Math.min(this.state.maxPop, this.state.population + 1);
      this._emitLog(`Citizens grew to ${this.state.population}`, 'good');
    }

    this.residentSystem._syncSprites();
    this._emitResources();
  }

  /* ── Lifecycle ──────────────────────────────────────────────────────── */
  update(time, delta) {
    this.residentSystem.update(time, delta);
    this.monsterSystem.update(this.residentSystem.getCombatResidents());
  }

  /* ── UI helpers ─────────────────────────────────────────────────────── */
  _emitResources() {
    window.dispatchEvent(
      new CustomEvent('resources-change', { detail: this.state.resources })
    );
    window.dispatchEvent(
      new CustomEvent('population-change', {
        detail: { pop: this.state.population, maxPop: this.state.maxPop },
      })
    );
    window.dispatchEvent(
      new CustomEvent('day-change', { detail: this.state.day })
    );
  }

  _emitLog(msg, type = 'info') {
    window.dispatchEvent(new CustomEvent('game-log', { detail: { msg, type } }));
  }
}
