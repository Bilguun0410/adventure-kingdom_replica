import Phaser from 'phaser';
import { createGameConfig } from './config.js';

// Boot the Phaser game instance and expose it for debugging.
const config = createGameConfig('game-canvas');
window.game = new Phaser.Game(config);
