import { ItemRepository } from '../repositories/ItemRepository';

export default class Item {
  constructor(scene, x, y, itemCode = 'snail_shell') {
    this.scene  = scene;
    this.picked = false;

    const data = ItemRepository.getByCode(itemCode);
    this.data  = data;

    // 바닥 아이템 비주얼
    this.sprite = scene.add.rectangle(x, y, 8, 22, data.bodyColor).setDepth(2);
    this.gem    = scene.add.circle(x, y - 13, 5, data.gemColor).setDepth(3);

    // 반짝임
    scene.tweens.add({
      targets: [this.sprite, this.gem],
      alpha: 0.35, duration: 650, yoyo: true, repeat: -1,
    });

    // 툴팁 구성
    this.tooltip = this._buildTooltip(scene, x, y, data);

    // 인터랙티브
    this.sprite.setInteractive();
    this.sprite.on('pointerover', () => this.tooltip.setVisible(true));
    this.sprite.on('pointerout',  () => this.tooltip.setVisible(false));
    this.sprite.on('pointerdown', (ptr) => {
      if (ptr.leftButtonDown()) this.pickup();
    });
  }

  _buildTooltip(scene, x, y, data) {
    // 동적 라인 구성
    const lines = [];

    const catLabel = { EQUIP: '[ 장비 ]', CONSUME: '[ 소비 ]', ETC: '[ 기타 ]' }[data.category] ?? '';
    lines.push({ text: catLabel,       color: '#8888cc', size: '10px' });
    lines.push({ text: data.description, color: '#aaaaaa', size: '11px' });

    if (data.category === 'EQUIP') {
      lines.push({ text: '─────────────', color: '#2a3a55', size: '10px' });
      if (data.baseAtk > 0) lines.push({ text: `공격력 : +${data.baseAtk}`, color: '#ffaa44', size: '11px' });
      if (data.baseStr > 0) lines.push({ text: `STR : +${data.baseStr}`,    color: '#ff7766', size: '11px' });
      if (data.baseDex > 0) lines.push({ text: `DEX : +${data.baseDex}`,    color: '#55ffaa', size: '11px' });
      if (data.baseInt > 0) lines.push({ text: `INT : +${data.baseInt}`,    color: '#66aaff', size: '11px' });
      if (data.baseLuk > 0) lines.push({ text: `LUK : +${data.baseLuk}`,    color: '#ffcc44', size: '11px' });
      if (data.baseDef > 0) lines.push({ text: `방어력 : +${data.baseDef}`, color: '#99ccff', size: '11px' });
      lines.push({ text: `업그레이드 : ${data.maxUpgrade}회`, color: '#888888', size: '10px' });
      lines.push({ text: `요구 레벨 : ${data.reqLv}`,         color: '#888888', size: '10px' });
    } else if (data.category === 'CONSUME') {
      lines.push({ text: '─────────────', color: '#2a3a55', size: '10px' });
      if (data.hpRecover > 0) lines.push({ text: `HP 회복: +${data.hpRecover}`, color: '#ff6666', size: '11px' });
      if (data.mpRecover > 0) lines.push({ text: `MP 회복: +${data.mpRecover}`, color: '#6688ff', size: '11px' });
    }

    lines.push({ text: '─────────────',         color: '#2a3a55', size: '10px' });
    lines.push({ text: `판매가: ${data.sellPrice} 메소`, color: '#bbaa55', size: '10px' });
    lines.push({ text: '[ 클릭하여 줍기 ]',    color: '#55ff55', size: '10px' });

    const lineH  = 14;
    const padX   = 10;
    const padY   = 8;
    const bgW    = 172;
    const bgH    = lines.length * lineH + padY * 2 + 20; // +20 for title

    const container = scene.add.container(x + 16, y - bgH - 10).setDepth(25).setVisible(false);
    container.add(
      scene.add.rectangle(0, 0, bgW, bgH, 0x0d1422, 0.94)
        .setStrokeStyle(1, 0xaa66ff, 0.9),
    );
    // 제목
    container.add(
      scene.add.text(-bgW / 2 + padX, -bgH / 2 + padY, `✦ ${data.name}`, {
        fontSize: '13px', color: '#ffcc44', fontStyle: 'bold',
      }),
    );
    // 나머지 라인
    lines.forEach((line, i) => {
      container.add(
        scene.add.text(-bgW / 2 + padX, -bgH / 2 + padY + 18 + i * lineH, line.text, {
          fontSize: line.size, color: line.color,
        }),
      );
    });

    return container;
  }

  async pickup() {
    if (this.picked) return;
    this.picked = true;
    this.tooltip.setVisible(false);

    // 즉시 바닥 아이템 제거 애니메이션
    this.scene.tweens.add({
      targets: [this.sprite, this.gem],
      y: '-=30', alpha: 0, duration: 400,
      onComplete: () => {
        this.sprite.destroy();
        this.gem.destroy();
        this.tooltip.destroy();
      },
    });

    // DB 저장 + 인벤토리 추가
    try {
      const invItem = await ItemRepository.addToInventory(this.data.id);
      this.scene.inventory.push(invItem);
      this.scene._inventoryUI?.addItem(invItem);
      this.scene._showPickupToast?.(invItem);
      // 아이템 루팅 즉시 저장
      this.scene._saveManager?.saveNow('item_loot');
    } catch (_e) {
      // fallback: API 실패 시 로컬 추가
      const fallback = { invId: -1, userId: 'local', quantity: 1, equipped: false, master: this.data };
      this.scene.inventory.push(fallback);
      this.scene._inventoryUI?.addItem(fallback);
      this.scene._showPickupToast?.(fallback);
      this.scene._saveManager?.saveNow('item_loot');
    }
  }

  updateTooltipPos() {
    this.tooltip.x = this.sprite.x + 16;
    this.tooltip.y = this.sprite.y - 60;
  }
}
