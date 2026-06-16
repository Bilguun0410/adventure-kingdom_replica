import * as Phaser from "phaser";

/**
 * Replaces the legacy particle-text system.
 * Creates a short-lived text label that floats upward and fades out.
 */
export class FloatingText extends Phaser.GameObjects.Text {
  constructor(scene, x, y, text, color = '#f0c060') {
    super(scene, x, y, text, {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '8px',
      color,
      resolution: 2,
    });

    scene.add.existing(this);
    this.setOrigin(0.5, 1);
    this.setDepth(10000);

    scene.tweens.add({
      targets: this,
      y: y - 24,
      alpha: 0,
      duration: 900,
      ease: 'Power1',
      onComplete: () => this.destroy(),
    });
  }
}
