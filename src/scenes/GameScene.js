import Player      from '../objects/Player.js';
import Snail       from '../objects/Snail.js';
import MeleeAttack from '../objects/MeleeAttack.js';
import Item        from '../objects/Item.js';
import Portal      from '../objects/Portal.js';
import InventoryUI from '../objects/InventoryUI.js';
import { MapRepository } from '../repositories/MapRepository';
import { AuthState }     from '../services/AuthState.js';
import { EXP_TABLE }     from '../constants/gameData';
import SaveManager      from '../services/SaveManager.js';
import ArenaClient   from '../services/ArenaClient.js';

const DEFAULT_MAP_W = 3200;
const DEFAULT_MAP_H = 2400;
const ARENA_MAP_ID  = 200000000;

// 모바일 여부 판단
const IS_MOBILE = ('ontouchstart' in window) && !window.matchMedia('(pointer:fine)').matches;

export default class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
    this.snails    = [];
    this.attacks   = [];
    this.items     = [];
    this.inventory = [];
    this.portals   = [];
    this._isDead   = false;
    this._transitioning = false;
    this._isArena       = false;
    this._arenaClient   = null;
    this._otherPlayers  = new Map();
  }

  create(data) {
    // scene.restart() 시 constructor는 재실행되지 않으므로 상태 수동 리셋
    this._transitioning = false;
    this._isDead        = false;
    this.snails         = [];
    this.attacks        = [];
    this.items          = [];
    this.portals        = [];
    this.inventory      = [];   // 씬 재시작마다 DB에서 새로 로드
    this._inventoryUI   = null;
    this._saveManager   = null;
    this._isArena       = false;
    this._arenaClient   = null;
    this._otherPlayers  = new Map();

    // ── 현재 맵 정보 ──
    const mapId  = data?.mapId  ?? 100000000;
    this._currentMap = MapRepository.getById(mapId);
    this._mapW = this._currentMap?.map_w ?? DEFAULT_MAP_W;
    this._mapH = this._currentMap?.map_h ?? DEFAULT_MAP_H;
    this._isArena = mapId === ARENA_MAP_ID;
    const startX = Math.max(20, Math.min(data?.startX ?? this._mapW / 2, this._mapW - 20));
    const startY = Math.max(20, Math.min(data?.startY ?? this._mapH / 2, this._mapH - 20));

    // ── 타일맵 배경 ──
    this._buildTilemap();

    this.physics.world.setBounds(0, 0, this._mapW, this._mapH);

    // ── 플레이어 ──
    const _pName = AuthState.isGuest ? '게스트' : (AuthState.username ?? '');
    this.player = new Player(this, startX, startY, _pName);

    // 로그인 데이터로 스탯 복원
    if (data?.charStats) {
      const cs = data.charStats;
      this.player.level      = cs.currentLevel ?? 1;
      this.player.currentExp = cs.currentExp   ?? 0;
      this.player.maxExp     = EXP_TABLE[cs.currentLevel ?? 1] ?? 15;
      this.player.hp         = cs.hp  ?? 50;
      this.player.maxHp      = cs.hp  ?? 50;
      this.player.mp         = cs.mp  ?? 50;
      this.player.maxMp      = cs.mp  ?? 50;
      this.player.str        = cs.str ?? 4;
      this.player.dex        = cs.dex ?? 4;
      this.player.int        = cs.int ?? 4;
      this.player.luk        = cs.luk ?? 4;
      this.player.ap         = cs.ap  ?? 0;
    }

    // ── 카메라 ──
    this.cameras.main.setBounds(0, 0, this._mapW, this._mapH);
    this.cameras.main.startFollow(this.player.sprite, true, 0.1, 0.1);

    // ── 포탈 생성 (D1에서 로드) ──
    const portalDataList = MapRepository.getPortals(mapId);
    portalDataList.forEach(pd => {
      const toMap = MapRepository.getById(pd.to_map_id);
      this.portals.push(new Portal(this, pd, toMap?.name ?? '???'));
    });

    // ── 몬스터 스폰 (마을 맵은 스폰 안 함) ──
    if (!this._currentMap.is_town) {
      const spawnConfig = [
        { type: 'green_snail', count: 15 },
        { type: 'blue_snail',  count: 10 },
        { type: 'spore',       count: 8  },
      ];
      spawnConfig.forEach(({ type, count }) => {
        for (let i = 0; i < count; i++) {
          this.snails.push(new Snail(this,
            Phaser.Math.Between(200, this._mapW - 200),
            Phaser.Math.Between(200, this._mapH - 200),
            type,
          ));
        }
      });
    }

    // ── 맵 이름 표시 ──
    this._showMapName(this._currentMap.name);

    this.game.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    this._gamepadPointers = new Set();
    this._atkBtn = null;

    // 멀티터치 포인터 추가 (조이스틱 + 공격버튼 동시 입력)
    this.input.addPointer(2);

    // ── 월드 입력 ──
    this.input.on('pointerup', (ptr) => {
      const wasGamepad = this._gamepadPointers.has(ptr.id);
      this._gamepadPointers.delete(ptr.id);
      if (wasGamepad) return;
      if (!ptr.rightButtonReleased()) this.player.moveTo(ptr.worldX, ptr.worldY);
    });

    this.input.on('pointerdown', (ptr) => {
      // PC 우클릭 공격
      if (ptr.rightButtonDown()) {
        this._doMeleeAttack(ptr.worldX, ptr.worldY);
        return;
      }
      // 공격 버튼 범위 체크 (멀티터치 포함)
      if (this._atkBtn) {
        const { ax, ay, atkR, drawAtk } = this._atkBtn;
        const dx = ptr.x - ax, dy = ptr.y - ay;
        if (dx * dx + dy * dy <= atkR * atkR) {
          this._gamepadPointers.add(ptr.id);
          this._atkBtn.activePtr = ptr.id;
          drawAtk(true);
          if (navigator.vibrate) navigator.vibrate(30);
          const tx = this.player.x + this.player.facingX * 300;
          const ty = this.player.y + this.player.facingY * 300;
          this._doMeleeAttack(tx, ty);
        }
      }
    });

    // ── UI 구성 ──
    this._buildStatusUI();
    this._buildExpBar();
    this._buildGamepad();
    if (IS_MOBILE) this._buildLootButton();
    this._buildStatWindow();
    this._buildMinimapUI();
    this._buildWorldMapUI();
    this._buildInventoryUI();
    this._loadInventory();       // 로그인 계정 인벤토리 DB 로드
    this._buildSaveSystem();
    if (this._isArena) this._initArena();
    this._buildLighting();
  }

  // ── 스테이터스 UI (HP/MP, 좌상단) ─────────────────────────────────────────
  _buildStatusUI() {
    const barW = 160;
    const barH = 13;
    const lx   = 12;
    const ly   = 12;

    // 버전 텍스트
    this._versionTxt = this.add.text(lx, ly, 'v0.000.034', {
      fontSize: '11px', color: '#aaaacc', backgroundColor: '#00000077', padding: { x:4,y:2 },
    }).setScrollFactor(0).setDepth(50);

    // 유저명 표시
    const displayName = AuthState.isGuest ? '게스트' : (AuthState.username ?? '');
    this.add.text(lx, ly + 16, displayName, {
      fontSize: '11px', color: '#ffee88', backgroundColor: '#00000077', padding: { x:4,y:2 },
    }).setScrollFactor(0).setDepth(50);

    const hy = ly + 36;
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

    // INVEN 버튼
    const invenBtn = this.add.rectangle(lx + 90, statBtnY, 56, 20, 0x1a3022, 0.92)
      .setScrollFactor(0).setDepth(50).setStrokeStyle(1, 0x44aa66)
      .setInteractive({ useHandCursor: true });
    this.add.text(lx + 90, statBtnY, 'INVEN', {
      fontSize: '11px', color: '#88ffbb', fontStyle: 'bold',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(51);
    invenBtn.on('pointerover',  () => invenBtn.setFillStyle(0x2a4d38, 0.95));
    invenBtn.on('pointerout',   () => invenBtn.setFillStyle(0x1a3022, 0.92));
    invenBtn.on('pointerdown', (ptr) => {
      this._gamepadPointers.add(ptr.id);
      this._inventoryUI?.toggle();
    });

    // 로그아웃 버튼
    const logoutBtnY = statBtnY + 26;
    const logoutBtn = this.add.rectangle(lx + 28, logoutBtnY, 56, 20, 0x2a1010, 0.92)
      .setScrollFactor(0).setDepth(50).setStrokeStyle(1, 0x883333)
      .setInteractive({ useHandCursor: true });
    this.add.text(lx + 28, logoutBtnY, 'LOGOUT', {
      fontSize: '10px', color: '#ff8888', fontStyle: 'bold',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(51);
    logoutBtn.on('pointerover',  () => logoutBtn.setFillStyle(0x441515, 0.95));
    logoutBtn.on('pointerout',   () => logoutBtn.setFillStyle(0x2a1010, 0.92));
    logoutBtn.on('pointerdown', (ptr) => {
      this._gamepadPointers.add(ptr.id);
      this._logout();
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

    // 공격 버튼 범위 (전역 이벤트에서 사용)
    this._atkBtn = { ax, ay, atkR, drawAtk };

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
      if (this._atkBtn && ptr.id === this._atkBtn.activePtr) {
        this._atkBtn.activePtr = null;
        this._atkBtn.drawAtk(false);
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

    // 투기장에서는 게임오버 없이 리스폰
    if (this._isArena) {
      const W = this.scale.width, H = this.scale.height;
      const overlay = this.add.rectangle(W/2, H/2, W, H, 0x000000, 0.6).setScrollFactor(0).setDepth(80);
      const txt = this.add.text(W/2, H/2, '전투 불능!\n3초 후 리스폰...', {
        fontSize: '28px', fontStyle: 'bold', color: '#ff6666',
        stroke: '#000', strokeThickness: 5, align: 'center',
      }).setOrigin(0.5).setScrollFactor(0).setDepth(81);
      this.time.delayedCall(3000, () => {
        overlay.destroy(); txt.destroy();
        this._isDead = false;
        // HP 회복
        this.player.hp = this.player.maxHp;
        this.player.isInvincible = false;
        this.player.sprite.setAlpha(1);
        // 중앙으로 텔레포트 (physics body 포함)
        const rx = this._mapW / 2, ry = this._mapH / 2;
        this.player.sprite.body.reset(rx, ry);
        this.player.targetX = rx;
        this.player.targetY = ry;
        this.player.moving = false;
        // HP바 갱신
        if (this._hpFill) this._hpFill.setSize(this._statusBarW, this._hpFill.height);
        this._arenaClient?.updateStats(this.player.hp, this.player.maxHp, this.player.level);
      });
      return;
    }

    // 일반 맵: 게임 오버
    this._saveManager?.saveNow('death');

    const W = this.scale.width, H = this.scale.height;
    this.add.rectangle(W/2, H/2, W, H, 0x000000, 0.65).setScrollFactor(0).setDepth(80);
    this.add.text(W/2, H/2 - 30, 'GAME OVER', {
      fontSize: '40px', fontStyle: 'bold', color: '#ff4444',
      stroke: '#000', strokeThickness: 6,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(81);
    this.add.text(W/2, H/2 + 20, '탭하여 재시작', {
      fontSize: '18px', color: '#ffffff',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(81);

    this.input.once('pointerdown', () => {
      this.scene.restart({
        mapId:     this._currentMap.map_id,
        startX:    this.player.x,
        startY:    this.player.y,
        charStats: this._getCharSnapshot(),
      });
    });
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

    // 투기장: 내 위치 동기화
    if (this._isArena && this._arenaClient) {
      this._arenaClient.sendMove(this.player.x, this.player.y);
      this._updateOtherPlayerSprites();
    }

    // 포탈 충돌 체크
    if (!this._transitioning) {
      this.portals.forEach(portal => {
        const inRange = portal.checkOverlap(this.player);
        portal.showHint(inRange);
        if (inRange) this._enterPortal(portal);
      });
    }

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
    this._infoTxt.setText(`몬스터 ${this.snails.length}마리  인벤토리 ${this.inventory.length}칸`);

    // ── 미니맵 플레이어 점 업데이트 ──
    this._updateMinimap();

    // ── EXP 바 업데이트 ──
    const expR = p.level >= 20 ? 1 : p.currentExp / p.maxExp;
    this._expBarFill.width = this._expBarWidth * expR;
    const pct = p.level >= 20 ? 'MAX' : `${Math.floor(expR * 100)}%`;
    this._expText.setText(`Lv.${p.level}  ${p.currentExp} / ${p.maxExp} EXP  (${pct})`);
  }

  // ── 포탈 진입 ────────────────────────────────────────────────────────────────
  _enterPortal(portal) {
    portal._used = true;
    this._transitioning = true;

    // 씬 전환 전 아레나 클라이언트 종료
    this._arenaClient?.destroy();
    this._arenaClient = null;

    // 씬 전환 전 캐릭터 저장 (SaveManager destroy가 keepalive로 처리)
    this._saveManager?.destroy();
    this._saveManager = null;

    this.cameras.main.fade(400, 0, 0, 0, false, (_cam, progress) => {
      if (progress < 1) return;
      this.portals = [];
      this.scene.restart({
        mapId:     portal.toMapId,
        startX:    portal.targetX,
        startY:    portal.targetY,
        charStats: this._getCharSnapshot(portal.toMapId, portal.targetX, portal.targetY),
      });
    });
  }

  /** 현재 플레이어 스탯을 스냅샷으로 반환 (씬 재시작 시 전달용) */
  _getCharSnapshot(mapId, posX, posY) {
    const p = this.player;
    return {
      currentLevel: p.level,
      currentExp:   p.currentExp,
      hp:  p.hp,  mp:  p.mp,
      str: p.str, dex: p.dex,
      int: p.int, luk: p.luk,
      ap:  p.ap,
      mapId: mapId ?? this._currentMap.map_id,
      posX:  posX  ?? p.x,
      posY:  posY  ?? p.y,
    };
  }

  // ── SaveManager 초기화 ───────────────────────────────────────────────────
  _buildSaveSystem() {
    this._saveManager = new SaveManager(this, () => {
      if (!this.player || !AuthState.userId) return null;
      const p = this.player;
      return {
        user_id:       AuthState.userId,
        current_level: p.level,
        current_exp:   p.currentExp,
        hp:  p.hp,  mp:  p.mp,
        str: p.str, dex: p.dex,
        int: p.int, luk: p.luk,
        ap:  p.ap,
        map_id: this._currentMap?.map_id ?? 100000000,
        pos_x:  p.x,
        pos_y:  p.y,
      };
    });

    // 저장 완료 지시자 UI
    this._saveIndicatorTxt = this.add.text(
      this.scale.width - 8, this.scale.height - 30,
      '', { fontSize: '10px', color: '#55ff88', stroke: '#000', strokeThickness: 2 },
    ).setOrigin(1, 0.5).setScrollFactor(0).setDepth(55).setAlpha(0);
  }

  /** 저장 완료 시 잠깐 표시하는 지시자 */
  _showSaveIndicator(reason = '') {
    if (!this._saveIndicatorTxt) return;
    const label = reason === 'levelup'   ? '💾 레벨업 저장'
                : reason === 'item_loot' ? '💾 아이템 저장'
                : reason === 'death'     ? '💾 저장됨'
                : '💾 자동 저장';
    this._saveIndicatorTxt.setText(label).setAlpha(1);
    this.tweens.killTweensOf(this._saveIndicatorTxt);
    this.tweens.add({
      targets:  this._saveIndicatorTxt,
      alpha:    0,
      duration: 1200,
      delay:    800,
    });
  }

  // ── 로그아웃 ─────────────────────────────────────────────────────────────
  _logout() {
    // 현재 위치/스탯 저장 후 인증 상태 초기화
    this._arenaClient?.destroy();
    this._arenaClient = null;
    this._saveManager?.saveNow('logout');
    this._saveManager?.destroy();
    this._saveManager = null;
    AuthState.clear();

    this.cameras.main.fade(400, 0, 0, 0, false, (_cam, progress) => {
      if (progress < 1) return;
      this.scene.start('LoginScene');
    });
  }

  // ── 씬 종료 라이프사이클 (scene.restart / scene.start 전 자동 호출) ────────
  shutdown() {
    this._arenaClient?.destroy();
    this._arenaClient = null;
    this._saveManager?.destroy();
    this._saveManager = null;
  }

  // ── 맵 이름 표시 ─────────────────────────────────────────────────────────────
  _showMapName(name) {
    const W = this.scale.width;
    const txt = this.add.text(W / 2, 60, name, {
      fontSize: '22px', fontStyle: 'bold',
      color: '#ffffff', stroke: '#000000', strokeThickness: 5,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(90).setAlpha(0);

    this.tweens.add({
      targets: txt, alpha: 1, duration: 400, ease: 'Power2',
      onComplete: () => {
        this.tweens.add({
          targets: txt, alpha: 0, duration: 800, delay: 1200,
          onComplete: () => txt.destroy(),
        });
      },
    });
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

    // 투기장 PK: 다른 플레이어 공격 판정
    if (this._isArena && this._arenaClient) {
      this._otherPlayers.forEach((op, userId) => {
        if (!op.sprite?.active) return;
        const fakeMob = { sprite: op.sprite, alive: true };
        if (!attack.checkHit(fakeMob)) return;
        const isCritical = Math.random() < 0.20;
        const base = Phaser.Math.Between(12, 25);
        const dmg  = isCritical ? Math.floor(base * 1.5) : base;
        this._arenaClient.sendAttack(userId, dmg);
        this._showDmgNum(op.sprite.x, op.sprite.y - 20, dmg, isCritical, '#ff6666');
      });
    }
  }

  // ── 아이템 획득 토스트 ────────────────────────────────────────────────────────
  _showPickupToast(invItem) {
    const W      = this.scale.width;
    const master = invItem.master;
    const isEquip   = master.category === 'EQUIP';
    const isConsume = master.category === 'CONSUME';
    const color  = isEquip ? '#ffcc44' : isConsume ? '#55ff88' : '#cccccc';

    let line1 = `[ ${master.name} 획득 ]`;
    let line2 = '';

    if (isEquip && invItem.equip) {
      const e = invItem.equip;
      const parts = [];
      if (master.baseAtk + e.atkBonus > 0) parts.push(`ATK +${master.baseAtk + e.atkBonus}`);
      if (master.baseStr + e.strBonus > 0) parts.push(`STR +${master.baseStr + e.strBonus}`);
      if (master.baseDex + e.dexBonus > 0) parts.push(`DEX +${master.baseDex + e.dexBonus}`);
      if (master.baseInt + e.intBonus > 0) parts.push(`INT +${master.baseInt + e.intBonus}`);
      if (master.baseLuk + e.lukBonus > 0) parts.push(`LUK +${master.baseLuk + e.lukBonus}`);
      if (master.baseDef + e.defBonus > 0) parts.push(`DEF +${master.baseDef + e.defBonus}`);
      if (e.upgradeSlots > 0) parts.push(`(+${e.upgradeSlots}업)`);
      line2 = parts.join('  ');
    } else if (isConsume) {
      const parts = [];
      if (master.hpRecover > 0) parts.push(`HP +${master.hpRecover}`);
      if (master.mpRecover > 0) parts.push(`MP +${master.mpRecover}`);
      line2 = parts.join('  ');
    }

    const txt = this.add.text(W / 2, 100, line1 + (line2 ? '\n' + line2 : ''), {
      fontSize: '13px', color,
      stroke: '#000000', strokeThickness: 3,
      align: 'center',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(90).setAlpha(0);

    this.tweens.add({
      targets: txt, alpha: 1, duration: 300,
      onComplete: () => {
        this.tweens.add({
          targets: txt, alpha: 0, duration: 600, delay: 1500,
          onComplete: () => txt.destroy(),
        });
      },
    });
  }

  // ── 라이팅 (비넷 + 블룸) ────────────────────────────────────────────────────
  _buildLighting() {
    if (!this.game.renderer.gl) return; // WebGL 전용
    try {
      const fx = this.cameras.main.postFX;
      // 비넷: 화면 외곽을 어둡게
      fx.addBloom(0xffffff, 1, 1, 1, 0.35, 4);
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
    const COLS = Math.floor(this._mapW / 32);
    const ROWS = Math.floor(this._mapH / 32);
    const data  = [];

    if (this._isArena) {
      // 콜로세움 투기장 타일맵: 돌바닥 + 경계 벽
      for (let r = 0; r < ROWS; r++) {
        const row = [];
        for (let c = 0; c < COLS; c++) {
          const onWall = r < 3 || r >= ROWS - 3 || c < 3 || c >= COLS - 3;
          const onRing = r < 6 || r >= ROWS - 6 || c < 6 || c >= COLS - 6;
          if (onWall)      row.push(1);                      // 어두운 돌벽
          else if (onRing) row.push((c + r) % 2 === 0 ? 4 : 5); // 경계 석판
          else             row.push((c + r) % 2 === 0 ? 4 : 5); // 모래/흙 바닥
        }
        data.push(row);
      }
      return data;
    }

    // 일반 맵: 중앙 十자 경로
    const midR0 = Math.floor(ROWS * 0.46), midR1 = Math.ceil(ROWS * 0.54);
    const midC0 = Math.floor(COLS * 0.46), midC1 = Math.ceil(COLS * 0.54);

    for (let r = 0; r < ROWS; r++) {
      const row = [];
      for (let c = 0; c < COLS; c++) {
        const onHPath = r >= midR0 && r <= midR1;
        const onVPath = c >= midC0 && c <= midC1;
        if (onHPath || onVPath) {
          row.push(4 + ((c + r) % 2));
        } else {
          const h = (c * 31 + r * 17) % 100;
          if (h < 38)      row.push(1);
          else if (h < 68) row.push(2);
          else if (h < 85) row.push(3);
          else             row.push(6);
        }
      }
      data.push(row);
    }
    return data;
  }

  // ── 미니맵 UI ────────────────────────────────────────────────────────────────
  _buildMinimapUI() {
    const W = this.scale.width;
    const MM_W = 160, MM_H = 112;
    const mmRight = W - 8;
    const mmLeft  = mmRight - MM_W;
    const mmTop   = 36;
    const mmCX    = mmLeft + MM_W / 2;
    const mmCY    = mmTop  + MM_H / 2;

    this._mmLeft = mmLeft;
    this._mmTop  = mmTop;
    this._MM_W   = MM_W;
    this._MM_H   = MM_H;

    // [Mini] / [World] 버튼 (항상 표시)
    const btnY = 14;
    [
      { label: 'Mini',  cx: W - 120, fn: () => this._toggleMinimap()  },
      { label: 'World', cx: W - 44,  fn: () => this._toggleWorldMap() },
    ].forEach(({ label, cx, fn }) => {
      const bg = this.add.rectangle(cx, btnY, 68, 22, 0x152535, 0.9)
        .setScrollFactor(0).setDepth(60).setStrokeStyle(1, 0x336688)
        .setInteractive({ useHandCursor: true });
      this.add.text(cx, btnY, label, { fontSize: '11px', color: '#88ccff' })
        .setOrigin(0.5).setScrollFactor(0).setDepth(61);
      bg.on('pointerover', () => bg.setFillStyle(0x243d55, 0.95));
      bg.on('pointerout',  () => bg.setFillStyle(0x152535, 0.90));
      bg.on('pointerdown', (ptr) => { this._gamepadPointers.add(ptr.id); fn(); });
    });

    // 미니맵 오브젝트 목록 (토글 시 일괄 숨김/표시)
    this._mmObjs = [];

    // 배경 패널
    this._mmObjs.push(
      this.add.rectangle(mmCX, mmCY, MM_W + 2, MM_H + 2, 0x080e08, 0.88)
        .setScrollFactor(0).setDepth(60).setStrokeStyle(1, 0x3a6640, 0.85),
    );

    // 지형 그래픽 (정적 — 한 번만 그림)
    const terrainGfx = this.add.graphics().setScrollFactor(0).setDepth(61);
    this._mmObjs.push(terrainGfx);
    this._drawMinimapTerrain(terrainGfx);

    // 플레이어 점 (매 프레임 갱신)
    this._mmPlayerDot = this.add.graphics().setScrollFactor(0).setDepth(63);
    this._mmObjs.push(this._mmPlayerDot);

    // 맵 이름 라벨
    this._mmObjs.push(
      this.add.text(mmCX, mmTop + MM_H - 4, this._currentMap.name, {
        fontSize: '9px', color: '#88ffaa', stroke: '#000', strokeThickness: 2,
      }).setOrigin(0.5, 1).setScrollFactor(0).setDepth(62),
    );

    this._mmVisible = true;

    // 키보드 단축키
    this.input.keyboard.on('keydown-M', () => this._toggleMinimap());
    this.input.keyboard.on('keydown-W', () => this._toggleWorldMap());
  }

  _drawMinimapTerrain(gfx) {
    const { _mmLeft: ml, _mmTop: mt, _MM_W: mw, _MM_H: mh } = this;
    const scX = mw / this._mapW;
    const scY = mh / this._mapH;
    gfx.clear();

    // 잔디 배경
    gfx.fillStyle(0x1e4a1e, 0.95);
    gfx.fillRect(ml, mt, mw, mh);

    // 경로 (맵 중앙 ±4%)
    const pY0 = this._mapH * 0.46, pYh = this._mapH * 0.08;
    const pX0 = this._mapW * 0.46, pXw = this._mapW * 0.08;
    gfx.fillStyle(0x6b4c1a, 0.85);
    gfx.fillRect(ml, mt + pY0 * scY, mw, Math.max(2, pYh * scY));
    gfx.fillStyle(0x6b4c1a, 0.85);
    gfx.fillRect(ml + pX0 * scX, mt, Math.max(2, pXw * scX), mh);

    // 현재 맵의 포탈 위치
    const portals = MapRepository.getPortals(this._currentMap.map_id);
    portals.forEach(p => {
      const px = ml + p.pos_x * scX;
      const py = mt + p.pos_y * scY;
      gfx.fillStyle(0x00ffcc, 0.85);
      gfx.fillCircle(px, py, 2.5);
    });
  }

  _updateMinimap() {
    if (!this._mmVisible || !this._mmPlayerDot) return;
    const { _mmLeft: ml, _mmTop: mt, _MM_W: mw, _MM_H: mh } = this;
    const dotX = ml + (this.player.x / this._mapW) * mw;
    const dotY = mt + (this.player.y / this._mapH) * mh;
    this._mmPlayerDot.clear();
    this._mmPlayerDot.fillStyle(0xffff00, 1.0);
    this._mmPlayerDot.fillCircle(dotX, dotY, 3);
    this._mmPlayerDot.lineStyle(1, 0x000000, 0.85);
    this._mmPlayerDot.strokeCircle(dotX, dotY, 3);
  }

  _toggleMinimap() {
    this._mmVisible = !this._mmVisible;
    this._mmObjs.forEach(o => o.setVisible(this._mmVisible));
  }

  // ── 월드맵 UI ────────────────────────────────────────────────────────────────
  _buildWorldMapUI() {
    const W  = this.scale.width;
    const H  = this.scale.height;
    const cx = W / 2, cy = H / 2;
    const pw = 500, ph = 300;

    this._worldMapObjs = [];
    const reg = (obj) => { this._worldMapObjs.push(obj); return obj; };

    // 배경 패널
    reg(this.add.rectangle(cx, cy, pw, ph, 0x07111d, 0.96)
      .setScrollFactor(0).setDepth(75).setStrokeStyle(2, 0x3377aa, 0.9));

    // 타이틀
    reg(this.add.text(cx, cy - ph / 2 + 18, 'Maple Island  [ W ]', {
      fontSize: '13px', fontStyle: 'bold', color: '#88ccff',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(76));

    // 닫기 버튼
    const closeBtn = reg(this.add.rectangle(cx + pw / 2 - 18, cy - ph / 2 + 18, 26, 26, 0x3a1020, 0.9)
      .setScrollFactor(0).setDepth(77).setStrokeStyle(1, 0x883344)
      .setInteractive({ useHandCursor: true }));
    reg(this.add.text(cx + pw / 2 - 18, cy - ph / 2 + 18, 'x', {
      fontSize: '13px', fontStyle: 'bold', color: '#ff9999',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(78));
    closeBtn.on('pointerover', () => closeBtn.setFillStyle(0x551830, 0.95));
    closeBtn.on('pointerout',  () => closeBtn.setFillStyle(0x3a1020, 0.90));
    closeBtn.on('pointerdown', (ptr) => { this._gamepadPointers.add(ptr.id); this._toggleWorldMap(); });

    // 설명 텍스트 & 구분선
    const descTxt = reg(this.add.text(cx, cy + ph / 2 - 20, '맵을 클릭하면 설명을 볼 수 있습니다.', {
      fontSize: '10px', color: '#99aabb', align: 'center',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(76));
    reg(this.add.rectangle(cx, cy + ph / 2 - 36, pw - 24, 1, 0x2a3f55)
      .setScrollFactor(0).setDepth(76));

    const MAP_DESC = {
      100000000: '메이플 아일랜드의 시작 마을.\n초보 모험가들이 첫 발을 내딛는 곳.',
      100000001: '나무가 우거진 들판.\n달팽이와 버섯이 서식한다.',
      100000002: '더 깊은 숲.\n강한 몬스터들이 출몰한다.',
      100000003: '남쪽 항구 마을.\n빅토리아 아일랜드행 배가 있다.',
      200000000: 'PK 전용 전투 구역.\n암허스트 12시 방향 포탈로 입장.',
    };

    const nodeW = 84, nodeH = 52;
    const mainRowY = cy + 32;
    const arenaY   = cy - 56;

    // 노드 위치 (명시적)
    const mapPos = {
      100000000: { x: cx - 150, y: mainRowY },
      100000001: { x: cx - 50,  y: mainRowY },
      100000002: { x: cx + 50,  y: mainRowY },
      100000003: { x: cx + 150, y: mainRowY },
      200000000: { x: cx - 150, y: arenaY   },
    };

    // ── 연결선 먼저 그리기 ──
    // 메인 체인 (수평 양방향)
    [[100000000, 100000001], [100000001, 100000002], [100000002, 100000003]].forEach(([aid, bid]) => {
      const a = mapPos[aid], b = mapPos[bid];
      const lg = reg(this.add.graphics().setScrollFactor(0).setDepth(75));
      lg.lineStyle(1, 0x334455, 0.8);
      lg.beginPath();
      lg.moveTo(a.x + nodeW / 2, a.y);
      lg.lineTo(b.x - nodeW / 2, b.y);
      lg.strokePath();
      const mx = (a.x + nodeW / 2 + b.x - nodeW / 2) / 2;
      reg(this.add.text(mx, a.y - 7, '<>', {
        fontSize: '10px', color: '#446677',
      }).setOrigin(0.5).setScrollFactor(0).setDepth(76));
    });

    // 암허스트 ↕ 투기장 (수직, 12시 방향)
    {
      const a = mapPos[100000000];
      const b = mapPos[200000000];
      const vg = reg(this.add.graphics().setScrollFactor(0).setDepth(75));
      vg.lineStyle(1.5, 0x884444, 0.85);
      vg.beginPath();
      vg.moveTo(a.x, a.y - nodeH / 2);
      vg.lineTo(b.x, b.y + nodeH / 2);
      vg.strokePath();
      const midY = (a.y - nodeH / 2 + b.y + nodeH / 2) / 2;
      reg(this.add.text(a.x + 6, midY, '⚔ 12시', {
        fontSize: '9px', color: '#ff8866',
      }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(76));
    }

    // ── 맵 노드 그리기 ──
    MapRepository.getAll().forEach((map) => {
      const pos = mapPos[map.map_id];
      if (!pos) return;

      const isCur   = map.map_id === this._currentMap.map_id;
      const isArena = map.map_id === 200000000;
      const isField = !map.is_town;

      let bgColor, bordCol, hoverCol, tagLabel, tagColor;
      if (isArena) {
        bgColor  = 0x2a1010; bordCol = isCur ? 0xffee44 : 0xaa3333;
        hoverCol = 0x3f1818; tagLabel = 'PK 투기장'; tagColor = '#ff6666';
      } else if (isField) {
        bgColor  = 0x152a1e; bordCol = isCur ? 0xffee44 : 0x3a8050;
        hoverCol = 0x1f3d2b; tagLabel = '필드'; tagColor = '#55bb77';
      } else {
        bgColor  = 0x151e2a; bordCol = isCur ? 0xffee44 : 0x3a5080;
        hoverCol = 0x1f2e42; tagLabel = '마을'; tagColor = '#5577bb';
      }

      const box = reg(this.add.rectangle(pos.x, pos.y, nodeW, nodeH, bgColor, 0.92)
        .setScrollFactor(0).setDepth(76)
        .setStrokeStyle(isCur ? 2 : 1, bordCol)
        .setInteractive({ useHandCursor: true }));

      reg(this.add.text(pos.x, pos.y - nodeH / 2 + 9, tagLabel, {
        fontSize: '8px', color: tagColor,
      }).setOrigin(0.5).setScrollFactor(0).setDepth(77));

      reg(this.add.text(pos.x, pos.y + 4, map.name, {
        fontSize: '11px', fontStyle: 'bold',
        color: isCur ? '#ffee44' : '#cce0ff',
        align: 'center', wordWrap: { width: nodeW - 8 },
      }).setOrigin(0.5).setScrollFactor(0).setDepth(77));

      if (isCur) {
        reg(this.add.text(pos.x, pos.y + nodeH / 2 - 8, '[ HERE ]', {
          fontSize: '8px', fontStyle: 'bold', color: '#ffee44',
        }).setOrigin(0.5).setScrollFactor(0).setDepth(77));
      }

      box.on('pointerover', () => box.setFillStyle(hoverCol, 0.95));
      box.on('pointerout',  () => box.setFillStyle(bgColor, 0.92));
      box.on('pointerdown', (ptr) => {
        this._gamepadPointers.add(ptr.id);
        descTxt.setText(MAP_DESC[map.map_id] ?? map.name);
      });
    });

    this._worldMapVisible = false;
    this._worldMapObjs.forEach(o => o.setVisible(false));
  }

  _toggleWorldMap() {
    this._worldMapVisible = !this._worldMapVisible;
    this._worldMapObjs.forEach(o => o.setVisible(this._worldMapVisible));
  }

  // ── 인벤토리 UI ──────────────────────────────────────────────────────────────
  _buildInventoryUI() {
    this._inventoryUI = new InventoryUI(this);
    // 키보드 단축키 I
    this.input.keyboard.on('keydown-I', () => this._inventoryUI?.toggle());
  }

  // ── 인벤토리 DB 로드 ─────────────────────────────────────────────────────────
  async _loadInventory() {
    // 게스트는 빈 인벤토리로 시작
    if (!AuthState.userId || AuthState.isGuest) return;

    try {
      const res = await fetch(`/api/inventory?user_id=${AuthState.userId}`);
      if (!res.ok) return;

      const items = await res.json();
      if (!Array.isArray(items) || items.length === 0) return;

      this.inventory = items;
      this._inventoryUI?.syncFromInventory(items);
    } catch (_e) {
      // 네트워크 오류 시 빈 인벤토리 유지
    }
  }

  _placeTreeDecorations() {
    if (this._isArena) {
      // 투기장은 나무 없음 — 콜로세움 기둥 장식만
      const W = this._mapW, H = this._mapH;
      const gfx = this.add.graphics().setDepth(1);
      gfx.fillStyle(0x5a4a30, 1);
      const pillars = [
        [W*0.2, H*0.15], [W*0.5, H*0.1], [W*0.8, H*0.15],
        [W*0.1, H*0.5],  [W*0.9, H*0.5],
        [W*0.2, H*0.85], [W*0.5, H*0.9], [W*0.8, H*0.85],
      ];
      pillars.forEach(([px, py]) => {
        gfx.fillStyle(0x6a5a40, 1);
        gfx.fillRect(px - 12, py - 24, 24, 48);
        gfx.fillStyle(0x8a7a60, 1);
        gfx.fillRect(px - 14, py - 28, 28, 8);
        gfx.fillRect(px - 14, py + 20, 28, 8);
      });
      return;
    }

    const rng = (min, max) => Phaser.Math.Between(min, max);
    const W = this._mapW, H = this._mapH;
    const border      = Math.max(16, Math.floor(W * 0.06));
    const innerBorder = Math.max(border + 16, Math.floor(W * 0.12));
    const sideCount   = Math.max(4,  Math.floor(W * H / 40000));
    const topCount    = Math.max(3,  Math.floor(W * H / 55000));
    const scatCount   = Math.max(4,  Math.floor(W * H / 50000));
    const positions = [];

    for (let i = 0; i < sideCount; i++) {
      positions.push([rng(border, innerBorder),           rng(border, H - border)]);
      positions.push([rng(W - innerBorder, W - border),   rng(border, H - border)]);
    }
    for (let i = 0; i < topCount; i++) {
      positions.push([rng(innerBorder, W - innerBorder), rng(border, innerBorder)]);
      positions.push([rng(innerBorder, W - innerBorder), rng(H - innerBorder, H - border)]);
    }
    for (let i = 0; i < scatCount; i++) {
      const x = rng(innerBorder, W - innerBorder);
      const y = rng(innerBorder, H - innerBorder);
      if (Math.abs(x - W/2) > W * 0.15 || Math.abs(y - H/2) > H * 0.15) {
        positions.push([x, y]);
      }
    }
    positions.forEach(([x, y]) => {
      this.add.image(x, y, 'tree').setDepth(y * 0.001);
    });
  }

  // ── 투기장 초기화 ─────────────────────────────────────────────────────────
  _initArena() {
    // PK 활성 배너
    const W = this.scale.width, H = this.scale.height;
    const banner = this.add.text(W/2, 60, '⚔ 투기장 — PK 모드 활성화 ⚔', {
      fontSize: '18px', fontStyle: 'bold', color: '#ff4444',
      stroke: '#000', strokeThickness: 4, backgroundColor: '#00000099',
      padding: { x: 14, y: 6 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(70);
    this.tweens.add({
      targets: banner, alpha: 0, delay: 3000, duration: 800,
      onComplete: () => banner.destroy(),
    });

    // WebSocket 연결
    this._arenaClient = new ArenaClient({
      userId:   AuthState.userId   ?? ('guest_' + Math.random().toString(36).slice(2)),
      username: AuthState.username ?? '게스트',
      hp:       this.player.hp,
      maxHp:    this.player.maxHp,
      level:    this.player.level,
      onJoin:   (p)                   => this._addOtherPlayer(p),
      onLeave:  (uid)                 => this._removeOtherPlayer(uid),
      onMove:   (uid, x, y)           => this._moveOtherPlayer(uid, x, y),
      onHit:    (atkId, tgtId, dmg, tgtHp) => this._handleArenaHit(atkId, tgtId, dmg, tgtHp),
      onDead:   (uid, atkId)          => this._handleArenaDead(uid, atkId),
    });
  }

  _addOtherPlayer({ userId, username, x, y, hp, maxHp, level }) {
    if (String(userId) === String(AuthState.userId ?? '')) return;
    if (this._otherPlayers.has(String(userId))) return;

    const uid = String(userId);

    // 그림자
    const shadow = this.add.ellipse(x, y + 14, 28, 10, 0x000000, 0.30).setDepth(3);

    // 플레이어와 동일한 스프라이트 사용
    const sprite = this.add.sprite(x, y, 'player', 0).setDepth(5);
    sprite.play('player_idle_down');

    const hpBarBg = this.add.rectangle(x, y - 22, 36, 5, 0x660000, 0.85).setDepth(11);
    const hpBarFg = this.add.rectangle(x - 18, y - 22, 36, 3, 0xff3333, 1)
      .setOrigin(0, 0.5).setDepth(12);

    const nameLabel = this.add.text(x, y + 28, `${username} Lv.${level}`, {
      fontSize: '11px', color: '#ffffff', stroke: '#000', strokeThickness: 3,
      backgroundColor: '#00000055', padding: { x: 4, y: 2 },
    }).setOrigin(0.5, 0).setDepth(11);

    this._otherPlayers.set(uid, {
      sprite, shadow, nameLabel, hpBarBg, hpBarFg,
      hp, maxHp, x, y, prevX: x, prevY: y,
    });
  }

  _removeOtherPlayer(userId) {
    const uid = String(userId);
    const op = this._otherPlayers.get(uid);
    if (!op) return;
    op.sprite?.destroy();
    op.shadow?.destroy();
    op.nameLabel?.destroy();
    op.hpBarBg?.destroy();
    op.hpBarFg?.destroy();
    this._otherPlayers.delete(uid);
  }

  _moveOtherPlayer(userId, x, y) {
    const op = this._otherPlayers.get(String(userId));
    if (!op) return;
    op.x = x; op.y = y;
  }

  _updateOtherPlayerSprites() {
    this._otherPlayers.forEach((op) => {
      if (!op.sprite?.active) return;
      op.sprite.setPosition(op.x, op.y);
      op.shadow?.setPosition(op.x, op.y + 14);
      op.nameLabel.setPosition(op.x, op.y + 28);
      op.hpBarBg.setPosition(op.x, op.y - 22);
      const ratio = op.maxHp > 0 ? op.hp / op.maxHp : 1;
      op.hpBarFg.setPosition(op.x - 18, op.y - 22);
      op.hpBarFg.setDisplaySize(Math.max(1, 36 * ratio), 3);

      // 이동 방향으로 애니메이션 전환
      const dx = op.x - op.prevX;
      const dy = op.y - op.prevY;
      const moving = Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5;
      let dir = 'down';
      if (moving) {
        if (Math.abs(dx) >= Math.abs(dy)) dir = dx > 0 ? 'right' : 'left';
        else dir = dy > 0 ? 'down' : 'up';
      }
      const isLeft = dir === 'left';
      op.sprite.setFlipX(isLeft);
      const baseDir = isLeft ? 'right' : dir;
      const animKey = moving ? `player_walk_${baseDir}` : `player_idle_${baseDir}`;
      if (op.sprite.anims.currentAnim?.key !== animKey) op.sprite.play(animKey, true);

      op.prevX = op.x;
      op.prevY = op.y;
    });
  }

  _handleArenaHit(attackerId, targetUserId, damage, targetHp) {
    const myId = String(AuthState.userId ?? '');
    if (String(targetUserId) === myId) {
      // 나를 때림
      if (damage > 0) {
        const isCrit = damage > 18;
        this.player.takeDamage(damage, 0, 0);
        this._showDmgNum(this.player.x, this.player.y - 20, damage, isCrit, '#ffaaaa');
      }
    } else {
      // 다른 플레이어가 맞음 — HP 업데이트
      const op = this._otherPlayers.get(String(targetUserId));
      if (op && damage > 0) {
        op.hp = targetHp;
        this._showDmgNum(op.x, op.y - 20, damage, damage > 18, '#ff6666');
      }
    }
  }

  _handleArenaDead(userId, attackerId) {
    const myId = String(AuthState.userId ?? '');
    if (String(userId) === myId) {
      this.onPlayerDead();
    } else {
      // 다른 플레이어 사망 연출
      const op = this._otherPlayers.get(String(userId));
      if (op) {
        op.hp = op.maxHp;
        const deathTxt = this.add.text(op.x, op.y - 40, '💀 KO!', {
          fontSize: '16px', color: '#ff4444', stroke: '#000', strokeThickness: 3,
        }).setOrigin(0.5).setDepth(20);
        this.tweens.add({
          targets: deathTxt, y: op.y - 80, alpha: 0, duration: 1500,
          onComplete: () => deathTxt.destroy(),
        });
      }
      // 킬 알림
      const atkOp = this._otherPlayers.get(String(attackerId));
      const atkName = String(attackerId) === myId
        ? (AuthState.username ?? '나')
        : (atkOp?.nameLabel?.text ?? attackerId);
      const tgtOp = this._otherPlayers.get(String(userId));
      const tgtName = tgtOp?.nameLabel?.text ?? userId;
      const W = this.scale.width;
      const killTxt = this.add.text(W/2, 90, `${atkName} → ${tgtName} KO!`, {
        fontSize: '13px', color: '#ffee44', stroke: '#000', strokeThickness: 3,
        backgroundColor: '#00000088', padding: { x: 8, y: 4 },
      }).setOrigin(0.5).setScrollFactor(0).setDepth(70);
      this.tweens.add({
        targets: killTxt, alpha: 0, delay: 2500, duration: 600,
        onComplete: () => killTxt.destroy(),
      });
    }
  }

  _showDmgNum(x, y, dmg, isCrit, color = '#ffff00') {
    const txt = this.add.text(x, y, isCrit ? `${dmg}!` : `${dmg}`, {
      fontSize: isCrit ? '18px' : '14px',
      fontStyle: isCrit ? 'bold' : 'normal',
      color: isCrit ? '#ffdd00' : color,
      stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(25);
    this.tweens.add({
      targets: txt, y: y - 40, alpha: 0, duration: 900,
      onComplete: () => txt.destroy(),
    });
  }
}
