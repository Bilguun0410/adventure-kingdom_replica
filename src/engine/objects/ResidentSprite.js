import * as Phaser from "phaser";
import { cartToIso, TILE_HEIGHT, isInBounds } from '../utils/iso.js';
import { FloatingText } from './FloatingText.js';

/** Jobs that will actively engage monsters. */
const COMBAT_JOBS = new Set([
  'Knight', 'Warrior', 'Archer', 'Mage', 'Beast Tamer',
  'Magic Knight', 'Berserker', 'Paladin', 'Holy Mage', 'Dark Knight',
  'Ranger Knight', 'Ranger', 'Hunter', 'Royal Heir',
]);

/**
 * A state-machine resident sprite that walks the isometric kingdom.
 * Extends Container so we can attach a name-tag child easily.
 */
export class ResidentSprite extends Phaser.GameObjects.Container {
  constructor(scene, gridX, gridY, residentData) {
    const iso = cartToIso(gridX, gridY);
    super(scene, iso.x, iso.y);

    this.gridX = gridX;
    this.gridY = gridY;
    this.resident = residentData;
    this.state = 'WANDERING';
    this.combatTarget = null;
    this.attackTimer = 0;
    this.attackCooldown = 1000;
    this.speed = 40; // px / sec

    // Body sprite (placeholder citizen)
    const body = scene.add.sprite(0, -8, 'resident');
    body.setOrigin(0.5, 1);
    this.add(body);
    this.bodySprite = body;

    // Name tag
    const label = scene.add.text(0, -28, residentData.name || 'Resident', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '6px',
      color: '#fff8e7',
      stroke: '#1a0a00',
      strokeThickness: 2,
      resolution: 2,
    });
    label.setOrigin(0.5, 1);
    this.add(label);

    scene.add.existing(this);
    this.setDepth(this.y);
  }

  /* ── Movement ───────────────────────────────────────────────────────── */
  moveTo(gridX, gridY, onArrive) {
    this.gridX = gridX;
    this.gridY = gridY;
    const iso = cartToIso(gridX, gridY);

    if (this.moveTween) this.moveTween.stop();

    const dist = Phaser.Math.Distance.Between(this.x, this.y, iso.x, iso.y);
    const duration = (dist / this.speed) * 1000;

    this.moveTween = this.scene.tweens.add({
      targets: this,
      x: iso.x,
      y: iso.y,
      duration: Math.max(200, duration),
      ease: 'Linear',
      onUpdate: () => {
        this.setDepth(this.y);
      },
      onComplete: () => {
        this.setDepth(this.y);
        if (onArrive) onArrive();
      },
    });
  }

  pickWanderTarget(getPassableNeighbor) {
    if (this.state === 'COMBAT') return;
    const target = getPassableNeighbor(this.gridX, this.gridY);
    if (target) {
      this.state = 'WANDERING';
      this.moveTo(target.x, target.y, () => {
        this.scene.time.delayedCall(
          500 + Math.random() * 1200,
          () => this.pickWanderTarget(getPassableNeighbor)
        );
      });
    } else {
      this.scene.time.delayedCall(800, () =>
        this.pickWanderTarget(getPassableNeighbor)
      );
    }
  }

  /* ── Combat ─────────────────────────────────────────────────────────── */
  isCombatClass() {
    return COMBAT_JOBS.has(this.resident?.jobClass);
  }

  enterCombat(monster) {
    if (!this.isCombatClass()) return false;
    if (this.state === 'COMBAT') return true;

    this.state = 'COMBAT';
    this.combatTarget = monster;
    if (this.moveTween) this.moveTween.stop();
    return true;
  }

  leaveCombat() {
    this.state = 'WANDERING';
    this.combatTarget = null;
    this.attackTimer = 0;
  }

  update(time, delta, getPassableNeighbor) {
    if (this.state !== 'COMBAT') return;

    const target = this.combatTarget;
    if (!target || !target.active) {
      this.leaveCombat();
      this.pickWanderTarget(getPassableNeighbor);
      return;
    }

    this.attackTimer += delta;
    if (this.attackTimer >= this.attackCooldown) {
      this.attackTimer = 0;
      this.attack(target);
    }
  }

  attack(monster) {
    const atk = this.resident?.stats?.atk ?? 5;
    const dmg = Math.max(1, atk + Math.floor(Math.random() * 3) - 1);
    monster.takeDamage(dmg);

    new FloatingText(
      this.scene,
      monster.x,
      monster.y - 16,
      `-${dmg}`,
      '#ff6060'
    );

    // Tiny lunge animation
    this.bodySprite.setScale(1.15, 0.85);
    this.scene.time.delayedCall(100, () => this.bodySprite.setScale(1, 1));
  }

  takeDamage(amount) {
    const hp = (this.resident.stats.hp -= amount);
    new FloatingText(
      this.scene,
      this.x,
      this.y - 16,
      `-${amount}`,
      '#ff4444'
    );
    if (hp <= 0) {
      this.resident.isAlive = false;
      this.destroy();
    }
  }
}

/**
 * Generate the placeholder citizen texture used by all residents.
 */
ResidentSprite.preloadTexture = function (scene) {
  const g = scene.make.graphics({ x: 0, y: 0, add: false });

  // Body
  g.fillStyle(0x4a6fa5, 1);
  g.fillRect(6, 10, 20, 18);
  // Head
  g.fillStyle(0xffdbac, 1);
  g.fillRect(8, 2, 16, 12);
  // Hair
  g.fillStyle(0x4a2c0a, 1);
  g.fillRect(8, 2, 16, 4);
  // Eyes
  g.fillStyle(0x222222, 1);
  g.fillRect(11, 8, 3, 3);
  g.fillRect(18, 8, 3, 3);
  // Outline
  g.lineStyle(2, 0x1a0a00, 1);
  g.strokeRect(6, 2, 20, 26);

  g.generateTexture('resident', 32, 32);
  g.destroy();
};
