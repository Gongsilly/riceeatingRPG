/* NPC.js — 마을 NPC (대화 / 상점) */
export default class NPC {
  constructor(scene, x, y, config) {
    this.scene  = scene;
    this.x      = x;
    this.y      = y;
    this.config = config; // { key, name, type:'talk'|'shop', dialogue:[], shopName, items:[] }
    this._RADIUS = 72;

    // 그림자
    this._shadow = scene.add.ellipse(x, y + 18, 28, 10, 0x000000, 0.22).setDepth(3);

    // 스프라이트
    this.sprite = scene.add.image(x, y, config.key).setDepth(y * 0.001 + 0.5);
    this.sprite.setInteractive({ useHandCursor: true });
    this.sprite.on('pointerdown', (_ptr, _lx, _ly, event) => {
      event.stopPropagation();
      scene._interactNPC(this);
    });

    // 이름 라벨
    this._nameLabel = scene.add.text(x, y - 30, config.name, {
      fontSize: '11px', color: '#ffff88',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5, 1).setDepth(y * 0.001 + 1);

    // 상호작용 힌트
    this._hint = scene.add.text(x, y - 44, '[ 탭 ] 대화', {
      fontSize: '9px', color: '#aaffaa',
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5, 1).setDepth(y * 0.001 + 1).setAlpha(0);

    // 이름라벨 살짝 떠다니는 효과
    scene.tweens.add({
      targets: this._nameLabel,
      y: '-=4',
      duration: 1800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });
  }

  checkProximity(player) {
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    return Math.sqrt(dx * dx + dy * dy) < this._RADIUS;
  }

  showHint(visible) {
    this._hint.setAlpha(visible ? 1 : 0);
  }

  destroy() {
    this.sprite.destroy();
    this._shadow.destroy();
    this._nameLabel.destroy();
    this._hint.destroy();
  }
}
