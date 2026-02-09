import Phaser from "phaser";

export default class Pig extends Phaser.GameObjects.Sprite { 
  constructor(scene, x = 420, y = 300) {
    super(scene, x, y, 'pig');
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.body.setSize(18, 18);
    this.anims.play({ key: 'Pig-Idle', repeat: -1 });
    this.body.setDragX(scene.airDrag ? scene.airDrag * 1 : 100);
    this.isDead = false;
    // AI 狀態機
    this.aiState = 'patrol'; // patrol(巡邏), engage(交戰), return(返回)
    
    // 巡邏區域設定（以初始位置為中心）
    this.spawnX = x; // 記錄初始生成位置
    this.patrolCenterX = x; // 巡邏中心點 X（與生成位置相同）
    
    // 移動相關
    this.normalSpeed = 80;      // 正常移動速度
    this.chaseSpeed = 105;      // 追擊速度
    this.patrolDirection = 1;   // 巡邏方向：1 向右，-1 向左
    this.patrolWaitTime = 0;    // 巡邏等待時間
    this.patrolWaitDuration = 800; // 巡邏等待時長（毫秒）
    this.patrolStartTime = 0;   // 開始當前方向巡邏的時間
    this.patrolDuration = 2000; // 每個方向巡邏的持續時間（毫秒）
    
    // 目標檢測
    this.target = null;         // 當前目標（king）
    this.detectionRange = 180;  // 檢測範圍
    this.loseTargetRange = 240; // 丟失目標範圍
    this.lastTargetCheckTime = 0;
    this.targetCheckInterval = 100; // 目標檢測間隔（毫秒）
    
    // 交戰相關
    this.lastKnownTargetX = 0; // 最後已知目標位置    
    
    // 攻擊相關
    this.attackRange = 80;      // 攻擊範圍（衝擊攻擊）
    this.attackMaxHeight = 32;  // 攻擊最大高度差（目標不能比豬豬高超過 32px）
    this.attackCooldown = 500;     // 攻擊冷卻時間
    this.attackCooldownDuration = 1000; // 攻擊冷卻時長（毫秒）
    this.isAttacking = false;
    
    // 後退閃避相關
    this.retreatSpeed = 250;     // 後退速度（快速後退時使用）
    this.retreatDistance = 100;  // 最小安全距離
    this.safeDistanceMax = 160;  // 最大安全距離
    this.retreatStartTime = 0;   // 開始後退的時間（用於限制高速後退時間）
    this.retreatSpeedDuration = 300; // 高速後退持續時間（毫秒）
    
    // 跳躍相關（參考 king）
    this.isJumping = false;
    this.jumpStartTime = 0;
    this.initialJumpPower = -200;
    this.jumpBoostPower = -2;
    this.maxJumpHoldTime = 200;
    
    // 生成攻擊判定區域
    this.AttackZones = {
      front: scene.add.zone(x, y, 15, 24)
    };
    scene.physics.add.existing(this.AttackZones.front);
    this.AttackZones.front.body.setAllowGravity(false);
    this.AttackZones.front.body.enable = false;

    // 動畫完成監聽
    this.on("animationcomplete", (animation) => {
      if (animation.key === "Pig-Attack") {
        console.log('[豬豬] 攻擊: 攻擊動畫完成，進入冷卻');
        this.isAttacking = false;
        this.AttackZones.front.body.enable = false;
        this.attackCooldown = this.scene.time.now + this.attackCooldownDuration;
      }
    });
  }

  // 檢測目標（king）
  detectTarget() {
    const currentTime = this.scene.time.now;
    if (currentTime - this.lastTargetCheckTime < this.targetCheckInterval) {
      return this.target;
    }
    this.lastTargetCheckTime = currentTime;

    // 從 scene 獲取 king
    if (!this.scene.king || this.scene.king.isDead) {
      this.target = null;
      return null;
    }

    const king = this.scene.king;
    const distance = Phaser.Math.Distance.Between(this.x, this.y, king.x, king.y);

    // 如果在檢測範圍內，鎖定目標
    if (distance <= this.detectionRange) {
      this.target = king;
      this.lastKnownTargetX = king.x;
      return king;
    }

    // 如果已經有目標，檢查是否超出丟失範圍
    if (this.target && distance > this.loseTargetRange) {
      this.target = null;
      return null;
    }

    return this.target;
  }

  // 更新 AI 狀態
  updateAIState() {
    const target = this.detectTarget();
    const currentTime = this.scene.time.now;

    // 如果正在攻擊，不改變狀態
    if (this.isAttacking) {
      return;
    }

    // 如果死亡，不執行 AI
    if (this.isDead) {
      return;
    }

    // 狀態轉換邏輯
    const previousState = this.aiState;
    
    if (target) {
      const distance = Phaser.Math.Distance.Between(this.x, this.y, target.x, target.y);
      const heightDiff = this.y - target.y; // 高度差（正值表示目標在下方，負值表示目標在上方）
      
      // 優先檢查：如果在攻擊範圍內且冷卻結束，進入攻擊狀態（無論當前是什麼狀態）
      // 必須同時滿足：距離在攻擊範圍內、高度差在可攻擊範圍內（目標不能太高）、在地面上、冷卻結束
      if (distance <= this.attackRange && heightDiff >= 0 && heightDiff <= this.attackMaxHeight && 
          this.body.onFloor() && currentTime > this.attackCooldown) {
        if (this.aiState !== 'attack') {
          // console.log(`[豬豬] 狀態轉換: ${previousState} → attack (距離: ${distance.toFixed(0)}px, 高度差: ${heightDiff.toFixed(0)}px)`);
        }
        this.aiState = 'attack';
      }
      // 如果在攻擊冷卻中且距離在安全範圍內，進入後退閃避狀態
      else if (currentTime <= this.attackCooldown && distance <= this.safeDistanceMax) {
        if (this.aiState !== 'retreat') {
          console.log(`[豬豬] 狀態轉換: ${previousState} → retreat (攻擊冷卻中，距離: ${distance.toFixed(0)}px)`);
          // 重置後退時間
          this.retreatStartTime = 0;
          // 初始化左右移動方向（遠離目標）
          if (target) {
            this.patrolDirection = target.x < this.x ? 1 : -1; // 目標在左邊，向右移動；目標在右邊，向左移動
          }
        }
        this.aiState = 'retreat';
      }
      // 否則進入追擊狀態（攻擊冷卻結束後，如果不在攻擊範圍就追擊）
      else {
        if (this.aiState !== 'chase') {
          // console.log(`[豬豬] 狀態轉換: ${previousState} → chase (距離: ${distance.toFixed(0)}px)`);
        }
        this.aiState = 'chase';
        this.lastKnownTargetX = target.x;
      }
    } else {
      // 沒有目標時
      if (this.aiState === 'chase' || this.aiState === 'attack' || this.aiState === 'retreat') {
        // 從追擊/攻擊/後退狀態轉為返回狀態
        console.log(`[豬豬] 狀態轉換: ${previousState} → return (丟失目標)`);
        this.aiState = 'return';
      } else if (this.aiState === 'return') {
        // 檢查是否回到巡邏區域
        const distanceFromCenter = Math.abs(this.x - this.patrolCenterX);
        if (distanceFromCenter < 50) {
          console.log(`[豬豬] 狀態轉換: ${previousState} → patrol (已返回巡邏區域)`);
          this.aiState = 'patrol';
          this.patrolStartTime = 0; // 重置巡邏時間
        }
      } else {
        // 預設為巡邏狀態
        if (this.aiState !== 'patrol') {
          console.log(`[豬豬] 狀態轉換: ${previousState} → patrol`);
          this.patrolStartTime = 0; // 重置巡邏時間
        }
        this.aiState = 'patrol';
      }
    }
  }

  // 檢測前方是否會掉落（使用 tilemap 物理檢測）
  checkWillFall() {
    if (!this.body.onFloor()) {
      return false; // 已經在空中，不需要檢測
    }

    // 如果沒有 colliderLayer，無法檢測，返回 false
    if (!this.scene.colliderLayer) {
      return false;
    }

    // 檢測前方，只要有 1px 可以接觸地板就不會掉落
    const checkDistance = 12; // 檢測前方距離
    const checkX = this.x + (this.patrolDirection * checkDistance);
    const checkY = this.y + (this.body.height / 2) + 5; // 底部稍微下方一點

    // 將世界座標轉換為 tile 座標
    const tileX = this.scene.colliderLayer.worldToTileX(checkX);
    const tileY = this.scene.colliderLayer.worldToTileY(checkY);

    // 檢查前方是否有地板支撐
    const tile = this.scene.colliderLayer.getTileAt(tileX, tileY);
    if (!tile || !tile.collides) {
      // 如果任何一個點沒有碰撞 tile，表示會掉落
      return true;
    }    
    return false; // 所有點都有支撐，不會掉落
  }

  // 執行巡邏行為
  patrol() {
    const currentTime = this.scene.time.now;

    // 初始化巡邏開始時間（第一次進入巡邏狀態時）
    if (this.patrolStartTime === 0) {
      this.patrolStartTime = currentTime;
    }

    // 如果正在等待，檢查等待時間
    if (this.patrolWaitTime > 0) {
      if (currentTime < this.patrolWaitTime) {
        // 等待中，播放待機動畫並停止移動
        if (this.body.onFloor()) {
          this.anims.play('Pig-Idle', true);
        }
        this.body.setVelocityX(0);
        return; // 等待期間不執行其他邏輯
      } else {
        // 等待結束，清除等待標記並重置巡邏時間
        this.patrolWaitTime = 0;
        this.patrolStartTime = currentTime; // 重置巡邏開始時間
        // 繼續執行後續邏輯（移動）
      }
    }

    // 檢查是否會掉落（優先級最高）
    if (this.checkWillFall()) {
      console.log(`[豬豬] 巡邏: 檢測到前方會掉落，轉向`);
      this.patrolDirection *= -1;
      this.patrolWaitTime = currentTime + this.patrolWaitDuration; // 等待 1 秒後再移動
      this.patrolStartTime = currentTime; // 重置時間
      this.body.setVelocityX(0);
      if (this.body.onFloor()) {
        this.anims.play('Pig-Idle', true);
      }
      return;
    }

    // 檢查是否到達時間限制（每個方向移動一定時間後轉向）
    const patrolTimeElapsed = currentTime - this.patrolStartTime;
    if (patrolTimeElapsed >= this.patrolDuration) {
      console.log(`[豬豬] 巡邏: 時間到，轉向`);
      this.patrolDirection *= -1;
      this.patrolWaitTime = currentTime + this.patrolWaitDuration; // 等待 1 秒後再移動
      this.patrolStartTime = currentTime; // 重置時間
      this.body.setVelocityX(0);
      if (this.body.onFloor()) {
        this.anims.play('Pig-Idle', true);
      }
      return;
    }

    // 檢查是否撞牆（使用物理檢測）
    if (this.body.onFloor()) {
      // 如果速度為 0 但應該在移動，可能撞牆了
      if (Math.abs(this.body.velocity.x) < 10 && Math.abs(this.normalSpeed * this.patrolDirection) > 10) {
        // 檢查是否真的撞牆（touching 檢測）
        if ((this.patrolDirection > 0 && this.body.touching.right) ||
            (this.patrolDirection < 0 && this.body.touching.left)) {
          console.log(`[豬豬] 巡邏: 撞牆，轉向`);
          this.patrolDirection *= -1;
          this.patrolWaitTime = currentTime + this.patrolWaitDuration; // 等待 1 秒後再移動
          this.patrolStartTime = currentTime; // 重置時間
          this.body.setVelocityX(0);
          this.anims.play('Pig-Idle', true);
          return;
        }
      }
    }

    // 正常移動（在巡邏範圍內且不會掉落）
    if (this.body.onFloor()) {
      this.body.setVelocityX(this.normalSpeed * this.patrolDirection);
      this.setFlipX(this.patrolDirection > 0); // 反轉：spritesheet 預設是向左的
      this.anims.play('Pig-Run', true);
    }
  }

  // 執行追擊行為
  chase() {
    if (!this.target) return;

    const targetX = this.target.x;
    let direction = targetX > this.x ? 1 : -1;
    const distance = Math.abs(targetX - this.x);

    // 獲取地圖邊界
    const worldBounds = this.scene.physics.world.bounds;
    const bodyHalfWidth = this.body.width / 2;
    const leftBound = worldBounds.x + bodyHalfWidth;
    const rightBound = worldBounds.width - bodyHalfWidth;
    
    // 檢測是否到達地圖邊界
    const isAtLeftBound = this.x <= leftBound;
    const isAtRightBound = this.x >= rightBound;
    
    // 如果追擊方向會導致超出地圖邊界，停止追擊
    if ((direction > 0 && isAtRightBound) || (direction < 0 && isAtLeftBound)) {
      const boundarySide = isAtRightBound ? '右' : '左';
      // console.log(`[豬豬] 追擊: 到達地圖${boundarySide}邊界 (x: ${this.x.toFixed(0)}), 停止追擊`);
      // this.body.setVelocityX(0);
      if (this.body.onFloor()) {
        // this.anims.play('Pig-Idle', true);
      }
      // return;
    }

    // 設定移動方向（反轉：spritesheet 預設是向左的）
    this.setFlipX(direction > 0);

    // 如果在地面上，移動
    if (this.body.onFloor()) {
      this.body.setVelocityX(this.chaseSpeed * direction);
      this.anims.play('Pig-Run', true);
    } else {
      // 在空中時也持續設定水平速度，確保跳躍時能水平移動到平台
      this.body.setVelocityX(this.chaseSpeed * direction);
    }

    // 判斷是否需要跳躍：
    // 1. 目標在較高位置（高度差超過攻擊範圍）
    // 2. 目標在攻擊範圍內但高度太高無法攻擊（需要跳躍才能攻擊）
    // 3. 目標在較高位置且距離較近（追擊高處目標）
    const heightDiff = this.y - this.target.y; // 高度差（正值表示目標在下方，負值表示目標在上方）

    const targetAboveAndClose = this.target.y < this.y - 20 && distance < 120; // 目標在上方且距離較近
    
    if (this.body.onFloor() && !this.isJumping && targetAboveAndClose && heightDiff > 0) {
      console.log(`[豬豬] 追擊: 跳躍追擊目標 (距離: ${distance.toFixed(0)}px, 高度差: ${heightDiff.toFixed(0)}px, 原因: ${'攻擊範圍內但高度不夠'})`);
      // 設定垂直速度（跳躍）
      this.body.setVelocityY(this.initialJumpPower);
      // 確保跳躍時有水平速度，這樣才能跳到平台上
      this.body.setVelocityX(this.chaseSpeed * direction);
      this.isJumping = true;
      this.jumpStartTime = this.scene.time.now;
      this.anims.play('Pig-Jump');
    }
  }

  // 執行攻擊行為
  attack() {
    if (!this.target) {
      return;
    }

    const distance = Phaser.Math.Distance.Between(this.x, this.y, this.target.x, this.target.y);
    const heightDiff = this.y - this.target.y; // 高度差（正值表示目標在下方，負值表示目標在上方）
    
    // 如果目標太遠或高度太高，讓 updateAIState 來處理狀態轉換（不要在這裡直接改變狀態）
    if (distance > this.attackRange || heightDiff < 0 || heightDiff > this.attackMaxHeight) {
      return;
    }

    // 面向目標（反轉：spritesheet 預設是向左的）
    const direction = this.target.x > this.x ? 1 : -1;
    this.setFlipX(direction > 0);

    // 執行攻擊（只能在地面，有衝擊效果）
    if (!this.isAttacking && this.body.onFloor()) {
      // 獲取地圖邊界
      const worldBounds = this.scene.physics.world.bounds;
      const bodyHalfWidth = this.body.width / 2;
      const leftBound = worldBounds.x + bodyHalfWidth;
      const rightBound = worldBounds.width - bodyHalfWidth;
      const isAtLeftBound = this.x <= leftBound;
      const isAtRightBound = this.x >= rightBound;
      
      // 檢查是否會超出邊界
      const wouldExceedBoundary = (direction > 0 && isAtRightBound) || (direction < 0 && isAtLeftBound);
      
      console.log(`[豬豬] 攻擊: 執行衝擊攻擊！距離: ${distance.toFixed(0)}px`);
      this.isAttacking = true;
      
      // 如果不會超出邊界，使用衝擊效果
      if (!wouldExceedBoundary) {
        // 使用 setVelocityX 產生衝擊效果，明顯往前衝
        this.body.setVelocityX(direction > 0 ? 250 : -250);
      } else {
        // 會超出邊界，只停止移動
        this.body.setVelocityX(0);
      }
      
      this.anims.play('Pig-Attack', true);
      this.AttackZones.front.body.enable = true;
    }
  }

  // 執行後退閃避行為
  retreat() {
    if (!this.target) {
      this.aiState = 'return';
      return;
    }

    const currentTime = this.scene.time.now;
    const targetX = this.target.x;
    const distance = Phaser.Math.Distance.Between(this.x, this.y, this.target.x, this.target.y);
    
    // 獲取地圖邊界
    const worldBounds = this.scene.physics.world.bounds;
    const bodyHalfWidth = this.body.width / 2;
    const leftBound = worldBounds.x + bodyHalfWidth;
    const rightBound = worldBounds.width - bodyHalfWidth;
    
    // 檢測是否到達地圖邊界
    const isAtLeftBound = this.x <= leftBound;
    const isAtRightBound = this.x >= rightBound;
    const isAtBoundary = isAtLeftBound || isAtRightBound;
    
    // 如果到達地圖邊界，停止後退
    if (isAtBoundary) {
      const boundarySide = isAtLeftBound ? '左' : '右';
      console.log(`[豬豬] 後退: 到達地圖${boundarySide}邊界 (x: ${this.x.toFixed(0)}), 停止後退`);
      this.body.setVelocityX(0);
      if (this.body.onFloor()) {
        this.anims.play('Pig-Idle', true);
      }
      // 重置後退時間
      this.retreatStartTime = 0;
      return;
    }

    // 判斷距離狀態
    const isTooClose = distance < this.retreatDistance; // 太近，需要快速後退
    const isInSafeRange = distance >= this.retreatDistance && distance <= this.safeDistanceMax; // 安全範圍內
    const isTooFar = distance > this.safeDistanceMax; // 太遠

    // 如果太遠，停止後退（讓狀態機轉換到 chase）
    if (isTooFar) {
      this.body.setVelocityX(0);
      if (this.body.onFloor()) {
        this.anims.play('Pig-Idle', true);
      }
      this.retreatStartTime = 0;
      return;
    }

    // 如果在安全範圍內，進行不規則的左右移動
    if (isInSafeRange) {
      // 統一計算方向（使用局部變數避免同一幀內多次修改造成抖動）
      // 優先級：邊界檢查 > 國王靠近
      let direction = this.patrolDirection;
      
      // 優先級 1: 檢查是否會超出地圖邊界（最高優先級）
      const wouldExceedLeft = this.x <= leftBound && direction < 0;
      const wouldExceedRight = this.x >= rightBound && direction > 0;
      if (wouldExceedLeft || wouldExceedRight) {
        direction *= -1; // 反轉方向
      }
      // 優先級 2: 檢查國王是否正在靠近
      else {
        const kingMovingTowardPig = (targetX > this.x && this.target.body.velocity.x < 0) || 
                                     (targetX < this.x && this.target.body.velocity.x > 0);
        if (kingMovingTowardPig && distance < this.safeDistanceMax * 0.8) {
          const retreatDir = targetX < this.x ? 1 : -1;
          // 確保不會超出邊界
          if (!((retreatDir > 0 && isAtRightBound) || (retreatDir < 0 && isAtLeftBound))) {
            direction = retreatDir;
          }
        }
      }
      
      // 只更新一次 patrolDirection（避免抖動）
      if (this.patrolDirection !== direction) {
        console.log(`[豬豬] patrolDirection: ${this.patrolDirection} → ${direction}`);
      }
      this.patrolDirection = direction;

      // 使用正常速度左右移動
      this.setFlipX(this.patrolDirection > 0);
      if (this.body.onFloor()) {
        this.body.setVelocityX(this.normalSpeed * this.patrolDirection);
        this.anims.play('Pig-Run', true);
      }
      
      // 重置後退時間
      this.retreatStartTime = 0;
      return;
    }

    // 如果太近，需要快速後退
    if (isTooClose) {
      // 計算遠離目標的方向（與目標相反的方向）
      let direction = targetX < this.x ? 1 : -1; // 目標在左邊，向右後退；目標在右邊，向左後退
      
      // 如果後退方向會導致超出地圖邊界，則不後退
      if ((direction > 0 && isAtRightBound) || (direction < 0 && isAtLeftBound)) {
        console.log(`[豬豬] 後退: 後退方向會超出地圖邊界，停止後退`);
        this.body.setVelocityX(0);
        if (this.body.onFloor()) {
          this.anims.play('Pig-Idle', true);
        }
        this.retreatStartTime = 0;
        return;
      }

      // 記錄開始後退的時間
      if (this.retreatStartTime === 0) {
        this.retreatStartTime = currentTime;
      }

      // 檢查高速後退時間是否已過
      const retreatTimeElapsed = currentTime - this.retreatStartTime;
      const useHighSpeed = retreatTimeElapsed < this.retreatSpeedDuration;

      // 設定移動方向（反轉：spritesheet 預設是向左的）
      this.setFlipX(direction > 0);

      // 如果在地面上，後退移動
      if (this.body.onFloor()) {
        // 只在短時間內使用高速，之後使用正常速度
        const speed = useHighSpeed ? this.retreatSpeed : this.normalSpeed;
        this.body.setVelocityX(speed * direction);
        this.anims.play('Pig-Run', true);
      }
    }
  }

  // 執行返回行為（返回到初始生成位置）
  returnToPatrol() {
    // 計算到初始位置的方向和距離
    const direction = this.spawnX > this.x ? 1 : -1;
    const distanceFromSpawn = Math.abs(this.x - this.spawnX);

    this.setFlipX(direction > 0); // 反轉：spritesheet 預設是向左的

    // 如果距離初始位置還很遠，繼續移動
    if (distanceFromSpawn > 20) {
      if (this.body.onFloor()) {
        this.body.setVelocityX(this.normalSpeed * direction);
        this.anims.play('Pig-Run', true);
      }
    } else {
      // 已回到初始位置附近，轉為巡邏狀態
      console.log(`[豬豬] 返回: 已回到初始位置 (距離: ${distanceFromSpawn.toFixed(0)}px)`);
      this.body.setVelocityX(0);
      // 重置巡邏方向，從初始位置開始巡邏
      this.patrolDirection = 1; // 預設向右開始
      this.patrolStartTime = 0; // 重置巡邏時間
      this.aiState = 'patrol';
    }
  }

  // 更新方法
  update() {
    if (this.isDead) {
      return;
    }

    const currentTime = this.scene.time.now;

    // 攻擊判定區域位置
    this.AttackZones.front.x = this.x + (this.flipX ? 15 : -14);
    this.AttackZones.front.y = this.y - 8;

    // 更新 AI 狀態
    this.updateAIState();

    // 根據狀態執行對應行為
    switch (this.aiState) {
      case 'patrol':
        this.patrol();
        break;
      case 'chase':
        this.chase();
        break;
      case 'attack':
        this.attack();
        break;
      case 'retreat':
        this.retreat();
        break;
      case 'return':
        this.returnToPatrol();
        break;
    }

    // 跳躍持續加速（參考 king）
    if (this.isJumping && this.body.velocity.y < 0) {
      const jumpHoldTime = currentTime - this.jumpStartTime;
      if (jumpHoldTime < this.maxJumpHoldTime) {
        this.body.setVelocityY(this.body.velocity.y + this.jumpBoostPower);
      }
    }

    // 落地檢測
    if (this.body.onFloor() && this.isJumping) {
      this.isJumping = false;
    }

    // 空中動畫（只在非攻擊狀態下更新）
    if (!this.body.onFloor() && !this.isAttacking && 
        (!this.anims.currentAnim || this.anims.currentAnim.key !== 'Pig-Attack')) {
      if (this.body.velocity.y < 0) {
        if (!this.anims.currentAnim || this.anims.currentAnim.key !== 'Pig-Jump') {
          this.anims.play('Pig-Jump', true);
        }
      } else if (this.body.velocity.y > 0) {
        if (!this.anims.currentAnim || this.anims.currentAnim.key !== 'Pig-Fall') {
          this.anims.play('Pig-Fall', true);
        }
      }
    }
  }

  dead() {
    if (!this.isDead) {
      this.isDead = true;
      this.aiState = 'patrol'; // 停止 AI
      this.body.setVelocityX(0);
      this.body.setVelocityY(0);
      this.anims.play('Pig-Dead', true);      
    }
  }
}