import Phaser from "phaser";

export default class Coin extends Phaser.GameObjects.Sprite { 
  constructor(scene, x = 350, y = 300) {
    super(scene, x, y, 'coin');
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.body.setSize(14, 12);
    this.body.setAllowGravity(false);
    this.anims.play({ key: 'Coin-Idle', repeat: -1 });
    this.body.setDragX(scene.airDrag ? scene.airDrag * 1 : 100);
    this.isCollected = false;

    this.on('animationcomplete', (animation) => {
      if (animation.key === 'Coin-Collect') {
        this.destroy();
      }
    });
  }

  Collected() {
    if (!this.isCollected) {
      this.isCollected = true;
      this.anims.play('Coin-Collect', true);
    }
  }
}
