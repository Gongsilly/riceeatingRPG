/* InventoryUI.js — 메이플스토리 스타일 인벤토리 창 */
export default class InventoryUI {
  constructor(scene) {
    this.scene = scene;

    this._visible    = false;
    this._activeTab  = 'EQUIP';

    // 탭 정의
    this._tabs = [
      { key: 'EQUIP',   label: '장비',  cats: ['EQUIP']   },
      { key: 'CONSUME', label: '소비',  cats: ['CONSUME'] },
      { key: 'INSTALL', label: '설치',  cats: ['INSTALL'] },
      { key: 'ETC',     label: '기타',  cats: ['ETC']     },
      { key: 'CASH',    label: '캐시',  cats: ['CASH']    },
    ];

    // 탭별 24-슬롯 배열
    this._slots = {};
    this._tabs.forEach(t => { this._slots[t.key] = Array(24).fill(null); });

    this._objs     = []; // 창 전체 (토글 대상)
    this._itemObjs = []; // 아이템 비주얼 (탭 전환 시 재생성)
    this._tooltip  = null;
    this._tabBtns  = {};

    this._build();
  }

  // ── 창 빌드 ──────────────────────────────────────────────────────────────────
  _build() {
    const sc = this.scene;
    const W  = sc.scale.width;
    const H  = sc.scale.height;

    const WIN_W = 228;
    const WIN_H = 368;
    this._WIN_W = WIN_W;
    this._WIN_H = WIN_H;

    this._wx = W - 8 - WIN_W;
    this._wy = Math.max(8, Math.floor((H - WIN_H) / 2));
    const wx = this._wx, wy = this._wy;
    const cx = wx + WIN_W / 2;

    const reg = (o) => { this._objs.push(o); return o; };

    // ── 배경 패널 ──
    reg(sc.add.rectangle(cx, wy + WIN_H / 2, WIN_W, WIN_H, 0x090f1c, 0.97)
      .setScrollFactor(0).setDepth(72).setStrokeStyle(2, 0x3a5a8a, 0.9));

    // ── 타이틀 ──
    reg(sc.add.text(cx, wy + 15, 'INVENTORY', {
      fontSize: '13px', fontStyle: 'bold', color: '#99bbee',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(73));

    // ── 닫기 버튼 ──
    const closeBtn = reg(sc.add.rectangle(wx + WIN_W - 14, wy + 15, 22, 22, 0x3a1020, 0.9)
      .setScrollFactor(0).setDepth(73).setStrokeStyle(1, 0x883344)
      .setInteractive({ useHandCursor: true }));
    reg(sc.add.text(wx + WIN_W - 14, wy + 15, 'x', {
      fontSize: '13px', fontStyle: 'bold', color: '#ff9999',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(74));
    closeBtn.on('pointerover', () => closeBtn.setFillStyle(0x551830, 0.95));
    closeBtn.on('pointerout',  () => closeBtn.setFillStyle(0x3a1020, 0.90));
    closeBtn.on('pointerdown', (ptr) => {
      sc._gamepadPointers?.add(ptr.id);
      this.hide();
    });

    // ── 탭 바 ──
    const TAB_Y = wy + 33;
    const tabW  = WIN_W / this._tabs.length;
    this._tabs.forEach((tab, i) => {
      const tx = wx + tabW * i + tabW / 2;
      const bg = reg(sc.add.rectangle(tx, TAB_Y, tabW - 2, 20, 0x0f1e30, 0.9)
        .setScrollFactor(0).setDepth(73).setStrokeStyle(1, 0x2a3f55)
        .setInteractive({ useHandCursor: true }));
      const txt = reg(sc.add.text(tx, TAB_Y, tab.label, {
        fontSize: '10px', color: '#7799bb',
      }).setOrigin(0.5).setScrollFactor(0).setDepth(74));
      this._tabBtns[tab.key] = { bg, txt };
      bg.on('pointerover', () => { if (this._activeTab !== tab.key) bg.setFillStyle(0x1a3044, 0.95); });
      bg.on('pointerout',  () => { if (this._activeTab !== tab.key) bg.setFillStyle(0x0f1e30, 0.90); });
      bg.on('pointerdown', (ptr) => {
        sc._gamepadPointers?.add(ptr.id);
        this._switchTab(tab.key);
      });
    });

    // ── 슬롯 배경 (4 × 6 = 24칸) ──
    const SLOT = 44, GAP = 3, COLS = 4, ROWS = 6;
    this._SLOT = SLOT; this._COLS = COLS;
    const gridW   = COLS * SLOT + (COLS - 1) * GAP;
    this._gridLeft = wx + Math.floor((WIN_W - gridW) / 2);
    this._gridTop  = TAB_Y + 13;

    for (let i = 0; i < ROWS * COLS; i++) {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const sx  = this._gridLeft + col * (SLOT + GAP) + SLOT / 2;
      const sy  = this._gridTop  + row * (SLOT + GAP) + SLOT / 2;
      reg(sc.add.rectangle(sx, sy, SLOT, SLOT, 0x0b1626, 0.92)
        .setScrollFactor(0).setDepth(72).setStrokeStyle(1, 0x1c2e44));
    }
    this._GAP = GAP;

    // ── 정렬 버튼 ──
    const footY = wy + WIN_H - 16;
    const sortBtn = reg(sc.add.rectangle(wx + 42, footY, 64, 22, 0x162638, 0.92)
      .setScrollFactor(0).setDepth(73).setStrokeStyle(1, 0x2e5070)
      .setInteractive({ useHandCursor: true }));
    reg(sc.add.text(wx + 42, footY, '정렬', {
      fontSize: '11px', color: '#77aacc',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(74));
    sortBtn.on('pointerover', () => sortBtn.setFillStyle(0x1f3a52, 0.95));
    sortBtn.on('pointerout',  () => sortBtn.setFillStyle(0x162638, 0.92));
    sortBtn.on('pointerdown', (ptr) => {
      sc._gamepadPointers?.add(ptr.id);
      this._sort();
    });

    // 슬롯 카운터
    this._countTxt = reg(sc.add.text(cx + 30, footY, '0 / 24', {
      fontSize: '11px', color: '#556677',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(74));

    // ── 툴팁 컨테이너 ──
    this._tooltip = sc.add.container(0, 0).setScrollFactor(0).setDepth(82).setVisible(false);

    // 초기 숨김
    this._objs.forEach(o => o.setVisible(false));
  }

  // ── 탭 키 결정 ────────────────────────────────────────────────────────────────
  _getTabKey(category) {
    if (category === 'EQUIP')   return 'EQUIP';
    if (category === 'CONSUME') return 'CONSUME';
    if (category === 'INSTALL') return 'INSTALL';
    if (category === 'CASH')    return 'CASH';
    return 'ETC';
  }

  // ── 빈 슬롯 (최저 번호) ──────────────────────────────────────────────────────
  _findEmptySlot(tabKey) {
    return this._slots[tabKey].findIndex(s => s === null);
  }

  // ── 아이템 추가 / 스택 업데이트 ─────────────────────────────────────────────
  addItem(invItem) {
    const tabKey = this._getTabKey(invItem.master.category);
    const existIdx = this._slots[tabKey].findIndex(s => s && s.invId === invItem.invId);
    if (existIdx !== -1) {
      this._slots[tabKey][existIdx] = invItem; // 스택 수량 업데이트
    } else {
      const slot = this._findEmptySlot(tabKey);
      if (slot === -1) return; // 가득 참
      this._slots[tabKey][slot] = invItem;
    }
    if (this._visible && this._activeTab === tabKey) this._renderItems();
  }

  // ── 현재 scene.inventory 전체 동기화 ─────────────────────────────────────────
  syncFromInventory(items) {
    this._tabs.forEach(t => { this._slots[t.key] = Array(24).fill(null); });
    items.forEach(inv => {
      const tab  = this._getTabKey(inv.master.category);
      const slot = this._findEmptySlot(tab);
      if (slot !== -1) this._slots[tab][slot] = inv;
    });
    if (this._visible) this._renderItems();
  }

  // ── 탭 전환 ──────────────────────────────────────────────────────────────────
  _switchTab(tabKey) {
    this._activeTab = tabKey;
    this._hideTooltip();
    this._tabs.forEach(t => {
      const { bg, txt } = this._tabBtns[t.key];
      if (t.key === tabKey) {
        bg.setFillStyle(0x1c3a58, 0.97);
        bg.setStrokeStyle(1, 0x4488bb);
        txt.setColor('#ddeeff');
      } else {
        bg.setFillStyle(0x0f1e30, 0.90);
        bg.setStrokeStyle(1, 0x2a3f55);
        txt.setColor('#7799bb');
      }
    });
    this._renderItems();
  }

  // ── 아이템 렌더링 ─────────────────────────────────────────────────────────────
  _renderItems() {
    this._itemObjs.forEach(o => o.destroy());
    this._itemObjs = [];

    const sc  = this.scene;
    const tab = this._slots[this._activeTab];
    const S   = this._SLOT, G = this._GAP, C = this._COLS;
    let count = 0;

    tab.forEach((inv, i) => {
      if (!inv) return;
      count++;
      const col = i % C;
      const row = Math.floor(i / C);
      const sx  = this._gridLeft + col * (S + G) + S / 2;
      const sy  = this._gridTop  + row * (S + G) + S / 2;
      const m   = inv.master;

      // 슬롯 하이라이트 배경
      const bgColor = m.category === 'EQUIP'   ? 0x12182e
                    : m.category === 'CONSUME' ? 0x121e12
                    : 0x141414;
      const slotHl = sc.add.rectangle(sx, sy, S, S, bgColor, 0.95)
        .setScrollFactor(0).setDepth(73).setInteractive({ useHandCursor: true });
      this._itemObjs.push(slotHl);

      // 아이템 아이콘 (bodyColor 큰 원 + gemColor 작은 원)
      const iconY = sy - 7;
      const outer = sc.add.circle(sx, iconY, 13, m.bodyColor, 0.92).setScrollFactor(0).setDepth(74);
      const inner = sc.add.circle(sx, iconY, 6,  m.gemColor,  0.88).setScrollFactor(0).setDepth(75);
      this._itemObjs.push(outer, inner);

      // 장착 표시 (노란 테두리)
      if (inv.equipped) {
        const eq = sc.add.rectangle(sx, sy, S, S, 0, 0)
          .setStrokeStyle(2, 0xffee44, 0.9).setScrollFactor(0).setDepth(76);
        this._itemObjs.push(eq);
      }

      // 아이템 이름 (하단, 최대 6자 truncate)
      const shortName = m.name.length > 5 ? m.name.slice(0, 5) + '…' : m.name;
      const nameTxt = sc.add.text(sx, sy + S / 2 - 5, shortName, {
        fontSize: '8px', color: '#889aaa',
      }).setOrigin(0.5, 1).setScrollFactor(0).setDepth(74);
      this._itemObjs.push(nameTxt);

      // 수량 (우하단)
      if (inv.quantity > 1) {
        const qtyTxt = sc.add.text(sx + S / 2 - 3, sy + S / 2 - 5,
          `${inv.quantity}`, { fontSize: '9px', color: '#ffffff', stroke: '#000', strokeThickness: 2 })
          .setOrigin(1, 1).setScrollFactor(0).setDepth(75);
        this._itemObjs.push(qtyTxt);
      }

      // 호버 툴팁
      slotHl.on('pointerover', () => this._showTooltip(inv, sx, sy));
      slotHl.on('pointerout',  () => this._hideTooltip());
    });

    const total = tab.filter(s => s !== null).length;
    this._countTxt.setText(`${count} / 24`);
  }

  // ── 툴팁 ─────────────────────────────────────────────────────────────────────
  _showTooltip(invItem, sx, sy) {
    const sc = this.scene;
    const m  = invItem.master;
    const e  = invItem.equip;

    const lines = [];
    const catLabel = { EQUIP: '[ 장비 ]', CONSUME: '[ 소비 ]', ETC: '[ 기타 ]' }[m.category] ?? '[ 기타 ]';
    lines.push({ text: catLabel,      color: '#8888cc', size: '10px' });
    lines.push({ text: m.description, color: '#aaaaaa', size: '10px' });

    if (m.category === 'EQUIP') {
      lines.push({ text: '──────────────', color: '#233040', size: '9px' });
      if (e) {
        const fa   = m.baseAtk + e.atkBonus;
        const fs   = m.baseStr + e.strBonus;
        const fd   = m.baseDex + e.dexBonus;
        const fi   = m.baseInt + e.intBonus;
        const fl   = m.baseLuk + e.lukBonus;
        const fdef = m.baseDef + e.defBonus;
        if (fa   > 0) lines.push({ text: `공격력 : +${fa}${e.atkBonus > 0 ? `  (+${e.atkBonus})` : ''}`,   color: '#ffaa44', size: '11px' });
        if (fs   > 0) lines.push({ text: `STR : +${fs}${e.strBonus > 0 ? `  (+${e.strBonus})` : ''}`,      color: '#ff7766', size: '11px' });
        if (fd   > 0) lines.push({ text: `DEX : +${fd}${e.dexBonus > 0 ? `  (+${e.dexBonus})` : ''}`,      color: '#55ffaa', size: '11px' });
        if (fi   > 0) lines.push({ text: `INT : +${fi}${e.intBonus > 0 ? `  (+${e.intBonus})` : ''}`,      color: '#66aaff', size: '11px' });
        if (fl   > 0) lines.push({ text: `LUK : +${fl}${e.lukBonus > 0 ? `  (+${e.lukBonus})` : ''}`,      color: '#ffcc44', size: '11px' });
        if (fdef > 0) lines.push({ text: `방어력 : +${fdef}${e.defBonus > 0 ? `  (+${e.defBonus})` : ''}`, color: '#99ccff', size: '11px' });
        const remaining = e.upgradeSlots - e.upgradeCount;
        lines.push({ text: `업그레이드 가능 : ${remaining} / ${e.upgradeSlots}회`, color: '#778899', size: '10px' });
      } else {
        if (m.baseAtk > 0) lines.push({ text: `공격력 : +${m.baseAtk}`, color: '#ffaa44', size: '11px' });
        if (m.baseStr > 0) lines.push({ text: `STR : +${m.baseStr}`,    color: '#ff7766', size: '11px' });
        if (m.baseDex > 0) lines.push({ text: `DEX : +${m.baseDex}`,    color: '#55ffaa', size: '11px' });
        if (m.baseInt > 0) lines.push({ text: `INT : +${m.baseInt}`,    color: '#66aaff', size: '11px' });
        if (m.baseLuk > 0) lines.push({ text: `LUK : +${m.baseLuk}`,    color: '#ffcc44', size: '11px' });
        if (m.baseDef > 0) lines.push({ text: `방어력 : +${m.baseDef}`, color: '#99ccff', size: '11px' });
        if (m.maxUpgrade > 0) lines.push({ text: `업그레이드 가능 : 0 / ${m.maxUpgrade}회`, color: '#778899', size: '10px' });
      }
      lines.push({ text: `요구 레벨 : ${m.reqLv}`, color: '#667788', size: '10px' });

    } else if (m.category === 'CONSUME') {
      lines.push({ text: '──────────────', color: '#233040', size: '9px' });
      if (m.hpRecover > 0) lines.push({ text: `HP 회복 : +${m.hpRecover}`, color: '#ff6666', size: '11px' });
      if (m.mpRecover > 0) lines.push({ text: `MP 회복 : +${m.mpRecover}`, color: '#6688ff', size: '11px' });
    }

    lines.push({ text: '──────────────', color: '#233040', size: '9px' });
    lines.push({ text: `판매가 : ${m.sellPrice} 메소`, color: '#bbaa55', size: '10px' });
    if (invItem.quantity > 1) {
      lines.push({ text: `보유 수량 : ${invItem.quantity}개`, color: '#88aacc', size: '10px' });
    }

    // 툴팁 사이즈
    const lineH = 14;
    const padX  = 10;
    const padY  = 8;
    const bgW   = 185;
    const bgH   = lines.length * lineH + padY * 2 + 20;

    // 위치 (슬롯 왼쪽 우선, 화면 벗어나면 오른쪽)
    let tx = sx - bgW - this._SLOT / 2 - 4;
    if (tx < 4) tx = sx + this._SLOT / 2 + 4;
    let ty = sy - bgH / 2;
    const maxTy = sc.scale.height - bgH - 4;
    if (ty < 4) ty = 4;
    if (ty > maxTy) ty = maxTy;

    this._tooltip.removeAll(true);
    this._tooltip.x = tx + bgW / 2;
    this._tooltip.y = ty + bgH / 2;

    this._tooltip.add(
      sc.add.rectangle(0, 0, bgW, bgH, 0x08111e, 0.96).setStrokeStyle(1, 0xaa66ff, 0.85),
    );
    this._tooltip.add(
      sc.add.text(-bgW / 2 + padX, -bgH / 2 + padY, `✦ ${m.name}`, {
        fontSize: '13px', color: '#ffcc44', fontStyle: 'bold',
      }),
    );
    lines.forEach((line, i) => {
      this._tooltip.add(
        sc.add.text(-bgW / 2 + padX, -bgH / 2 + padY + 18 + i * lineH, line.text, {
          fontSize: line.size, color: line.color,
        }),
      );
    });

    this._tooltip.setVisible(true);
  }

  _hideTooltip() {
    this._tooltip?.setVisible(false);
  }

  // ── 정렬 (아이템 ID 기준) ────────────────────────────────────────────────────
  _sort() {
    const ORDER = [
      'snail_shell', 'blue_shell', 'spore_drop',
      'red_potion', 'orange', 'blue_potion', 'apple',
      'old_sword', 'wooden_staff', 'leather_armor', 'leather_gloves',
    ];
    const tab   = this._slots[this._activeTab];
    const items = tab.filter(s => s !== null);

    items.sort((a, b) => {
      const ia = ORDER.indexOf(a.master.id);
      const ib = ORDER.indexOf(b.master.id);
      if (ia !== -1 && ib !== -1) return ia - ib;
      if (ia !== -1) return -1;
      if (ib !== -1) return  1;
      return a.master.id.localeCompare(b.master.id);
    });

    this._slots[this._activeTab] = [
      ...items,
      ...Array(24 - items.length).fill(null),
    ];
    this._renderItems();
  }

  // ── 공개 메서드 ───────────────────────────────────────────────────────────────
  show() {
    this._visible = true;
    this._objs.forEach(o => o.setVisible(true));
    this._tooltip?.setVisible(false);
    this._switchTab(this._activeTab);
  }

  hide() {
    this._visible = false;
    this._hideTooltip();
    this._objs.forEach(o => o.setVisible(false));
    this._itemObjs.forEach(o => o.destroy());
    this._itemObjs = [];
  }

  toggle() {
    this._visible ? this.hide() : this.show();
  }

  isVisible() { return this._visible; }

  destroy() {
    this._objs.forEach(o => o.destroy());
    this._itemObjs.forEach(o => o.destroy());
    this._tooltip?.destroy();
  }
}
