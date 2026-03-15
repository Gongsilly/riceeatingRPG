/* ShopUI.js — 상점 팝업 UI */
export default class ShopUI {
  constructor(scene, player, config) {
    // config: { shopName, items: [{ code, name, price, description }] }
    this._scene  = scene;
    this._player = player;
    this._config = config;
    this._objs   = [];
    this._build();
  }

  _build() {
    const W = this._scene.scale.width;
    const H = this._scene.scale.height;
    const panW = 340, panH = 60 + this._config.items.length * 64 + 40;
    const panX = W / 2;
    const panY = H / 2;

    // 어두운 오버레이 (입력 막기)
    const overlay = this._scene.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.45)
      .setScrollFactor(0).setDepth(90).setInteractive();
    this._objs.push(overlay);

    // 패널
    const panel = this._scene.add.rectangle(panX, panY, panW, panH, 0x08121e, 0.97)
      .setScrollFactor(0).setDepth(91).setStrokeStyle(2, 0xffcc44, 1);
    this._objs.push(panel);

    // 타이틀
    const title = this._scene.add.text(panX, panY - panH / 2 + 22, `🏪 ${this._config.shopName}`, {
      fontSize: '15px', fontStyle: 'bold', color: '#ffcc44',
      stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(92);
    this._objs.push(title);

    // 메소 표시
    this._mesosTxt = this._scene.add.text(panX, panY - panH / 2 + 42, `💰 ${this._player.mesos} 메소`, {
      fontSize: '11px', color: '#ffee88', stroke: '#000', strokeThickness: 2,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(92);
    this._objs.push(this._mesosTxt);

    // 아이템 목록
    const startY = panY - panH / 2 + 66;
    const itemH  = 60;

    this._config.items.forEach((item, i) => {
      const iy = startY + i * itemH;

      // 아이템 행 배경
      const ibg = this._scene.add.rectangle(panX, iy + itemH / 2 - 6, panW - 20, itemH - 6, 0x10202e, 0.95)
        .setScrollFactor(0).setDepth(92).setStrokeStyle(1, 0x1e3a52, 0.8);
      this._objs.push(ibg);

      // 아이템 이름
      this._objs.push(this._scene.add.text(panX - 140, iy + 8, item.name, {
        fontSize: '13px', color: '#ffffff', fontStyle: 'bold',
      }).setScrollFactor(0).setDepth(93));

      // 아이템 설명
      this._objs.push(this._scene.add.text(panX - 140, iy + 26, item.description, {
        fontSize: '10px', color: '#aabbcc',
      }).setScrollFactor(0).setDepth(93));

      // 가격
      this._objs.push(this._scene.add.text(panX + 30, iy + 17, `${item.price} 메소`, {
        fontSize: '12px', color: '#ffcc44',
      }).setOrigin(0.5).setScrollFactor(0).setDepth(93));

      // 구매 버튼
      const buyBtn = this._scene.add.rectangle(panX + 120, iy + 17, 60, 26, 0x1a6644, 0.95)
        .setScrollFactor(0).setDepth(92).setStrokeStyle(1, 0x44cc88, 1)
        .setInteractive({ useHandCursor: true });
      const buyTxt = this._scene.add.text(panX + 120, iy + 17, '구매', {
        fontSize: '12px', color: '#44ff88',
      }).setOrigin(0.5).setScrollFactor(0).setDepth(93);
      buyBtn.on('pointerover', () => buyBtn.setFillStyle(0x2a8855, 0.95));
      buyBtn.on('pointerout',  () => buyBtn.setFillStyle(0x1a6644, 0.95));
      buyBtn.on('pointerdown', (_ptr, _lx, _ly, event) => { event.stopPropagation(); this._buy(item); });
      this._objs.push(buyBtn, buyTxt);
    });

    // 닫기 버튼
    const closeBtn = this._scene.add.rectangle(panX + panW / 2 - 18, panY - panH / 2 + 18, 28, 22, 0x661111, 0.9)
      .setScrollFactor(0).setDepth(92).setStrokeStyle(1, 0xcc3333, 1)
      .setInteractive({ useHandCursor: true });
    const closeTxt = this._scene.add.text(panX + panW / 2 - 18, panY - panH / 2 + 18, '✕', {
      fontSize: '13px', color: '#ff6666',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(93);
    closeBtn.on('pointerover', () => closeBtn.setFillStyle(0x882222, 0.9));
    closeBtn.on('pointerout',  () => closeBtn.setFillStyle(0x661111, 0.9));
    closeBtn.on('pointerdown', () => this.destroy());
    this._objs.push(closeBtn, closeTxt);
  }

  _buy(item) {
    if (this._player.mesos < item.price) {
      this._flashMsg('메소가 부족합니다!', '#ff6644');
      return;
    }
    this._player.mesos -= item.price;
    this._mesosTxt.setText(`💰 ${this._player.mesos} 메소`);
    this._scene._updateMesosDisplay?.();
    this._scene._buyShopItem(item.code);
    this._flashMsg(`${item.name} 구매!`, '#44ffaa');
  }

  _flashMsg(text, color) {
    const W = this._scene.scale.width;
    const H = this._scene.scale.height;
    const msg = this._scene.add.text(W / 2, H / 2 + 160, text, {
      fontSize: '14px', color, stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(95);
    this._objs.push(msg);
    this._scene.tweens.add({
      targets: msg, alpha: 0, y: msg.y - 30, duration: 1200,
      onComplete: () => { msg.destroy(); this._objs = this._objs.filter(o => o !== msg); },
    });
  }

  destroy() {
    this._objs.forEach(o => { try { o.destroy(); } catch (_) {} });
    this._objs = [];
    this._scene._shopUI = null;
  }
}
