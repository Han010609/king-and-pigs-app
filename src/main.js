import Phaser from 'phaser';
import "./style.css";
import kingSpritesheet from "./assets/kinghuman.png";
import kingSpritesheetJSON from "./assets/kinghuman.json";
import pigSpritesheet from "./assets/pig.png";
import pigSpritesheetJSON from "./assets/pig.json";
import coinSpritesheet from "./assets/coin.png";
import coinSpritesheetJSON from "./assets/coin.json";
import platform from "./assets/platform.png";

import BootScene from './scene/boot.js';
import GameScene from './scene/game.js';

const scene = {
  preload: function () {

  },
  create: function () {

  },
  update: function () {
  
  },
}

const config = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  pixelArt: true,
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 600 },
      // debug: true,
    }
  },
  // scene 可以給陣列[scene1, scene2]來建立多個場景
  scene: [BootScene, GameScene],
};

const game = new Phaser.Game(config);