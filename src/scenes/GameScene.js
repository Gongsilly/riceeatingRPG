import Player    from '../objects/Player.js';
import Snail     from '../objects/Snail.js';
import MeleeAttack from '../objects/MeleeAttack.js';
import Item      from '../objects/Item.js';

const MAP_W = 3200;
const MAP_H = 2400;

// 모바일 여부 판단
const IS_MOBILE = ('ontouchstart' in window) && !window.matchMedia('(pointer:fine)').matches;

export default class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
    this.snails    = [];
    this.attacks   = [];
    this.items     = [];
    this.inventory = [];
    this._isDead   = false;
  }

  create() {
    // ── 타일맵 배경 ──
    this._buildTilemap();

    this.physics.world.setBounds(0, 0, MAP_W, MAP_H);

    // ── 플레이어 ──
    this.player = new Player(this, MAP_W / 2, MAP_H / 2);

    // ── 카메라 ──
    this.cameras.main.setBounds(0, 0, MAP_W, MAP_H);
    this.cameras.main.startFollow(this.player.sprite, true, 0.1, 0.1);

    // ── 몬스터 스폰 ──
    const spawnConfig = [
      { type: 'green_snail', count: 15 },
      { type: 'blue_snail',  count: 10 },
      { type: 'spore',       count: 8  },
    ];
    spawnConfig.forEach(({ type, count }) => {
      for (let i = 0; i < count; i++) {
        this.snails.push(new Snail(this,
          Phaser.Math.Between(200, MAP_W - 200),
          Phaser.Math.Between(200, MAP_H - 200),
          type,
        ));
      }
    });

    this.game.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    this._gamepadPointers = new Set();

    // ── 월드 입력 ──
    this.input.on('pointerup', (ptr) => {
      const wasGamepad = this._gamepadPointers.has(ptr.id);
      this._gamepadPointers.delete(ptr.id);
      if (wasGamepad) return;
      if (!ptr.rightButtonReleased()) this.player.moveTo(ptr.worldX, ptr.worldY);
    });

    this.input.on('pointerdown', (ptr) => {
      if (ptr.rightButtonDown()) {
        this._doMeleeAttack(ptr.worldX, ptr.worldY);
      }
    });

    // ── UI 구성 ──
    this._buildStatusUI();
    this._buildExpBar();
    this._buildGamepad();
    if (IS_MOBILE) this._buildLootButton();
    this._buildStatWindow();
    this._buildLighting();
  }

  // ── 스테이터스 UI (HP/MP, 좌상단) ─────────────────────────────────────────
  _buildStatusUI() {
    const barW = 160;
    const barH = 13;
    const lx   = 12;
    const ly   = 12;

    // 버전 텍스트
    this._versionTxt = this.add.text(lx, ly, 'v0.000.011', {
      fontSize: '11px', color: '#aaaacc', backgroundColor: '#00000077', padding: { x:4,y:2 },
    }).setScrollFactor(0).setDepth(50);

    const hy = ly + 22;
    const my = hy + 20;

    // HP 배경 + 채움
    this.add.rectangle(lx + barW/2, hy, barW, barH, 0x220000, 0.8)
      .setScrollFactor(0).setDepth(50).setStrokeStyle(1, 0x882222);
    this._hpFill = this.add.rectangle(lx, hy, barW, barH - 2, 0xff3333, 0.9)
      .setScrollFactor(0).setDepth(51).setOrigin(0, 0.5);
    this._hpTxt  = this.add.text(lx + barW/2, hy, '', {
      fontSize: '9px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(52);

    // MP 배경 + 채움
    this.add.rectangle(lx + barW/2, my, barW, barH, 0x001122, 0.8)
      .setScrollFactor(0).setDepth(50).setStrokeStyle(1, 0x224488);
    this._mpFill = this.add.rectangle(lx, my, barW, barH - 2, 0x3399ff, 0.9)
      .setScrollFactor(0).setDepth(51).setOrigin(0, 0.5);
    this._mpTxt  = this.add.text(lx + barW/2, my, '', {
      fontSize: '9px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(52);

    this._statusBarW = barW;
    this._statusLx   = lx;

    // 몬스터/인벤토리 텍스트
    this._infoTxt = this.add.text(lx, my + 18, '', {
      fontSize: '11px', color: '#cccccc', backgroundColor: '#00000077', padding: {x:4,y:2},
    }).setScrollFactor(0).setDepth(50);

    // STAT 버튼
    const statBtnY = my + 18 + 22;
    const statBtn = this.add.rectangle(lx + 28, statBtnY, 56, 20, 0x1a2a44, 0.92)
      .setScrollFactor(0).setDepth(50).setStrokeStyle(1, 0x4466aa)
      .setInteractive({ useHandCursor: true });
    this.add.text(lx + 28, statBtnY, 'STAT', {
      fontSize: '11px', color: '#88bbff', fontStyle: 'bold',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(51);
    statBtn.on('pointerover',  () => statBtn.setFillStyle(0x2a3d60, 0.95));
    statBtn.on('pointerout',   () => statBtn.setFillStyle(0x1a2a44, 0.92));
    statBtn.on('pointerdown', (ptr) => {
      this._gamepadPointers.add(ptr.id);
      this._toggleStatWindow();
    });
  }

  // ── EXP 바 (하단 중앙) ──────────────────────────────────────────────────────
  _buildExpBar() {
    const W  = this.scale.width;
    const H  = this.scale.height;
    const bw = Math.min(W * 0.55, 340);
    const bh = 14;
    const bx = W / 2;
    const by = H - 18;

    this.add.rectangle(bx, by, bw, bh, 0x000000, 0.6)
      .setScrollFactor(0).setDepth(55).setOrigin(0.5).setStrokeStyle(1, 0x4455aa, 0.8);

    this._expBarFill = this.add.rectangle(bx - bw/2, by, 0, bh - 2, 0x44aaff, 0.9)
      .setScrollFactor(0).setDepth(56).setOrigin(0, 0.5);

    this._expText = this.add.text(bx, by, '', {
      fontSize: '10px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(57);

    this._expBarWidth = bw;
    this._expBarLeft  = bx - bw / 2;
  }

  // ── 가상 게임패드 ────────────────────────────────────────────────────────────
  _buildGamepad() {
    const W = this.scale.width;
    const H = this.scale.height;

    // 아날로그 스틱
    const baseR = 65, padL = 30;
    const bx = padL + baseR, by = H - padL - baseR;
    this._stick = { active: false, pid: null, bx, by, baseR, tx: bx, ty: by };
    this._stickBase  = this.add.graphics().setScrollFactor(0).setDepth(60);
    this._stickThumb = this.add.graphics().setScrollFactor(0).setDepth(61);
    this._drawStick(bx, by);

    const stickZone = this.add.zone(bx, by, baseR * 2.8, baseR * 2.8)
      .setScrollFactor(0).setDepth(59).setInteractive();
    stickZone.on('pointerdown', (ptr) => {
      this._stick.active = true;
      this._stick.pid = ptr.id;
      this._gamepadPointers.add(ptr.id);
      this._updateStick(ptr.x, ptr.y);
    });

    // 공격 버튼
    const atkR = 40, padR = 30;
    const ax = W - padR - atkR, ay = H - padR - atkR;
    const atkGfx = this.add.graphics().setScrollFactor(0).setDepth(60);
    this.add.text(ax, ay, '⚔\n공격', {
      fontSize: '13px', color: '#fff', fontStyle: 'bold', align: 'center',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(61);

    const drawAtk = (p) => {
      atkGfx.clear();
      atkGfx.fillStyle(p ? 0xcc44ff : 0x9933ff, p ? 0.9 : 0.65);
      atkGfx.fillCircle(ax, ay, atkR);
      atkGfx.lineStyle(2, 0xdd88ff, 0.8);
      atkGfx.strokeCircle(ax, ay, atkR);
    };
    drawAtk(false);

    const atkZone = this.add.zone(ax, ay, atkR * 2.2, atkR * 2.2)
      .setScrollFactor(0).setDepth(59).setInteractive();
    atkZone.on('pointerdown', (ptr) => {
      this._gamepadPointers.add(ptr.id);
      drawAtk(true);
      if (navigator.vibrate) navigator.vibrate(30);
      const tx = this.player.x + this.player.facingX * 300;
      const ty = this.player.y + this.player.facingY * 300;
      this._doMeleeAttack(tx, ty);
    });
    atkZone.on('pointerup',  () => drawAtk(false));
    atkZone.on('pointerout', () => drawAtk(false));

    // 스틱 전역 이벤트
    this.input.on('pointermove', (ptr) => {
      if (this._stick.active && ptr.id === this._stick.pid) this._updateStick(ptr.x, ptr.y);
    });
    this.input.on('pointerup', (ptr) => {
      if (ptr.id === this._stick.pid) {
        this._stick.active = false;
        this._stick.pid    = null;
        this._updateStick(bx, by);
        this.player.setPadDirection(0, 0);
      }
    });
  }

  // ── 줍기 버튼 (모바일 전용) ─────────────────────────────────────────────────
  _buildLootButton() {
    const W  = this.scale.width;
    const H  = this.scale.height;
    const lx = W - 30 - 40;
    const ly = H - 30 - 40 - 95; // 공격 버튼 위

    const gfx = this.add.graphics().setScrollFactor(0).setDepth(60);
    const txt = this.add.text(lx, ly, '줍기', {
      fontSize: '13px', color: '#fff', fontStyle: 'bold',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(61).setVisible(false);

    const draw = (visible, pressed = false) => {
      gfx.clear();
      txt.setVisible(visible);
      if (!visible) return;
      gfx.fillStyle(pressed ? 0xffee00 : 0xcc9900, pressed ? 0.95 : 0.75);
      gfx.fillCircle(lx, ly, 36);
      gfx.lineStyle(2, 0xffee44, 0.9);
      gfx.strokeCircle(lx, ly, 36);
    };

    this._lootBtnVisible = false;
    this._drawLootBtn    = draw;

    const zone = this.add.zone(lx, ly, 80, 80)
      .setScrollFactor(0).setDepth(59).setInteractive();

    zone.on('pointerdown', (ptr) => {
      if (!this._lootBtnVisible) return;
      this._gamepadPointers.add(ptr.id);
      draw(true, true);
      if (navigator.vibrate) navigator.vibrate(20);

      // 가장 가까운 아이템 줍기
      let nearest = null, nearDist = Infinity;
      this.items.forEach(item => {
        if (item.picked) return;
        const d = Phaser.Math.Distance.Between(
          this.player.x, this.player.y, item.sprite.x, item.sprite.y,
        );
        if (d < 100 && d < nearDist) { nearDist = d; nearest = item; }
      });
      if (nearest) nearest.pickup();
    });
    zone.on('pointerup',  () => draw(this._lootBtnVisible, false));
    zone.on('pointerout', () => draw(this._lootBtnVisible, false));
  }

  // ── 스틱 헬퍼 ───────────────────────────────────────────────────────────────
  _updateStick(px, py) {
    const { bx, by, baseR } = this._stick;
    const dx = px - bx, dy = py - by;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const c  = Math.min(dist, baseR);
    const tx = dist > 0 ? bx + (dx / dist) * c : bx;
    const ty = dist > 0 ? by + (dy / dist) * c : by;
    this._stick.tx = tx; this._stick.ty = ty;
    this._drawStick(tx, ty);
    dist > 8
      ? this.player.setPadDirection(dx / dist, dy / dist)
      : this.player.setPadDirection(0, 0);
  }

  _drawStick(tx, ty) {
    const { bx, by, baseR } = this._stick;
    this._stickBase.clear();
    this._stickBase.lineStyle(2, 0xffffff, 0.25);
    this._stickBase.strokeCircle(bx, by, baseR);
    this._stickBase.fillStyle(0xffffff, 0.07);
    this._stickBase.fillCircle(bx, by, baseR);
    this._stickThumb.clear();
    this._stickThumb.fillStyle(0xffffff, 0.55);
    this._stickThumb.fillCircle(tx, ty, 26);
    this._stickThumb.lineStyle(2, 0xffffff, 0.9);
    this._stickThumb.strokeCircle(tx, ty, 26);
  }

  // ── 아이템 스폰 ─────────────────────────────────────────────────────────────
  spawnItem(x, y, itemId = 'snail_shell') {
    this.items.push(new Item(this, x, y, itemId));
  }

  // ── 게임 오버 ───────────────────────────────────────────────────────────────
  onPlayerDead() {
    if (this._isDead) return;
    this._isDead = true;

    const W = this.scale.width, H = this.scale.height;
    this.add.rectangle(W/2, H/2, W, H, 0x000000, 0.65).setScrollFactor(0).setDepth(80);
    this.add.text(W/2, H/2 - 30, 'GAME OVER', {
      fontSize: '40px', fontStyle: 'bold', color: '#ff4444',
      stroke: '#000', strokeThickness: 6,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(81);
    this.add.text(W/2, H/2 + 20, '탭하여 재시작', {
      fontSize: '18px', color: '#ffffff',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(81);

    this.input.once('pointerdown', () => this.scene.restart());
  }

  // ── 업데이트 루프 ────────────────────────────────────────────────────────────
  update(time, delta) {
    if (this._isDead) return;

    this.player.update();

    // 몬스터 업데이트 + 플레이어 충돌
    this.snails = this.snails.filter(s => s.alive);
    this.snails.forEach(s => {
      s.update();
      // 충돌 피격
      const dist = Phaser.Math.Distance.Between(
        this.player.x, this.player.y, s.sprite.x, s.sprite.y,
      );
      if (dist < 28) {
        const dx = this.player.x - s.sprite.x;
        const dy = this.player.y - s.sprite.y;
        const len = Math.sqrt(dx*dx + dy*dy) || 1;
        this.player.takeDamage(s.monsterData.damage, dx/len, dy/len);
      }
    });

    // 근접 공격 애니메이션 업데이트 (히트 판정은 _doMeleeAttack에서 즉시 처리)
    this.attacks = this.attacks.filter(a => a.alive);
    this.attacks.forEach(a => a.update(delta));

    // 아이템
    this.items = this.items.filter(i => !i.picked);
    this.items.forEach(i => i.updateTooltipPos());

    // 줍기 버튼 가시성 (모바일)
    if (this._drawLootBtn) {
      const near = this.items.some(i =>
        !i.picked &&
        Phaser.Math.Distance.Between(this.player.x, this.player.y, i.sprite.x, i.sprite.y) < 100,
      );
      if (near !== this._lootBtnVisible) {
        this._lootBtnVisible = near;
        this._drawLootBtn(near, false);
      }
    }

    // ── HP/MP 바 업데이트 ──
    const p   = this.player;
    const hpR = p.hp / p.maxHp;
    const mpR = p.mp / p.maxMp;
    this._hpFill.width = this._statusBarW * hpR;
    this._mpFill.width = this._statusBarW * mpR;
    this._hpTxt.setText(`HP  ${p.hp} / ${p.maxHp}`);
    this._mpTxt.setText(`MP  ${p.mp} / ${p.maxMp}`);
    this._infoTxt.setText(`🐌 ${this.snails.length}마리  🎒 ${this.inventory.length}칸`);

    // ── EXP 바 업데이트 ──
    const expR = p.level >= 20 ? 1 : p.currentExp / p.maxExp;
    this._expBarFill.width = this._expBarWidth * expR;
    const pct = p.level >= 20 ? 'MAX' : `${Math.floor(expR * 100)}%`;
    this._expText.setText(`Lv.${p.level}  ${p.currentExp} / ${p.maxExp} EXP  (${pct})`);
  }

  // ── 스탯창 ──────────────────────────────────────────────────────────────────
  _buildStatWindow() {
    const W  = this.scale.width;
    const H  = this.scale.height;
    const cx = W / 2;
    const cy = H / 2 - 20;
    const pw = 260, ph = 310;

    this._statWinObjs = [];
    const reg = (obj) => { this._statWinObjs.push(obj); return obj; };

    // 배경
    reg(this.add.rectangle(cx, cy, pw, ph, 0x080e1c, 0.93)
      .setScrollFactor(0).setDepth(70).setStrokeStyle(2, 0x4455bb, 0.9));

    // 타이틀
    reg(this.add.text(cx, cy - ph / 2 + 20, '⚔  STAT', {
      fontSize: '16px', fontStyle: 'bold', color: '#99bbff',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(71));

    // AP 텍스트
    this._apTxt = reg(this.add.text(cx, cy - ph / 2 + 42, 'AP: 0', {
      fontSize: '14px', color: '#ffee44', fontStyle: 'bold',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(71));

    // 구분선
    reg(this.add.rectangle(cx, cy - ph / 2 + 57, pw - 24, 1, 0x334466)
      .setScrollFactor(0).setDepth(71));

    // 스탯 행 (STR / DEX / INT / LUK)
    const statDefs = [
      { label: 'STR', key: 'str', color: '#ff7766' },
      { label: 'DEX', key: 'dex', color: '#55ffaa' },
      { label: 'INT', key: 'int', color: '#66aaff' },
      { label: 'LUK', key: 'luk', color: '#ffcc44' },
    ];
    this._statValueTxts = {};

    statDefs.forEach(({ label, key, color }, i) => {
      const ry = cy - ph / 2 + 86 + i * 54;

      reg(this.add.text(cx - 95, ry, label, {
        fontSize: '15px', fontStyle: 'bold', color,
      }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(71));

      const valTxt = reg(this.add.text(cx + 5, ry, '5', {
        fontSize: '15px', color: '#ffffff', fontStyle: 'bold',
      }).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(71));
      this._statValueTxts[key] = valTxt;

      // + 버튼
      const btnBg = reg(this.add.rectangle(cx + 85, ry, 42, 36, 0x1e3a5f, 0.9)
        .setScrollFactor(0).setDepth(71)
        .setStrokeStyle(1, 0x3d6fa0)
        .setInteractive({ useHandCursor: true }));
      reg(this.add.text(cx + 85, ry, '+', {
        fontSize: '22px', fontStyle: 'bold', color: '#aaddff',
      }).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(72));

      btnBg.on('pointerover',  () => btnBg.setFillStyle(0x2e5580, 0.95));
      btnBg.on('pointerout',   () => btnBg.setFillStyle(0x1e3a5f, 0.90));
      btnBg.on('pointerdown', (ptr) => {
        this._gamepadPointers.add(ptr.id);
        if (this.player.ap <= 0) return;
        this.player.ap--;
        this.player[key]++;
        this._updateStatWindow();
        if (navigator.vibrate) navigator.vibrate(15);
      });
    });

    // 닫기 버튼
    const closeBg = reg(this.add.rectangle(cx + pw / 2 - 18, cy - ph / 2 + 18, 28, 28, 0x3a1020, 0.9)
      .setScrollFactor(0).setDepth(72)
      .setStrokeStyle(1, 0x883344)
      .setInteractive({ useHandCursor: true }));
    reg(this.add.text(cx + pw / 2 - 18, cy - ph / 2 + 18, '✕', {
      fontSize: '13px', color: '#ff9999',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(73));
    closeBg.on('pointerover',  () => closeBg.setFillStyle(0x551830, 0.95));
    closeBg.on('pointerout',   () => closeBg.setFillStyle(0x3a1020, 0.90));
    closeBg.on('pointerdown', (ptr) => {
      this._gamepadPointers.add(ptr.id);
      this._toggleStatWindow();
    });

    // 기준 Y 저장 후 숨김
    this._statWinBaseY = new Map(this._statWinObjs.map(o => [o, o.y]));
    this._statWinObjs.forEach(o => o.setVisible(false));
    this._statWinVisible = false;
  }

  _toggleStatWindow() {
    this._statWinVisible = !this._statWinVisible;
    this._statWinObjs.forEach(o => this.tweens.killTweensOf(o));

    if (this._statWinVisible) {
      this._updateStatWindow();
      // 아래에서 슬라이드 업 + 페이드인
      this._statWinObjs.forEach(o => {
        o.y = this._statWinBaseY.get(o) + 42;
        o.setVisible(true).setAlpha(0);
        this.tweens.add({
          targets: o,
          y: this._statWinBaseY.get(o),
          alpha: 1,
          duration: 300,
          ease: 'Power3.Out',
        });
      });
    } else {
      // 아래로 슬라이드 아웃 + 페이드아웃
      this._statWinObjs.forEach(o => {
        const baseY = this._statWinBaseY.get(o);
        this.tweens.add({
          targets: o,
          y: baseY + 25,
          alpha: 0,
          duration: 200,
          ease: 'Power2.In',
          onComplete: () => {
            o.setVisible(false);
            o.y = baseY;
          },
        });
      });
    }
  }

  _updateStatWindow() {
    if (!this._apTxt) return;
    const p = this.player;
    this._apTxt.setText(`AP: ${p.ap}`);
    ['str', 'dex', 'int', 'luk'].forEach(k => {
      this._statValueTxts[k].setText(`${p[k]}`);
    });
  }

  // ── 근접 공격 실행 ───────────────────────────────────────────────────────────
  _doMeleeAttack(targetX, targetY) {
    // 플레이어 → 타겟 방향 계산
    const dx  = targetX - this.player.x;
    const dy  = targetY - this.player.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const fx  = dx / len;
    const fy  = dy / len;

    // 플레이어 방향 업데이트
    this.player.facingX = fx;
    this.player.facingY = fy;

    const attack = new MeleeAttack(this, this.player.x, this.player.y, fx, fy);
    this.attacks.push(attack);

    // 즉시 히트 판정 (부채꼴 안의 모든 몬스터)
    this.snails.filter(s => s.alive).forEach(snail => {
      if (!attack.checkHit(snail)) return;

      const isCritical = Math.random() < 0.20;
      const base = Phaser.Math.Between(12, 25);
      const dmg  = isCritical ? Math.floor(base * 1.5) : base;

      // 넉백: 플레이어→몬스터 방향으로 밀기
      const kbx = snail.sprite.x - this.player.x;
      const kby = snail.sprite.y - this.player.y;
      const kbl = Math.sqrt(kbx * kbx + kby * kby) || 1;
      snail.takeDamage(dmg, kbx / kbl, kby / kbl, isCritical);
    });
  }

  // ── 라이팅 (비넷 + 블룸) ────────────────────────────────────────────────────
  _buildLighting() {
    if (!this.game.renderer.gl) return; // WebGL 전용
    try {
      const fx = this.cameras.main.postFX;
      // 비넷: 화면 외곽을 어둡게
      fx.addVignette(0.5, 0.5, 0.75, 0.35);
      // 블룸: 밝은 오브젝트(파티클 등) 빛 번짐
      fx.addBloom(0xffffff, 1, 1, 1, 0.18, 4);
    } catch (e) {
      // postFX 미지원 환경 무시
    }
  }

  // ── 타일맵 ───────────────────────────────────────────────────────────────────
  _buildTilemap() {
    const mapData = this._generateMapData();
    const map = this.make.tilemap({ data: mapData, tileWidth: 32, tileHeight: 32 });
    const tileset = map.addTilesetImage('tiles', 'tileset', 32, 32, 0, 0, 1);
    map.createLayer(0, tileset, 0, 0).setDepth(-2);
    this._placeTreeDecorations();
  }

  _generateMapData() {
    const COLS = MAP_W / 32;  // 100
    const ROWS = MAP_H / 32;  // 75
    const data  = [];
    for (let r = 0; r < ROWS; r++) {
      const row = [];
      for (let c = 0; c < COLS; c++) {
        const onHPath = r >= 36 && r <= 38;
        const onVPath = c >= 48 && c <= 50;
        if (onHPath || onVPath) {
          row.push(4 + ((c + r) % 2)); // 흙 (4 or 5)
        } else {
          const h = (c * 31 + r * 17) % 100;
          if (h < 38)      row.push(1); // 어두운 잔디
          else if (h < 68) row.push(2); // 중간 잔디
          else if (h < 85) row.push(3); // 밝은 잔디
          else             row.push(6); // 꽃 잔디
        }
      }
      data.push(row);
    }
    return data;
  }

  _placeTreeDecorations() {
    const rng = (min, max) => Phaser.Math.Between(min, max);
    const positions = [];

    // 맵 테두리 나무
    for (let i = 0; i < 50; i++) {
      positions.push([rng(16, 120),           rng(16, MAP_H - 16)]);
      positions.push([rng(MAP_W - 120, MAP_W - 16), rng(16, MAP_H - 16)]);
    }
    for (let i = 0; i < 30; i++) {
      positions.push([rng(120, MAP_W - 120), rng(16, 100)]);
      positions.push([rng(120, MAP_W - 120), rng(MAP_H - 100, MAP_H - 16)]);
    }
    // 내부 산발적 나무
    for (let i = 0; i < 40; i++) {
      const x = rng(150, MAP_W - 150);
      const y = rng(150, MAP_H - 150);
      if (Math.abs(x - MAP_W/2) > 350 || Math.abs(y - MAP_H/2) > 300) {
        positions.push([x, y]);
      }
    }

    positions.forEach(([x, y]) => {
      this.add.image(x, y, 'tree').setDepth(y * 0.001); // y-sort depth
    });
  }
}
