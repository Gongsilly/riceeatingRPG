import { EXP_TABLE } from '../constants/gameData';

export default class Player {
  constructor(scene, x, y) {
    this.scene = scene;

    // ── 스탯 ──
    this.hp    = 100;
    this.maxHp = 100;
    this.mp    = 50;
    this.maxMp = 50;

    // ── 레벨 / 경험치 ──
    this.level      = 1;
    this.currentExp = 0;
    this.maxExp     = EXP_TABLE[1];

    // ── 스탯 포인트 ──
    this.str = 5;
    this.dex = 5;
    this.int = 5;
    this.luk = 5;
    this.ap  = 0;

    // ── 무적 상태 ──
    this.isInvincible = false;
    this._blinkTween  = null;

    // ── 넉백 상태 ──
    this._isKnockback = false;

    // ── 방향 ──
    this._lastDir = 'down';  // 'down' | 'up' | 'right' | 'left'
    this.facingX  = 0;
    this.facingY  = 1;

    // 스프라이트
    this.sprite = scene.physics.add.sprite(x, y, 'player', 0);
    this.sprite.setDepth(5);
    this.sprite.body.setSize(22, 20).setOffset(5, 12);
    this.sprite.body.setCollideWorldBounds(false);
    this.sprite.play('player_idle_down');

    this.speed   = 220;
    this.targetX = x;
    this.targetY = y;
    this.moving  = false;

    this.padDx = 0;
    this.padDy = 0;
  }

  // ── 피격 ──────────────────────────────────────────────────────────────────
  takeDamage(amount, kbDirX, kbDirY) {
    if (this.isInvincible || this.hp <= 0) return;

    this.hp = Math.max(0, this.hp - amount);

    const txt = this.scene.add.text(this.sprite.x, this.sprite.y - 20, `-${amount}`, {
      fontSize: '20px', fontStyle: 'bold',
      color: '#ff4444', stroke: '#000', strokeThickness: 4,
    }).setDepth(20).setOrigin(0.5).setScale(0);

    // 팝인 → 둥실 떠오르기
    this.scene.tweens.add({
      targets: txt,
      scale: 1.2,
      duration: 90,
      ease: 'Back.Out',
      onComplete: () => {
        this.scene.tweens.add({
          targets: txt,
          y: txt.y - 50,
          alpha: 0,
          scale: 0.8,
          duration: 900,
          ease: 'Power2',
          onComplete: () => txt.destroy(),
        });
      },
    });

    // 카메라 쉐이크 (플레이어 피격은 좀 더 강하게)
    this.scene.cameras.main.shake(130, 0.007);

    this._applyKnockback(kbDirX, kbDirY);
    this._startInvincibility();

    if (this.hp <= 0) this.scene.onPlayerDead();
  }

  _applyKnockback(dx, dy) {
    this._isKnockback = true;
    this.moving = false;
    this.padDx  = 0;
    this.padDy  = 0;
    this.sprite.body.setVelocity(dx * 380, dy * 380);

    this.scene.time.delayedCall(280, () => {
      this._isKnockback = false;
      this.sprite.body.setVelocity(0, 0);
    });
  }

  _startInvincibility() {
    this.isInvincible = true;

    if (this._blinkTween) this._blinkTween.stop();
    this.sprite.setAlpha(1);
    this._blinkTween = this.scene.tweens.add({
      targets: this.sprite, alpha: 0.25,
      duration: 120, yoyo: true, repeat: -1,
    });

    this.scene.time.delayedCall(1000, () => {
      this.isInvincible = false;
      if (this._blinkTween) { this._blinkTween.stop(); this._blinkTween = null; }
      this.sprite.setAlpha(1);
    });
  }

  // ── 경험치 / 레벨업 ────────────────────────────────────────────────────────
  gainExp(amount) {
    if (this.level >= 20) return;
    this.currentExp += amount;
    while (this.currentExp >= this.maxExp && this.level < 20) {
      this.currentExp -= this.maxExp;
      this.level++;
      this.maxExp = EXP_TABLE[this.level] ?? this.maxExp;
      this._onLevelUp();
    }
  }

  _onLevelUp() {
    this.ap += 5;
    this.scene._updateStatWindow?.();

    const txt = this.scene.add.text(this.sprite.x, this.sprite.y - 40, `LEVEL UP!  Lv.${this.level}`, {
      fontSize: '20px', fontStyle: 'bold',
      color: '#ffff00', stroke: '#000', strokeThickness: 4,
    }).setDepth(20).setOrigin(0.5);

    this.scene.tweens.add({
      targets: txt, y: txt.y - 50, alpha: 0, duration: 1500,
      onComplete: () => txt.destroy(),
    });
  }

  // ── 이동 ──────────────────────────────────────────────────────────────────
  moveTo(x, y) {
    if (this._isKnockback) return;
    this.padDx = 0; this.padDy = 0;
    this.targetX = x; this.targetY = y;
    this.moving = true;
  }

  setPadDirection(dx, dy) {
    if (this._isKnockback) return;
    this.padDx = dx; this.padDy = dy;
    if (dx !== 0 || dy !== 0) {
      this.moving = false;
      const len = Math.sqrt(dx * dx + dy * dy);
      this.facingX = dx / len;
      this.facingY = dy / len;
    }
  }

  update() {
    if (this._isKnockback) {
      this._updateAnim(false);
      return;
    }

    if (this.padDx !== 0 || this.padDy !== 0) {
      const len = Math.sqrt(this.padDx * this.padDx + this.padDy * this.padDy);
      this.sprite.body.setVelocity(
        (this.padDx / len) * this.speed,
        (this.padDy / len) * this.speed,
      );
      this._updateAnim(true);
      return;
    }

    if (!this.moving) {
      this.sprite.body.setVelocity(0, 0);
      this._updateAnim(false);
      return;
    }

    const dx   = this.targetX - this.sprite.x;
    const dy   = this.targetY - this.sprite.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 4) {
      this.sprite.body.setVelocity(0, 0);
      this.sprite.x = this.targetX;
      this.sprite.y = this.targetY;
      this.moving = false;
    } else {
      this.sprite.body.setVelocity((dx / dist) * this.speed, (dy / dist) * this.speed);
      this.facingX = dx / dist;
      this.facingY = dy / dist;
    }
    this._updateAnim(this.moving);
  }

  _updateAnim(isMoving) {
    const vx = this.sprite.body.velocity.x;
    const vy = this.sprite.body.velocity.y;
    const spd = Math.sqrt(vx * vx + vy * vy);

    // 방향 결정
    if (spd > 20) {
      if (Math.abs(vx) >= Math.abs(vy)) {
        this._lastDir = vx > 0 ? 'right' : 'left';
      } else {
        this._lastDir = vy > 0 ? 'down' : 'up';
      }
      this.facingX = vx / spd;
      this.facingY = vy / spd;
    }

    const dir = this._lastDir;
    const isLeft = dir === 'left';
    this.sprite.setFlipX(isLeft);
    const baseDir = isLeft ? 'right' : dir;
    const animKey = (isMoving && spd > 20)
      ? `player_walk_${baseDir}`
      : `player_idle_${baseDir}`;

    if (this.sprite.anims.currentAnim?.key !== animKey) {
      this.sprite.play(animKey, true);
    }
  }

  get x() { return this.sprite.x; }
  get y() { return this.sprite.y; }
}
