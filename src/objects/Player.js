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

    // ── 스탯 ──
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

    // 노란 사각형 캐릭터
    this.sprite = scene.add.rectangle(x, y, 32, 32, 0xffdd00);
    scene.physics.add.existing(this.sprite);
    this.sprite.body.setCollideWorldBounds(false);
    this.sprite.setDepth(5);

    // 방향 표시 삼각형
    this._dirGfx = scene.add.graphics().setDepth(6);

    this.speed   = 220;
    this.targetX = x;
    this.targetY = y;
    this.moving  = false;

    this.padDx = 0;
    this.padDy = 0;

    this.facingX = 1;
    this.facingY = 0;
  }

  // ── 피격 ──────────────────────────────────────────────────────────────────
  takeDamage(amount, kbDirX, kbDirY) {
    if (this.isInvincible || this.hp <= 0) return;

    this.hp = Math.max(0, this.hp - amount);

    // 빨간 데미지 숫자
    const txt = this.scene.add.text(this.sprite.x, this.sprite.y - 20, `-${amount}`, {
      fontSize: '20px', fontStyle: 'bold',
      color: '#ff4444', stroke: '#000', strokeThickness: 4,
    }).setDepth(20).setOrigin(0.5);

    this.scene.tweens.add({
      targets: txt, y: txt.y - 45, alpha: 0, duration: 900,
      onComplete: () => txt.destroy(),
    });

    // 넉백
    this._applyKnockback(kbDirX, kbDirY);

    // 무적 시작 (1.5초)
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

    // 깜빡임 트윈
    if (this._blinkTween) this._blinkTween.stop();
    this.sprite.setAlpha(1);
    this._blinkTween = this.scene.tweens.add({
      targets: this.sprite,
      alpha: 0.25,
      duration: 120,
      yoyo: true,
      repeat: -1,
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

  // ── 방향 표시 삼각형 ───────────────────────────────────────────────────────
  _drawFacing() {
    const g  = this._dirGfx;
    g.clear();

    const cx = this.sprite.x;
    const cy = this.sprite.y;
    const fx = this.facingX, fy = this.facingY;
    const px = -fy, py = fx;

    const tip = { x: cx + fx * 32, y: cy + fy * 32 };
    const l   = { x: cx + fx * 22 + px * 7, y: cy + fy * 22 + py * 7 };
    const r   = { x: cx + fx * 22 - px * 7, y: cy + fy * 22 - py * 7 };

    g.fillStyle(0xffffff, 0.9);
    g.fillTriangle(tip.x, tip.y, l.x, l.y, r.x, r.y);
    g.lineStyle(1.5, 0xffdd00, 0.8);
    g.strokeTriangle(tip.x, tip.y, l.x, l.y, r.x, r.y);
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
    if (this._isKnockback) { this._drawFacing(); return; }

    if (this.padDx !== 0 || this.padDy !== 0) {
      const len = Math.sqrt(this.padDx * this.padDx + this.padDy * this.padDy);
      this.sprite.body.setVelocity(
        (this.padDx / len) * this.speed,
        (this.padDy / len) * this.speed,
      );
      this._drawFacing();
      return;
    }

    if (!this.moving) {
      this.sprite.body.setVelocity(0, 0);
      this._drawFacing();
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
    this._drawFacing();
  }

  get x() { return this.sprite.x; }
  get y() { return this.sprite.y; }
}
