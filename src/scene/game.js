import Phaser from "phaser";
import King from "../sprite/king.js";
import Coin from "../sprite/coin.js";
import Pig from "../sprite/pig.js";

export default class Game extends Phaser.Scene {
  constructor() {
    super("game-scene")
  }  
  create(){
    const map = this.make.tilemap({key: "map"});
    const terrainTiles = map.addTilesetImage("terrain(32x32)", "terrain", 32, 32);
    // const decorationTileset = map.addTilesetImage("decoration(32x32)", "decoration", 32, 32);
    
    const bgLayer = map.createLayer("bg", terrainTiles);
    const colliderLayer = map.createLayer("collider", terrainTiles);   
    
    colliderLayer.setCollisionFromCollisionGroup(true, false);
    this.colliderLayer = colliderLayer; // 存儲 colliderLayer 供其他對象使用
    
    this.king = map.createFromObjects("point", {
      name: "king",
      classType: King,
    })[0];

    // 將 pigs 改為陣列（移除 [0]）
    this.pigs = map.createFromObjects("point", {
      name: "pig",
      classType: Pig,
    });

    // 將 coins 改為陣列（移除 [0]）
    this.coins = map.createFromObjects("point", {
      name: "coin",
      classType: Coin,
    });



    // 生成豬豬（抽離成 Pig 類別）
    // this.pig = new Pig(this);

    // 生成鑽石
    // this.coin = new Coin(this);

    // 生成主角（放在 pig/coin 之後，避免 King 建構子引用未建立的物件）
    // this.king = new King(this);

    // 碰撞與重疊設定
    this.physics.add.collider(this.king, colliderLayer);
    // 為每個 pig 設定碰撞
    this.pigs.forEach(pig => {
      this.physics.add.collider(pig, colliderLayer);
      // this.physics.add.collider(this.king, pig, (king, pig) => {
      //   king.body.setVelocityX(0);
      //   pig.body.setVelocityX(0);
      // });
    });

    // 使用 king 實例上暴露的攻擊判定區域
    // 為每個 pig 設定攻擊重疊檢測
    this.pigs.forEach(pig => {
      this.physics.add.overlap([
        this.king.AttackZones.front,
        this.king.AttackZones.under
      ], pig, (zone, pig) => {
        if (
          this.king.anims.currentAnim &&
          this.king.anims.currentAnim.key === 'Attack' &&
          this.king.anims.isPlaying &&
          !pig.isDead
        ) {
          console.log('攻擊命中!');
          pig.dead();
        }
      });
    });
    
    // 豬豬攻擊判定 - 為每個 pig 設定攻擊判定
    this.pigs.forEach(pig => {
      this.physics.add.overlap(pig.AttackZones.front, this.king, (zone, king) => {
        if (
          pig.anims.currentAnim &&
          pig.anims.currentAnim.key === 'Pig-Attack' &&
          pig.anims.isPlaying &&
          !pig.isDead &&
          !king.isDead
        ) {
          console.log('豬豬攻擊命中!');
          king.dead();
        }
      });
    });
    // 為每個 coin 設定重疊檢測
    this.coins.forEach(coin => {
      this.physics.add.overlap(this.king, coin, (king, coin) => {
        if (coin.isCollected) return;
        console.log('撿到鑽石!');
        coin.Collected();
      });
    });

    // 空中阻力係數
    this.airDrag = 100;

    this.cameras.main.setZoom(2);
    // this.cameras.main.startFollow(this.king);
    this.king.y -= 72; 
    this.cameras.main.startFollow(this.king, true, 0.1, 0);
  }
  update(){
    // 必須明確呼叫 King 和 Pig 的 update，因為 Phaser 不會自動調用自訂 Sprite 的 update
    this.king.update();
    // 更新每個 pig
    this.pigs.forEach(pig => {
      pig.update();
    });
  }
}