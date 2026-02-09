import Phaser from "phaser";
import kingSpritesheet from "../assets/kinghuman.png";
import kingSpritesheetJSON from "../assets/kinghuman.json";
import pigSpritesheet from "../assets/pig.png";
import pigSpritesheetJSON from "../assets/pig.json";
import coinSpritesheet from "../assets/coin.png";
import coinSpritesheetJSON from "../assets/coin.json";
import platform from "../assets/platform.png";
import terrain from "../assets/terrain(32x32).png";
import decoration from "../assets/decorations(32x32).png";
import map from "../assets/map.json";

export default class Boot extends Phaser.Scene {
  constructor() {
    super("boot-scene")
  }
  preload(){
    this.load.on("progress", (value) => {
      console.log(`Loading progress: ${(value * 100).toFixed(0)}%`);
    })
    this.load.on("complete", () => {
      this.scene.start("game-scene");
    })
    this.load.tilemapTiledJSON("map", map);
    this.load.image("terrain", terrain);
    this.load.image("decoration", decoration);
    this.load.aseprite("kinghuman", kingSpritesheet, kingSpritesheetJSON);
    this.load.aseprite("pig", pigSpritesheet, pigSpritesheetJSON);
    this.load.aseprite("coin", coinSpritesheet, coinSpritesheetJSON);
    this.load.image("platform", platform);
  }
  create(){
    // 建立動畫
    this.anims.createFromAseprite("kinghuman");
    this.anims.createFromAseprite("pig");
    this.anims.createFromAseprite("coin");
  }  
}