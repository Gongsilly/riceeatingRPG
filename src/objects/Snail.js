import { MONSTER_DATA } from '../constants/gameData';

export default class Snail {
  constructor(scene, x, y, type = 'blue_snail') {
    this.scene = scene;
    this.alive = true;
    this.speed = 40;
    this._isKnockback = false;

    const data = MONSTER_DATA[type] ?? MONSTER_DATA['blue_snail'];
    this.monsterData = data;
    this.hp    = data.hp;
    this.maxHp = data.hp;

    // 스프라이트
    this.sprite = scene.physics.add.sprite(x, y, type, 0);
    this.sprite.setDepth(4);
    this.sprite.body.setCollideWorldBounds(false);
    this.sprite.play(`${type}_walk`);

    // 그림자
    const shW = type === 'spore' ? 20 : 24;
    const shH = type === 'spore' ? 7  : 8;
    this._shadow = scene.add.ellipse(x, y + 10, shW, shH, 0x000000, 0.22).setDepth(3);

    // HP 바
    this.hpBarBg = scene.add.rectangle(x, y - 20, 30, 4, 0x333333).setDepth(4);
    this.hpBar   = scene.add.rectangle(x, y - 20, 30, 4, 0x00ff44).setDepth(4);

    // 이름 라벨
    this._nameLabel = scene.add.text(x, y + 20, data.name, {
      fontSize: '10px', color: '#dddddd',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(4);

    // AI 랜덤 이동
    this.targetX = x;
    this.targetY = y;
    this.moveTimer = scene.time.addEvent({
      delay: Phaser.Math.Between(1500, 3000),
      callback: this.pickNewTarget,
      callbackScope: this,
      loop: true,
    });
  }

  pickNewTarget() {
    if (!this.alive) return;
    this.targetX = this.sprite.x + Phaser.Math.Between(-120, 120);
    this.targetY = this.sprite.y + Phaser.Math.Between(-120, 120);
  }

  takeDamage(amount, kbDirX = 0, kbDirY = 0, isCritical = false) {
    if (!this.alive) return;
    this.hp -= amount;

    // 데미지 숫자
    const color  = isCritical ? '#ff8800' : '#ffffff';
    const size   = isCritical ? '24px'    : '18px';
    const label  = isCritical ? `${amount}!` : `${amount}`;

    const txt = this.scene.add.text(
      this.sprite.x + Phaser.Math.Between(-10, 10),
      this.sprite.y - 10, label,
      { fontSize: size, fontStyle: 'bold', color, stroke: '#000', strokeThickness: 3 },
    ).setDepth(10).setOrigin(0.5).setScale(0);

    // 팝인 → 둥실 떠오르기
    this.scene.tweens.add({
      targets: txt,
      scale: isCritical ? 1.5 : 1.1,
      duration: isCritical ? 110 : 80,
      ease: 'Back.Out',
      onComplete: () => {
        this.scene.tweens.add({
          targets: txt,
          y: txt.y - (isCritical ? 85 : 58),
          alpha: 0,
          scale: isCritical ? 1.0 : 0.75,
          duration: isCritical ? 1050 : 820,
          ease: 'Power2',
          onComplete: () => txt.destroy(),
        });
      },
    });

    // 카메라 쉐이크
    this.scene.cameras.main.shake(isCritical ? 100 : 65, isCritical ? 0.005 : 0.003);

    if ((kbDirX !== 0 || kbDirY !== 0) && !this._isKnockback) {
      this._applyKnockback(kbDirX, kbDirY);
    }

    if (this.hp <= 0) this.die();
  }

  _applyKnockback(dx, dy) {
    this._isKnockback = true;
    this.sprite.body.setVelocity(dx * 300, dy * 300);
    this.scene.time.delayedCall(200, () => {
      if (!this.alive) return;
      this._isKnockback = false;
      this.sprite.body.setVelocity(0, 0);
    });
  }

  die() {
    this.alive = false;
    this.moveTimer.remove();
    this.hpBar.destroy();
    this.hpBarBg.destroy();
    this._nameLabel.destroy();

    // 그림자 페이드아웃
    this.scene.tweens.add({
      targets: this._shadow, alpha: 0, duration: 350,
      onComplete: () => this._shadow.destroy(),
    });

    const spawnX = this.sprite.x;
    const spawnY = this.sprite.y;

    this.sprite.body.setEnable(false);
    this.sprite.body.setVelocity(0, 0);

    // 경험치 & 드롭 즉시 처리
    this.scene.player.gainExp(this.monsterData.exp);
    this.monsterData.drops.forEach(drop => {
      if (Math.random() < drop.chance) {
        this.scene.spawnItem(spawnX, spawnY, drop.itemId);
      }
    });

    // 사망 연출: 위로 떠오르며 페이드
    this.scene.tweens.add({
      targets: this.sprite,
      y: this.sprite.y - 40,
      alpha: 0,
      duration: 500,
      ease: 'Power1',
      onComplete: () => this.sprite.destroy(),
    });
  }

  update() {
    if (!this.alive) return;

    this._shadow.setPosition(this.sprite.x, this.sprite.y + 10);

    if (!this._isKnockback) {
      const dx   = this.targetX - this.sprite.x;
      const dy   = this.targetY - this.sprite.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > 5) {
        this.sprite.body.setVelocity((dx / dist) * this.speed, (dy / dist) * this.speed);
        // 방향에 따라 스프라이트 뒤집기
        if (Math.abs(dx) > 5) this.sprite.setFlipX(dx < 0);
      } else {
        this.sprite.body.setVelocity(0, 0);
      }
    }

    const ratio = Math.max(0, this.hp / this.maxHp);
    this.hpBarBg.x = this.sprite.x;
    this.hpBarBg.y = this.sprite.y - 20;
    this.hpBar.x   = this.sprite.x - 15 + (30 * ratio) / 2;
    this.hpBar.y   = this.sprite.y - 20;
    this.hpBar.width = 30 * ratio;

    this._nameLabel.x = this.sprite.x;
    this._nameLabel.y = this.sprite.y + 18;
  }
}
