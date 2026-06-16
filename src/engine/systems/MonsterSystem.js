import * as Phaser from "phaser";
import { cartToIso, isInBounds } from '../utils/iso.js';
import { FloatingText } from '../objects/FloatingText.js';

const AGGRO_RADIUS = 96;
const SPAWN_INTERVAL_MS = 30000;

/**
 * Client-side monster spawners and automated combat.
 * Spawns enemies from fixed nodes placed in cleared wilderness.
 */
export class MonsterSystem {
  constructor(scene) {
    this.scene = scene;
    this.state = scene.state;

    this.spawners = scene.add.group();
    this.monsters = scene.add.group();

    this._spawnTimer = null;
  }

  static preloadTextures(scene) {
    const make = (key, color) => {
      const g = scene.make.graphics({ x: 0, y: 0, add: false });
      g.fillStyle(color, 1);
      g.fillCircle(16, 16, 14);
      g.lineStyle(3, 0x1a0a00, 1);
      g.strokeCircle(16, 16, 14);
      g.generateTexture(key, 32, 32);
      g.destroy();
    };
    make('spawner', 0x5a0090);
    make('monster', 0xcc2200);
  }

  /* ── Place spawner nodes in cleared, wild, passable tiles ───────────── */
  seedSpawners(count = 4) {
    this.spawners.clear(true, true);
    const placed = [];

    for (let i = 0; i < count; i++) {
      for (let attempt = 0; attempt < 80; attempt++) {
        const x = Math.floor(Math.random() * 50);
        const y = Math.floor(Math.random() * 50);
        if (!this._isWilderness(x, y)) continue;
        if (placed.some((p) => Math.hypot(p.x - x, p.y - y) < 8)) continue;

        placed.push({ x, y });
        const iso = cartToIso(x, y);
        const node = this.scene.add.sprite(iso.x, iso.y, 'spawner');
        node.setOrigin(0.5, 1);
        node.setDepth(iso.y);
        this.spawners.add(node);
        break;
      }
    }

    if (!this._spawnTimer) {
      this._spawnTimer = this.scene.time.addEvent({
        delay: SPAWN_INTERVAL_MS,
        callback: () => this.spawnMonster(),
        callbackScope: this,
        loop: true,
      });
    }
  }

  _isWilderness(x, y) {
    if (!isInBounds(x, y)) return false;
    if (!this.state.fogData[y][x]) return false; // must be cleared
    if (this.state.mapData[y][x] === 'water') return false;
    if (this.state.isTileBlocked(x, y)) return false;
    // Keep away from the castle area
    const castle = this.state.buildings.find((b) => b.type === 'castle');
    if (castle && Math.hypot(x - castle.tx, y - castle.ty) < 10) return false;
    return true;
  }

  spawnMonster() {
    const nodes = this.spawners.getChildren();
    if (!nodes.length) return;

    const node = nodes[Math.floor(Math.random() * nodes.length)];
    const iso = { x: node.x, y: node.y };

    const monster = this.scene.add.sprite(iso.x, iso.y, 'monster');
    monster.setOrigin(0.5, 1);
    monster.setDepth(iso.y);
    monster.setData('hp', 20 + Math.floor(Math.random() * 15));
    monster.setData('maxHp', monster.getData('hp'));
    monster.setData('atk', 3 + Math.floor(Math.random() * 4));
    this.monsters.add(monster);

    // Bobbing idle animation
    this.scene.tweens.add({
      targets: monster,
      y: iso.y - 4,
      duration: 700,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Instance combat helper used by ResidentSprite
    monster.takeDamage = (amount) => MonsterSystem.damageMonster(monster, amount);
  }

  /* ── Combat pass: distance checks and automated fighting ────────────── */
  update(combatResidents) {
    const monsters = this.monsters.getChildren();
    if (!monsters.length) return;

    for (const monster of monsters) {
      if (!monster.active) continue;

      let closest = null;
      let closestDist = Infinity;

      for (const res of combatResidents) {
        if (!res.active) continue;
        const dist = Phaser.Math.Distance.Between(
          monster.x, monster.y,
          res.x, res.y
        );
        if (dist < AGGRO_RADIUS && dist < closestDist) {
          closest = res;
          closestDist = dist;
        }
      }

      if (closest) {
        closest.enterCombat(monster);
      }
    }
  }

  static damageMonster(monster, amount) {
    if (!monster.active) return;
    const hp = monster.getData('hp') - amount;
    monster.setData('hp', hp);
    if (hp <= 0) {
      new FloatingText(monster.scene, monster.x, monster.y - 20, 'Defeated!', '#50ff70');
      monster.destroy();
    }
  }
}
