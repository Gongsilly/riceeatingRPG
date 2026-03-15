import Phaser from 'phaser';
import PreloadScene from './scenes/PreloadScene.js';
import LoginScene   from './scenes/LoginScene.js';
import GameScene    from './scenes/GameScene.js';

const config = {
  type: Phaser.AUTO,
  width: window.innerWidth,
  height: window.innerHeight,
  backgroundColor: '#1a1a2e',
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  physics: {
    default: 'arcade',
    arcade: { debug: false },
  },
  scene: [PreloadScene, LoginScene, GameScene],
};

new Phaser.Game(config);
