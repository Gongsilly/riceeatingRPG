import Player    from '../objects/Player.js';
import Snail     from '../objects/Snail.js';
import MagicClaw from '../objects/MagicClaw.js';
import Item      from '../objects/Item.js';

const MAP_W = 3200;
const MAP_H = 2400;

// 모바일 여부 판단
const IS_MOBILE = ('ontouchstart' in window) && !window.matchMedia('(pointer:fine)').matches;

export default class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
    this.snails    = [];
    this.claws     = [];
    this.items     = [];
    this.inventory = [];
    this.hitSnails = new Set();
    this._isDead   = false;
  }

  create() {
    // ── 맵 배경 ──
    const mapGfx = this.add.graphics();
    mapGfx.fillStyle(0x0d1b2a, 1);
    mapGfx.fillRect(0, 0, MAP_W, MAP_H);
    mapGfx.lineStyle(1, 0x1a2a3a, 0.6);
    for (let x = 0; x < MAP_W; x += 64) mapGfx.lineBetween(x, 0, x, MAP_H);
    for (let y = 0; y < MAP_H; y += 64) mapGfx.lineBetween(0, y, MAP_W, y);

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
        const claw = new MagicClaw(this, this.player.x, this.player.y, ptr.worldX, ptr.worldY);
        this.claws.push(claw);
        this.hitSnails = new Set();
      }
    });

    // ── UI 구성 ──
    this._buildStatusUI();
    this._buildExpBar();
    this._buildGamepad();
    if (IS_MOBILE) this._buildLootButton();
  }

  // ── 스테이터스 UI (HP/MP, 좌상단) ─────────────────────────────────────────
  _buildStatusUI() {
    const barW = 160;
    const barH = 13;
    const lx   = 12;
    const ly   = 12;

    // 버전 텍스트
    this._versionTxt = this.add.text(lx, ly, 'v0.000.003', {
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
    this.add.text(ax, ay, '✦\n클로', {
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
      this.claws.push(new MagicClaw(this, this.player.x, this.player.y, tx, ty));
      this.hitSnails = new Set();
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

    // 매직클로 업데이트 & 히트 체크
    this.claws = this.claws.filter(c => c.alive);
    this.claws.forEach(claw => {
      claw.update(delta);
      this.snails.forEach(snail => {
        const key = `${claw}:${snail}`;
        if (!this.hitSnails.has(key) && claw.checkHit(snail)) {
          this.hitSnails.add(key);
          snail.takeDamage(Phaser.Math.Between(12, 25));
        }
      });
    });

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
}
