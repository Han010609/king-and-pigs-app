import Phaser from "phaser";

export default class King extends Phaser.GameObjects.Sprite {
  constructor(scene, x = 300, y = 300){
    super(scene, x, y, 'kinghuman');
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.body.setSize(22, 24);
    this.body.setOffset(37, 40);
    this.anims.play({ key: 'Idle', repeat: -1 });
    this.body.setDragX(scene.airDrag ? scene.airDrag * 1 : 100);
    this.isDead = false;

    this.on("animationcomplete", (animation) => {
      if (animation.key === "Attack") {
        // 攻擊動畫結束取消攻擊判定
        this.AttackZones.front.body.enable = false;
        this.AttackZones.under.body.enable = false;
      }
    });
    // 生成主角攻擊判定區域
    this.AttackZones = {
      front: scene.add.zone(410, 300, 36, 44),
      under: scene.add.zone(395, 328, 48, 12)
    };
    scene.physics.add.existing(this.AttackZones.front);
    scene.physics.add.existing(this.AttackZones.under);
    this.AttackZones.front.body.setAllowGravity(false);
    this.AttackZones.under.body.setAllowGravity(false);

    this.AttackZones.front.body.enable = false;
    this.AttackZones.under.body.enable = false; 

    this.cursors = scene.input.keyboard.createCursorKeys();

    // 衝刺相關
    this.lastLeftTapTime = 0;   // 上次按左鍵的時間
    this.lastRightTapTime = 0;  // 上次按右鍵的時間
    this.doubleTapDelay = 250;  // 連按判定時間(毫秒)
    this.isDashing = false;     // 是否正在衝刺
    this.normalSpeed = 100;      // 正常速度
    this.dashSpeed = 150;       // 衝刺速度

    // 跳躍相關
    this.isJumping = false;           // 是否正在跳躍中
    this.jumpStartTime = 0;           // 跳躍開始的時間s
    this.initialJumpPower = -200;     // 初始跳躍力
    this.jumpBoostPower = -2;         // 按住時每幀額外施加的向上力
    this.maxJumpHoldTime = 250;       // 最大按住加速時間(毫秒)

    // 超大跳相關
    this.lastFlipX = false;           // 記錄上一幀的翻轉狀態
    this.hasSuperJumped = false;      // 本次跳躍是否已使用超大跳
    this.wasDashingOnJump = false;    // 起跳時是否在衝刺狀態

    // 攻擊系統
    this.attackState = {
      combo: 0,                // 當前連擊數
      maxCombo: 3,             // 最大連擊數
      lastAttackTime: 0,       // 上次攻擊時間
      comboWindow: 500,        // 連擊窗口時間(毫秒)
      attackCooldown: 750,     // 攻擊冷卻時間(毫秒)
      canCombo: true,          // 是否可以開始新的連擊
    };
  }

  update(){
    // 如果已經死亡，停止所有更新
    if (this.isDead) {
      return;
    }

    this.AttackZones.front.x = this.x + (this.flipX ? -30 : 29);
    this.AttackZones.front.y = this.y - 2;
    this.AttackZones.under.x = this.x + (this.flipX ? -15 : 14);
    this.AttackZones.under.y = this.y + 26;

    const currentTime = this.scene.time.now;

    // === 攻擊 ===
    // 如果正在播放攻擊動畫,則跳過其他輸入處理
    if (this.anims.currentAnim && this.anims.currentAnim.key === 'Attack' && this.anims.isPlaying) {
      return; // 直接返回,不處理其他輸入
    }
    // 檢查連擊
    if (this.attackState.canCombo && this.attackState.combo > 0 && currentTime - this.attackState.lastAttackTime > this.attackState.comboWindow) {
      this.attackState.combo = 0;
    }
    // 檢查冷卻時間（連擊結束後才檢查）
    if (!this.attackState.canCombo && currentTime - this.attackState.lastAttackTime >= this.attackState.attackCooldown) {
      this.attackState.canCombo = true;
      this.attackState.combo = 0;
    }

    if (Phaser.Input.Keyboard.JustDown(this.cursors.space) && this.attackState.canCombo) {
      // === 一般攻擊 ===
      this.attackState.combo++;
      this.attackState.lastAttackTime = currentTime;

      // 昇龍擊（蹲下+攻擊）===
      if (this.cursors.down.isDown && this.body.onFloor() && !this.isDashing) {
        this.attackState.combo ++; // 額外加一段連擊
        this.body.setVelocityY(this.initialJumpPower * 0.9);
        this.anims.play('Attack', true);
        this.AttackZones.front.body.enable = true;
        this.AttackZones.under.body.enable = true;
        return;
      }

      // 如果達到最大連擊，開始冷卻
      if (this.attackState.combo >= this.attackState.maxCombo) {
        this.attackState.canCombo = false;
      }
      
      this.anims.play('Attack', true);
      this.AttackZones.front.body.enable = true;
      this.AttackZones.under.body.enable = true;
      
      // 根據不同情況設定物理效果
      if (this.body.onFloor() && this.isDashing) {
        this.body.setDragX(this.airDrag * 0.4 - 500);
        this.attackState.canCombo = false; // 衝刺攻擊直接開始冷卻
        this.isDashing = false;
      }
      else if (!this.body.onFloor() && this.isDashing) {
        this.body.setDragX(this.airDrag * 0.5 - 250);
        this.attackState.canCombo = false; // 衝刺攻擊直接開始冷卻
        this.isDashing = false;
        this.body.setVelocityY(-75);
      }
      else if (this.body.onFloor()) {
        this.body.setDragX(this.airDrag * 1.2);
      }
      else if (!this.body.onFloor()) {
        this.attackState.combo ++; // 空中攻擊加一段
        this.body.setDragX(this.airDrag * 1.5);
        this.body.setVelocityY(-50);
      }
      return;
    }

    // === 待機 ===
    if (this.cursors.left.isUp && this.cursors.right.isUp && this.body.onFloor()) {
      this.body.setVelocityX(0);
      this.isDashing = false;  // 鬆開按鍵時取消衝刺
      
      if (this.body.onFloor()) {
        this.anims.play('Idle', true);
      }
    }

    // === 左右移動 ===
    if (this.cursors.left.isDown) {
      this.setFlipX(true);
      this.body.setOffset(36, 40);

      // 根據是否衝刺設定速度
      const speed = this.isDashing ? -this.dashSpeed : -this.normalSpeed;
      this.body.setVelocityX(speed);

      if (this.body.onFloor()) {
        this.anims.play('Run', true);
      }
    }
    else if (this.cursors.right.isDown) {
      this.setFlipX(false);
      this.body.setOffset(37, 40);

      // 根據是否衝刺設定速度
      const speed = this.isDashing ? this.dashSpeed : this.normalSpeed;
      this.body.setVelocityX(speed);
      
      if (this.body.onFloor()) {
        this.anims.play('Run', true);
      }
    }

    // === 連按兩下衝刺(只在靜止或剛開始移動時觸發) ===
    if (Phaser.Input.Keyboard.JustDown(this.cursors.left) && this.body.onFloor()) {
      const timeSinceLastPress = currentTime - this.lastLeftTapTime;
      if (timeSinceLastPress < this.doubleTapDelay) {
        // 觸發衝刺!
        this.isDashing = true;
        this.dashStartTime = currentTime;
      }
      this.lastLeftTapTime = currentTime;
 
    }    
    if (Phaser.Input.Keyboard.JustDown(this.cursors.right) && this.body.onFloor()) {
      const timeSinceLastPress = currentTime - this.lastRightTapTime;
      if (timeSinceLastPress < this.doubleTapDelay) {
        // 觸發衝刺!
        this.isDashing = true;
        this.dashStartTime = currentTime;
      }
      this.lastRightTapTime = currentTime;    
    }


    // 記錄按鍵時間(用於連按判定)
    if (Phaser.Input.Keyboard.JustDown(this.cursors.left)) {
      this.lastLeftTapTime = currentTime;
    }
    if (Phaser.Input.Keyboard.JustDown(this.cursors.right)) {
      this.lastRightTapTime = currentTime;
    }

    // === 空中慣性控制 ===
    if (!this.body.onFloor() && this.cursors.left.isUp && this.cursors.right.isUp) {
      this.body.setDragX(this.airDrag);
    } else {
      this.body.setDragX(this.airDrag * 0.8);
    }
  
    // === 跳躍 ===
    if (Phaser.Input.Keyboard.JustDown(this.cursors.up) && this.body.onFloor()) {
      this.body.setVelocityY(this.initialJumpPower);
      this.anims.play('Jump');
      this.isJumping = true;
      this.jumpStartTime = currentTime;
      this.wasDashingOnJump = this.isDashing; // 記錄起跳時是否在衝刺
      this.hasSuperJumped = false;            // 重置超大跳標記
      this.lastFlipX = this.flipX;       // 記錄起跳時的方向
    }

    // === 超大跳判定:衝刺跳躍中轉身 ===
    if (this.isJumping && this.wasDashingOnJump && !this.hasSuperJumped && this.body.velocity.y < 0 && this.flipX !== this.lastFlipX) {
      // 觸發超大跳!重置跳躍時間,延長加速期
      this.body.setVelocityY(this.initialJumpPower*0.8);
      this.jumpStartTime = currentTime;
      this.hasSuperJumped = true;
      this.isDashing = false;
      // console.log('超大跳觸發!'); // 除錯用
    }

    // 按住上鍵期間,持續施加向上的力(大跳效果)
    if (this.cursors.up.isDown && this.isJumping && this.body.velocity.y < 0) {
      const jumpHoldTime = currentTime - this.jumpStartTime;
      
      // 只在限定時間內可以加速
      if (jumpHoldTime < this.maxJumpHoldTime) {
        this.body.setVelocityY(this.body.velocity.y + this.jumpBoostPower);
      }
    }
    // 按住不放時落地後立即小跳
    if (this.cursors.up.isDown && this.body.onFloor()) {
      this.body.setVelocityY(this.initialJumpPower);
      this.anims.play('Jump');
    }

    // 更新翻轉狀態記錄(用於下一幀比對)
    this.lastFlipX = this.flipX;
 
    // === 空中動畫 ===
    if (!this.body.onFloor()) {
      // 如果 Y 軸速度小於 0,表示正在向上跳
      if (this.body.velocity.y < 0) {
        // this.anims.play('Jump', true);
        this.setTexture('kinghuman', 11);
      }
      // 如果 Y 軸速度大於等於 0,表示正在下落
      else if (this.body.velocity.y > 0) {
        // this.anims.play('Fall', true);
        this.setTexture('kinghuman', 12);
      }
    }

    // === 快速下墜 ===
    if (Phaser.Input.Keyboard.JustDown(this.cursors.down) && !this.body.onFloor()) {
      this.body.setVelocityY(-this.initialJumpPower*2);
      this.body.setDragX(this.airDrag * 0);
    }
    // === 落地蹲下 ===
    if (this.cursors.down.isDown && this.body.onFloor() && !this.isDashing) {
      this.anims.play('Ground');
      this.body.setVelocityX(0);
      this.isDashing = false;
    }
  }

  dead() {
    if (!this.isDead) {
      this.isDead = true;
      this.body.setVelocityX(0);
      this.body.setVelocityY(0);
      this.anims.play('Dead', true);
    }
  }
}