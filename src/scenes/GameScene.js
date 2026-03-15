import Player     from '../objects/Player.js';
import Snail      from '../objects/Snail.js';
import MagicClaw  from '../objects/MagicClaw.js';
import Item       from '../objects/Item.js';

const MAP_W = 3200;
const MAP_H = 2400;

export default class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
    this.snails    = [];
    this.claws     = [];
    this.items     = [];
    this.inventory = [];
    this.hitSnails = new Set(); // 클로 한 번에 중복 히트 방지
  }

  create() {
    // ── 맵 배경 타일 그리기 ──
    const mapGfx = this.add.graphics();
    mapGfx.fillStyle(0x0d1b2a, 1);
    mapGfx.fillRect(0, 0, MAP_W, MAP_H);

    mapGfx.lineStyle(1, 0x1a2a3a, 0.6);
    for (let x = 0; x < MAP_W; x += 64) mapGfx.lineBetween(x, 0, x, MAP_H);
    for (let y = 0; y < MAP_H; y += 64) mapGfx.lineBetween(0, y, MAP_W, y);

    // ── 물리 월드 경계 ──
    this.physics.world.setBounds(0, 0, MAP_W, MAP_H);

    // ── 플레이어 ──
    this.player = new Player(this, MAP_W / 2, MAP_H / 2);
    this.player.sprite.setDepth(5);

    // ── 카메라 ──
    this.cameras.main.setBounds(0, 0, MAP_W, MAP_H);
    this.cameras.main.startFollow(this.player.sprite, true, 0.1, 0.1);

    // ── 달팽이 30마리 스폰 ──
    for (let i = 0; i < 30; i++) {
      this.snails.push(new Snail(this,
        Phaser.Math.Between(200, MAP_W - 200),
        Phaser.Math.Between(200, MAP_H - 200),
      ));
    }

    // 우클릭 컨텍스트 메뉴 막기
    this.game.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    // 게임패드를 터치 중인 포인터 ID 추적
    this._gamepadPointers = new Set();

    // ── 월드 탭 → 이동 / PC 우클릭 → 매직클로 ──
    this.input.on('pointerup', (ptr) => {
      // 체크 먼저, 삭제는 나중 (zone pointerup보다 늦게 실행되는 문제 방지)
      const wasGamepad = this._gamepadPointers.has(ptr.id);
      this._gamepadPointers.delete(ptr.id);
      if (wasGamepad) return;
      if (!ptr.rightButtonReleased()) {
        this.player.moveTo(ptr.worldX, ptr.worldY);
      }
    });

    this.input.on('pointerdown', (ptr) => {
      if (ptr.rightButtonDown()) {
        const claw = new MagicClaw(this, this.player.x, this.player.y, ptr.worldX, ptr.worldY);
        this.claws.push(claw);
        this.hitSnails = new Set();
      }
    });

    // ── UI 텍스트 ──
    this.uiText = this.add.text(12, 12, '', {
      fontSize: '13px',
      color: '#ffffff',
      backgroundColor: '#00000088',
      padding: { x: 6, y: 4 },
    }).setScrollFactor(0).setDepth(50);

    // ── 가상 게임패드 ──
    this._buildGamepad();
  }

  _buildGamepad() {
    const W = this.scale.width;
    const H = this.scale.height;

    // ── 아날로그 스틱 (왼쪽 하단) ──
    const baseR  = 65;
    const thumbR = 26;
    const padL   = 30;
    const bx = padL + baseR;
    const by = H - padL - baseR;

    this._stick = { active: false, pid: null, bx, by, baseR, tx: bx, ty: by };

    // 베이스 그래픽
    this._stickBase = this.add.graphics().setScrollFactor(0).setDepth(60);
    this._stickThumb = this.add.graphics().setScrollFactor(0).setDepth(61);
    this._drawStick(bx, by);

    // 터치 감지 영역
    const stickZone = this.add.zone(bx, by, baseR * 2.8, baseR * 2.8)
      .setScrollFactor(0).setDepth(59).setInteractive();

    stickZone.on('pointerdown', (ptr) => {
      this._stick.active = true;
      this._stick.pid = ptr.id;
      this._gamepadPointers.add(ptr.id);
      this._updateStick(ptr.x, ptr.y);
    });

    // ── 공격 버튼 (오른쪽 하단) ──
    const atkR  = 40;
    const padR  = 30;
    const ax = W - padR - atkR;
    const ay = H - padR - atkR;

    const atkGfx = this.add.graphics().setScrollFactor(0).setDepth(60);
    const atkTxt = this.add.text(ax, ay, '✦\n클로', {
      fontSize: '13px', color: '#ffffff', fontStyle: 'bold', align: 'center',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(61);

    const drawAtk = (pressed) => {
      atkGfx.clear();
      atkGfx.fillStyle(pressed ? 0xcc44ff : 0x9933ff, pressed ? 0.9 : 0.65);
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
      const claw = new MagicClaw(this, this.player.x, this.player.y, tx, ty);
      this.claws.push(claw);
      this.hitSnails = new Set();
    });
    atkZone.on('pointerup',  () => drawAtk(false));
    atkZone.on('pointerout', () => drawAtk(false));
    this._drawAtk = drawAtk;

    // ── 전역 pointermove / pointerup → 스틱 갱신 ──
    this.input.on('pointermove', (ptr) => {
      if (this._stick.active && ptr.id === this._stick.pid) {
        this._updateStick(ptr.x, ptr.y);
      }
    });

    this.input.on('pointerup', (ptr) => {
      if (ptr.id === this._stick.pid) {
        this._stick.active = false;
        this._stick.pid = null;
        this._updateStick(bx, by); // 중앙 복귀
        this.player.setPadDirection(0, 0);
      }
    });
  }

  _updateStick(px, py) {
    const { bx, by, baseR } = this._stick;
    const dx   = px - bx;
    const dy   = py - by;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const clamped = Math.min(dist, baseR);
    const tx = dist > 0 ? bx + (dx / dist) * clamped : bx;
    const ty = dist > 0 ? by + (dy / dist) * clamped : by;

    this._stick.tx = tx;
    this._stick.ty = ty;
    this._drawStick(tx, ty);

    const dead = 8;
    if (dist > dead) {
      this.player.setPadDirection(dx / dist, dy / dist);
    } else {
      this.player.setPadDirection(0, 0);
    }
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

  spawnItem(x, y) {
    this.items.push(new Item(this, x, y));
  }

  update(time, delta) {
    this.player.update();

    // 달팽이 업데이트
    this.snails = this.snails.filter(s => s.alive);
    this.snails.forEach(s => s.update());

    // 매직클로 업데이트 & 히트 체크
    this.claws = this.claws.filter(c => c.alive);
    this.claws.forEach(claw => {
      claw.update(delta);
      this.snails.forEach(snail => {
        const key = `${claw}:${snail}`;
        if (!this.hitSnails.has(key) && claw.checkHit(snail)) {
          this.hitSnails.add(key);
          const dmg = Phaser.Math.Between(12, 25);
          snail.takeDamage(dmg);
        }
      });
    });

    // 아이템 툴팁 위치 갱신
    this.items = this.items.filter(i => !i.picked);
    this.items.forEach(i => i.updateTooltipPos());

    // UI 업데이트
    const alive = this.snails.filter(s => s.alive).length;
    this.uiText.setText(
      `[RiceEating RPG v0.1]\n` +
      `🐌 달팽이: ${alive}마리  🎒 인벤토리: ${this.inventory.length}칸\n` +
      `탭: 이동  |  꾹 누르기 / 우클릭: 매직클로`
    );
  }
}
