import { MONSTER_DATA } from '../constants/gameData';

export default class Snail {
  constructor(scene, x, y, type = 'blue_snail') {
    this.scene = scene;
    this.alive = true;
    this.speed = 40;

    const data = MONSTER_DATA[type] ?? MONSTER_DATA['blue_snail'];
    this.monsterData = data;
    this.hp    = data.hp;
    this.maxHp = data.hp;

    // 몸통 & 껍질
    this.sprite = scene.add.ellipse(x, y, 28, 20, data.bodyColor);
    this.shell  = scene.add.ellipse(x - 4, y - 4, 16, 16, data.shellColor);

    scene.physics.add.existing(this.sprite);
    this.sprite.body.setCollideWorldBounds(false);

    // HP 바
    this.hpBarBg = scene.add.rectangle(x, y - 20, 30, 4, 0x333333);
    this.hpBar   = scene.add.rectangle(x, y - 20, 30, 4, 0x00ff44);

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

  takeDamage(amount) {
    if (!this.alive) return;
    this.hp -= amount;

    const txt = this.scene.add.text(this.sprite.x, this.sprite.y - 10, `-${amount}`, {
      fontSize: '18px', fontStyle: 'bold',
      color: '#ff3333', stroke: '#000', strokeThickness: 3,
    }).setDepth(10);

    this.scene.tweens.add({
      targets: txt, y: txt.y - 40, alpha: 0, duration: 900,
      onComplete: () => txt.destroy(),
    });

    if (this.hp <= 0) this.die();
  }

  die() {
    this.alive = false;
    const dx = this.sprite.x;
    const dy = this.sprite.y;

    this.sprite.destroy();
    this.shell.destroy();
    this.hpBar.destroy();
    this.hpBarBg.destroy();
    this.moveTimer.remove();

    // 경험치 지급
    this.scene.player.gainExp(this.monsterData.exp);

    // 드롭 테이블에 따라 아이템 스폰
    this.monsterData.drops.forEach(drop => {
      if (Math.random() < drop.chance) {
        this.scene.spawnItem(dx, dy, drop.itemId);
      }
    });
  }

  update() {
    if (!this.alive) return;

    const dx   = this.targetX - this.sprite.x;
    const dy   = this.targetY - this.sprite.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 5) {
      this.sprite.body.setVelocity((dx / dist) * this.speed, (dy / dist) * this.speed);
    } else {
      this.sprite.body.setVelocity(0, 0);
    }

    this.shell.x = this.sprite.x - 4;
    this.shell.y = this.sprite.y - 5;

    const ratio = Math.max(0, this.hp / this.maxHp);
    this.hpBarBg.x = this.sprite.x;
    this.hpBarBg.y = this.sprite.y - 20;
    this.hpBar.x   = this.sprite.x - 15 + (30 * ratio) / 2;
    this.hpBar.y   = this.sprite.y - 20;
    this.hpBar.width = 30 * ratio;
  }
}
