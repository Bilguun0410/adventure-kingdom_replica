import * as Phaser from "phaser";

import {
  TILE_WIDTH,
  TILE_HEIGHT,
  MAP_SIZE,
  cartToIso,
  isoToCart,
  clamp,
} from "../utils/iso.js";

const TERRAIN = {
  DIRT: { key: "dirt", color: 0xb59263 },
  GRASS: { key: "grass", color: 0x4ca64c },
  WATER: { key: "water", color: 0x1d70b8 },
};

/**
 * Core isometric kingdom scene.
 *
 * Renders a 50×50 tile map using a 2:1 diamond projection,
 * sets sprite depth by screen Y for correct overlap, and supports
 * click-drag panning + tile-tap selection.
 */
export class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: "GameScene" });
  }

  /* ── Preload: generate placeholder iso diamond textures ─────────────── */
  preload() {
    this._createIsoTexture(TERRAIN.DIRT.key, TERRAIN.DIRT.color);
    this._createIsoTexture(TERRAIN.GRASS.key, TERRAIN.GRASS.color);
    this._createIsoTexture(TERRAIN.WATER.key, TERRAIN.WATER.color);
  }

  _createIsoTexture(key, color) {
    const g = this.make.graphics({ x: 0, y: 0, add: false });

    // Fill the diamond shape
    g.fillStyle(color, 1);
    g.beginPath();
    g.moveTo(TILE_WIDTH / 2, 0);
    g.lineTo(TILE_WIDTH, TILE_HEIGHT / 2);
    g.lineTo(TILE_WIDTH / 2, TILE_HEIGHT);
    g.lineTo(0, TILE_HEIGHT / 2);
    g.closePath();
    g.fillPath();

    // Subtle outline for tile definition
    g.lineStyle(1, 0x000000, 0.2);
    g.strokePath();

    g.generateTexture(key, TILE_WIDTH, TILE_HEIGHT);
    g.destroy();
  }

  /* ── Create: build the map, camera and input ────────────────────────── */
  create() {
    this.mapData = this._generateMap(MAP_SIZE);
    this.mapOffset = { x: 0, y: 0 };

    this._renderMap();
    this._setupCamera();
    this._setupInput();
  }

  _generateMap(size) {
    const map = [];
    for (let y = 0; y < size; y++) {
      const row = [];
      for (let x = 0; x < size; x++) {
        const r = Math.random();
        let type = TERRAIN.GRASS.key;
        if (r > 0.78) {
          type = TERRAIN.WATER.key;
        } else if (r > 0.55) {
          type = TERRAIN.DIRT.key;
        }
        row.push(type);
      }
      map.push(row);
    }
    return map;
  }

  _renderMap() {
    this.tileSprites = [];
    const size = this.mapData.length;

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const terrain = this.mapData[y][x];
        const iso = cartToIso(x, y);
        const sx = iso.x + this.mapOffset.x;
        const sy = iso.y + this.mapOffset.y;

        const sprite = this.add.sprite(sx, sy, terrain);
        sprite.setOrigin(0.5, 0.5);
        sprite.setDepth(sy);
        sprite.setData("grid", { x, y });

        this.tileSprites.push(sprite);
      }
    }
  }

  _setupCamera() {
    const camera = this.cameras.main;
    const halfW = TILE_WIDTH / 2;
    const halfH = TILE_HEIGHT / 2;

    // World-space bounds that contain the whole iso map
    const minIso = cartToIso(0, MAP_SIZE - 1); // top-left-most
    const maxIso = cartToIso(MAP_SIZE - 1, 0); // top-right-most
    const maxYIso = cartToIso(MAP_SIZE - 1, MAP_SIZE - 1); // bottom-most

    const boundsX = minIso.x - halfW;
    const boundsY = -halfH;
    const boundsW = maxIso.x - minIso.x + TILE_WIDTH;
    const boundsH = maxYIso.y + TILE_HEIGHT;

    camera.setBounds(boundsX, boundsY, boundsW, boundsH);
    camera.centerOn(0, maxYIso.y / 2);
    camera.setZoom(1);
    camera.setBackgroundColor("#1c0e05");
  }

  /* ── Input: drag-to-pan + clean tap-to-select ───────────────────────── */
  _setupInput() {
    this.isDragging = false;
    this.dragThreshold = 6;
    this.lastPointer = { x: 0, y: 0 };

    this.input.on("pointerdown", (pointer) => {
      this.isDragging = false;
      this.lastPointer.x = pointer.x;
      this.lastPointer.y = pointer.y;
    });

    this.input.on("pointermove", (pointer) => {
      if (!pointer.isDown) return;

      const dist = Phaser.Math.Distance.Between(
        pointer.downX,
        pointer.downY,
        pointer.x,
        pointer.y,
      );

      if (dist > this.dragThreshold) {
        this.isDragging = true;
      }

      if (this.isDragging) {
        const camera = this.cameras.main;
        const dx = (this.lastPointer.x - pointer.x) / camera.zoom;
        const dy = (this.lastPointer.y - pointer.y) / camera.zoom;

        camera.scrollX += dx;
        camera.scrollY += dy;

        this.lastPointer.x = pointer.x;
        this.lastPointer.y = pointer.y;
      }
    });

    this.input.on("pointerup", (pointer) => {
      if (!this.isDragging) {
        this._handleTileTap(pointer);
      }
      this.isDragging = false;
    });
  }

  _handleTileTap(pointer) {
    const camera = this.cameras.main;
    const worldPoint = camera.getWorldPoint(pointer.upX, pointer.upY);

    const isoX = worldPoint.x - this.mapOffset.x;
    const isoY = worldPoint.y - this.mapOffset.y;

    const cart = isoToCart(isoX, isoY);
    const gx = clamp(cart.x, 0, MAP_SIZE - 1);
    const gy = clamp(cart.y, 0, MAP_SIZE - 1);

    console.log(
      `Tile tapped → grid[${gx}, ${gy}] terrain=${this.mapData[gy][gx]}`,
    );
  }
}
