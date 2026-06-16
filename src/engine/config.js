import Phaser from 'phaser';
import { GameScene } from './scenes/GameScene.js';

/**
 * Returns a Phaser 3 game configuration tuned for a vertical portrait
 * container (450×800) with FIT scaling.
 */
export function createGameConfig(parentId = 'game-canvas') {
  return {
    type: Phaser.AUTO,
    width: 450,
    height: 800,
    parent: parentId,
    backgroundColor: '#1c0e05',
    pixelArt: true,

    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },

    scene: [GameScene],

    input: {
      touch: { capture: true },
    },
  };
}
