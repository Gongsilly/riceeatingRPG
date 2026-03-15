import { ItemRepository } from '../repositories/ItemRepository';

export default class Item {
  constructor(scene, x, y, itemId = 'snail_shell') {
    this.scene  = scene;
    this.picked = false;

    const data  = ItemRepository.getById(itemId);
    this.data   = data;

    // 아이템 스프라이트
    this.sprite = scene.add.rectangle(x, y, 8, 22, data.bodyColor).setDepth(2);
    this.gem    = scene.add.circle(x, y - 13, 5, data.gemColor).setDepth(3);

    // 반짝임
    scene.tweens.add({
      targets: [this.sprite, this.gem],
      alpha: 0.35, duration: 650, yoyo: true, repeat: -1,
    });

    // 툴팁
    this.tooltip = scene.add.container(x + 16, y - 60).setDepth(20).setVisible(false);
    const bg    = scene.add.rectangle(0, 0, 170, 70, 0x111122, 0.93).setStrokeStyle(1, 0xaa66ff);
    const title = scene.add.text(-77, -27, `✦ ${data.name}`, { fontSize: '13px', color: '#ffcc44', fontStyle: 'bold' });
    const desc  = scene.add.text(-77,  -8, data.description,   { fontSize: '11px', color: '#aaaaaa' });
    const hint  = scene.add.text(-77,   8, '[ 클릭하여 줍기 ]', { fontSize: '10px', color: '#55ff55' });
    this.tooltip.add([bg, title, desc, hint]);

    // 인터랙티브
    this.sprite.setInteractive();
    this.sprite.on('pointerover', () => this.tooltip.setVisible(true));
    this.sprite.on('pointerout',  () => this.tooltip.setVisible(false));
    this.sprite.on('pointerdown', (ptr) => {
      if (ptr.leftButtonDown()) this.pickup();
    });
  }

  pickup() {
    if (this.picked) return;
    this.picked = true;
    this.tooltip.setVisible(false);

    this.scene.inventory.push({ ...this.data });
    console.log('[줍기]', this.data.name, '| 인벤토리:', this.scene.inventory.map(i => i.name));

    this.scene.tweens.add({
      targets: [this.sprite, this.gem],
      y: '-=30', alpha: 0, duration: 400,
      onComplete: () => {
        this.sprite.destroy();
        this.gem.destroy();
        this.tooltip.destroy();
      },
    });
  }

  updateTooltipPos() {
    this.tooltip.x = this.sprite.x + 16;
    this.tooltip.y = this.sprite.y - 60;
  }
}
