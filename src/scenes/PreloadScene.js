/* PreloadScene.js ─ 캔버스 기반 텍스처 생성 + DB 데이터 프리로드 */
import { db } from '../services/DatabaseService';

export default class PreloadScene extends Phaser.Scene {
  constructor() { super('PreloadScene'); }

  preload() {
    // API 실패해도 게임이 멈추지 않도록 에러 무시
    this.load.on('loaderror', () => {});

    // Production: Pages Function → Cloudflare D1
    // Local dev:  Vite mock middleware → JSON 파일
    // Fallback:   API 실패 시 DatabaseService 내 번들 JSON 사용
    this.load.json('monsters_data', '/api/monsters');
    this.load.json('items_data',    '/api/items');
    this.load.json('maps_data',     '/api/maps');
    this.load.json('portals_data',  '/api/portals');
  }

  create() {
    // API 응답이 있으면 캐시 업데이트, 없으면 fallback JSON 유지
    db.seedFromPreload(
      this.cache.json.get('monsters_data') ?? null,
      this.cache.json.get('items_data')    ?? null,
      this.cache.json.get('maps_data')     ?? null,
      this.cache.json.get('portals_data')  ?? null,
    );

    this._genTileset();
    this._genTree();
    this._genPalmTree();
    this._genPlayerSheet();
    this._genMonsterSheet('green_snail', '#44cc44', '#228822', '#1d8800');
    this._genMonsterSheet('blue_snail',  '#4488ff', '#2255cc', '#0033aa');
    this._genSporeSheet();
    this._genSpark();
    // 건물 / 오브젝트 스프라이트
    this._genBuilding('house_village', '#cc4422', '#f5e8c0', '#7a3210');
    this._genBuilding('house_shop',    '#2255aa', '#eef5ff', '#1a3a70', true);
    this._genWarehouse();
    this._genShip();
    // NPC 스프라이트
    this._genNPC('npc_elder',     0xfdbcb4, 0xdddddd, 0x8b6040, 0x6b4030, 0);
    this._genNPC('npc_merchant',  0xfdbcb4, 0x5c3310, 0xcc4411, 0x662200, 0);
    this._genNPC('npc_navigator', 0xe0b898, 0x220a00, 0x1a3a7a, 0x0f2060, 0x1a3a7a);
    this._genNPC('npc_villager',  0xfdbcb4, 0x7a4010, 0x3a8030, 0x5a4020, 0);
    this._genNPC('npc_harbor',    0xd0a080, 0x3a2010, 0x885522, 0x552200, 0x885522);
    this.scene.start('LoginScene');
  }

  // ── 유틸 ─────────────────────────────────────────────────────────────────────
  _canvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }

  // ── 타일셋 (32×32 × 10종, 좌→우) ────────────────────────────────────────────
  // 인덱스(1-based): 1=어두운잔디 2=중간잔디 3=밝은잔디 4=흙 5=어두운흙 6=꽃
  // 7=코블스톤 8=모래 9=물 10=나무판자
  _genTileset() {
    const T = 32, N = 10;
    const canvas = this._canvas(T * N, T);
    const ctx = canvas.getContext('2d');

    // 1) 어두운 잔디
    this._drawGrassTile(ctx, 0,  '#3a6828', '#4a8032', '#2e521e');
    // 2) 중간 잔디
    this._drawGrassTile(ctx, 1,  '#4a8030', '#5c9a3e', '#386224');
    // 3) 밝은 잔디
    this._drawGrassTile(ctx, 2,  '#56963a', '#6cb048', '#42742c');
    // 4) 흙
    this._drawDirtTile(ctx, 3,   '#b8882a', '#8c6416');
    // 5) 어두운 흙
    this._drawDirtTile(ctx, 4,   '#8c6416', '#624208');
    // 6) 꽃 잔디
    this._drawFlowerTile(ctx, 5);
    // 7) 코블스톤 (암허스트 경로)
    this._drawCobblestoneTile(ctx, 6);
    // 8) 모래 (사우스페리)
    this._drawSandTile(ctx, 7);
    // 9) 물 (사우스페리 테두리)
    this._drawWaterTile(ctx, 8);
    // 10) 나무 판자 (선착장)
    this._drawPlankTile(ctx, 9);

    this.textures.addCanvas('tileset', canvas);
  }

  _drawGrassTile(ctx, col, base, light, dark) {
    const x = col * 32;
    ctx.fillStyle = base;
    ctx.fillRect(x, 0, 32, 32);
    // 잔디 블레이드 (고정 패턴)
    const blades = [
      [2,5,light],[7,11,light],[11,3,dark],[15,9,light],[20,5,dark],
      [24,13,light],[28,7,dark],[5,20,light],[9,24,dark],[13,17,light],
      [18,28,dark],[22,21,light],[27,15,dark],[3,29,light],[16,31,dark],
    ];
    blades.forEach(([bx, by, c]) => {
      ctx.fillStyle = c;
      ctx.fillRect(x + bx, by, 2, 4);
    });
  }

  _drawDirtTile(ctx, col, base, dark) {
    const x = col * 32;
    ctx.fillStyle = base;
    ctx.fillRect(x, 0, 32, 32);
    [[5,4],[13,9],[22,6],[8,16],[19,21],[27,13],[4,25],[16,28],[26,23]].forEach(([bx,by]) => {
      ctx.fillStyle = dark;
      ctx.fillRect(x + bx, by, 5, 3);
    });
    [[9,6],[24,19],[14,26],[29,9]].forEach(([bx,by]) => {
      ctx.fillStyle = '#3a2006';
      ctx.fillRect(x + bx, by, 3, 2);
    });
  }

  _drawFlowerTile(ctx, col) {
    this._drawGrassTile(ctx, col, '#4a8030', '#5c9a3e', '#386224');
    const x = col * 32;
    [
      [6,8,'#ffee00'],[17,5,'#ff55bb'],[25,15,'#ffaa00'],[10,23,'#ff5555'],[27,27,'#ddff44'],
    ].forEach(([bx, by, color]) => {
      ctx.fillStyle = color;
      ctx.fillRect(x+bx, by, 3, 3);
      ctx.fillRect(x+bx-1, by+1, 5, 1);
      ctx.fillRect(x+bx+1, by-1, 1, 5);
    });
  }

  // ── 나무 스프라이트 (40×52) ───────────────────────────────────────────────────
  _genTree() {
    const canvas = this._canvas(40, 52);
    const ctx = canvas.getContext('2d');
    // 그림자
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath(); ctx.ellipse(20, 49, 14, 5, 0, 0, Math.PI*2); ctx.fill();
    // 줄기
    ctx.fillStyle = '#7a5228'; ctx.fillRect(16, 34, 8, 13);
    ctx.fillStyle = '#5e3e1a'; ctx.fillRect(16, 39, 3, 8);
    // 잎 (겹겹이)
    ctx.fillStyle = '#2e6018'; ctx.beginPath(); ctx.arc(20, 26, 17, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#3c7c20'; ctx.beginPath(); ctx.arc(14, 22, 13, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#469420'; ctx.beginPath(); ctx.arc(26, 20, 13, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#52a828'; ctx.beginPath(); ctx.arc(20, 17, 11, 0, Math.PI*2); ctx.fill();
    // 하이라이트
    ctx.fillStyle = '#6ec038'; ctx.beginPath(); ctx.arc(17, 14, 5, 0, Math.PI*2); ctx.fill();
    this.textures.addCanvas('tree', canvas);
  }

  // ── 플레이어 스프라이트 시트 (32×32×12프레임: down×4, up×4, right×4) ─────────
  _genPlayerSheet() {
    const FW = 32, FH = 32, FRAMES = 4, DIRS = 3; // left = right + flipX
    const canvas = this._canvas(FW * FRAMES, FH * DIRS);
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    ['down', 'up', 'right'].forEach((dir, row) => {
      for (let f = 0; f < FRAMES; f++) {
        this._drawPlayer(ctx, FW * f, FH * row, dir, f);
      }
    });

    this.textures.addSpriteSheet('player', canvas, { frameWidth: FW, frameHeight: FH });

    // 애니메이션 등록
    const RATE = 8;
    [
      { key: 'player_walk_down',  start: 0,  end: 3  },
      { key: 'player_walk_up',    start: 4,  end: 7  },
      { key: 'player_walk_right', start: 8,  end: 11 },
    ].forEach(({ key, start, end }) => {
      this.anims.create({
        key, frameRate: RATE, repeat: -1,
        frames: this.anims.generateFrameNumbers('player', { start, end }),
      });
    });
    [
      { key: 'player_idle_down',  frame: 0 },
      { key: 'player_idle_up',    frame: 4 },
      { key: 'player_idle_right', frame: 8 },
    ].forEach(({ key, frame }) => {
      this.anims.create({ key, frameRate: 1, repeat: -1,
        frames: [{ key: 'player', frame }] });
    });
  }

  _drawPlayer(ctx, bx, by, dir, frame) {
    const p = {
      hair: '#2c1505', skin: '#fdbcb4', shirt: '#2e6db4',
      pants: '#1e3d6e', shoe: '#120c06', shadow: 'rgba(0,0,0,0.18)',
    };
    const walk  = [0, 3, 0, -3][frame];
    const aswing = Math.round(walk / 2);

    // 그림자
    ctx.fillStyle = p.shadow;
    ctx.beginPath(); ctx.ellipse(bx+16, by+30, 10, 4, 0, 0, Math.PI*2); ctx.fill();

    if (dir === 'down') {
      // 다리
      ctx.fillStyle = p.pants;
      ctx.fillRect(bx+8,  by+21, 6, 7+walk);
      ctx.fillRect(bx+18, by+21, 6, 7-walk);
      ctx.fillStyle = p.shoe;
      ctx.fillRect(bx+7,  by+27+walk, 8, 3);
      ctx.fillRect(bx+17, by+27-walk, 8, 3);
      // 몸통
      ctx.fillStyle = p.shirt; ctx.fillRect(bx+5, by+11, 22, 11);
      // 팔
      ctx.fillStyle = p.shirt;
      ctx.fillRect(bx+0, by+12-aswing, 5, 9);
      ctx.fillRect(bx+27, by+12+aswing, 5, 9);
      ctx.fillStyle = p.skin;
      ctx.fillRect(bx+0, by+20-aswing, 5, 2);
      ctx.fillRect(bx+27, by+20+aswing, 5, 2);
      // 목
      ctx.fillStyle = p.skin; ctx.fillRect(bx+13, by+8, 6, 4);
      // 머리
      ctx.fillStyle = p.skin;
      ctx.fillRect(bx+8, by+2, 16, 9);
      ctx.fillRect(bx+7, by+3, 18, 7);
      // 머리카락
      ctx.fillStyle = p.hair;
      ctx.fillRect(bx+7, by+1, 18, 4);
      ctx.fillRect(bx+7, by+2, 2, 6);
      ctx.fillRect(bx+23, by+2, 2, 6);
      // 눈
      ctx.fillStyle = '#1a0a00';
      ctx.fillRect(bx+10, by+6, 3, 2);
      ctx.fillRect(bx+19, by+6, 3, 2);

    } else if (dir === 'up') {
      // 다리
      ctx.fillStyle = p.pants;
      ctx.fillRect(bx+8,  by+21, 6, 7+walk);
      ctx.fillRect(bx+18, by+21, 6, 7-walk);
      ctx.fillStyle = p.shoe;
      ctx.fillRect(bx+7,  by+27+walk, 8, 3);
      ctx.fillRect(bx+17, by+27-walk, 8, 3);
      // 몸통
      ctx.fillStyle = p.shirt; ctx.fillRect(bx+5, by+11, 22, 11);
      // 팔 (뒷모습)
      ctx.fillStyle = p.shirt;
      ctx.fillRect(bx+0, by+12+aswing, 5, 9);
      ctx.fillRect(bx+27, by+12-aswing, 5, 9);
      ctx.fillStyle = p.skin;
      ctx.fillRect(bx+0, by+20+aswing, 5, 2);
      ctx.fillRect(bx+27, by+20-aswing, 5, 2);
      // 목 (뒷면)
      ctx.fillStyle = p.skin; ctx.fillRect(bx+13, by+8, 6, 4);
      // 머리 (뒷면)
      ctx.fillStyle = p.skin;
      ctx.fillRect(bx+8, by+2, 16, 9);
      ctx.fillRect(bx+7, by+3, 18, 7);
      // 머리카락 전체
      ctx.fillStyle = p.hair;
      ctx.fillRect(bx+7, by+1, 18, 11);
      ctx.fillRect(bx+7, by+2, 2, 8);
      ctx.fillRect(bx+23, by+2, 2, 8);

    } else { // right (left 는 flipX)
      // 다리
      ctx.fillStyle = p.pants;
      ctx.fillRect(bx+11, by+21, 6, 7+walk);
      ctx.fillRect(bx+17, by+21, 6, 7-walk);
      ctx.fillStyle = p.shoe;
      ctx.fillRect(bx+9, by+27+walk, 9, 3);
      ctx.fillRect(bx+15, by+27-walk, 9, 3);
      // 몸통
      ctx.fillStyle = p.shirt; ctx.fillRect(bx+5, by+11, 22, 11);
      // 근거리 팔 (오른쪽)
      ctx.fillStyle = p.shirt;
      ctx.fillRect(bx+25, by+12+aswing, 5, 9);
      ctx.fillStyle = p.skin;
      ctx.fillRect(bx+25, by+20+aswing, 5, 2);
      // 원거리 팔 (왼쪽)
      ctx.fillStyle = p.shirt;
      ctx.fillRect(bx+2, by+13-aswing, 4, 8);
      ctx.fillStyle = p.skin;
      ctx.fillRect(bx+2, by+20-aswing, 4, 2);
      // 목
      ctx.fillStyle = p.skin; ctx.fillRect(bx+14, by+8, 5, 4);
      // 머리
      ctx.fillStyle = p.skin;
      ctx.fillRect(bx+9, by+2, 15, 9);
      ctx.fillRect(bx+8, by+3, 17, 7);
      // 머리카락
      ctx.fillStyle = p.hair;
      ctx.fillRect(bx+8, by+1, 16, 4);
      ctx.fillRect(bx+8, by+2, 2, 6);
      ctx.fillRect(bx+22, by+2, 2, 6);
      // 눈 (오른쪽 측면)
      ctx.fillStyle = '#1a0a00';
      ctx.fillRect(bx+21, by+6, 3, 2);
    }
  }

  // ── 달팽이 몬스터 시트 (28×22 × 2프레임) ────────────────────────────────────
  _genMonsterSheet(key, bodyHex, shellHex, darkHex) {
    const FW = 28, FH = 22;
    const canvas = this._canvas(FW * 2, FH);
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    [0, 1].forEach(f => this._drawSnail(ctx, FW * f, 0, FW, FH, f, bodyHex, shellHex, darkHex));

    this.textures.addSpriteSheet(key, canvas, { frameWidth: FW, frameHeight: FH });
    this.anims.create({
      key: `${key}_walk`, frameRate: 5, repeat: -1,
      frames: this.anims.generateFrameNumbers(key, { start: 0, end: 1 }),
    });
  }

  _drawSnail(ctx, bx, by, fw, fh, frame, bodyHex, shellHex, darkHex) {
    const bob = frame === 1 ? -1 : 0;

    // 그림자
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath(); ctx.ellipse(bx+14, by+fh-1, 10, 3, 0, 0, Math.PI*2); ctx.fill();

    // 몸통 (타원형)
    ctx.fillStyle = bodyHex;
    ctx.fillRect(bx+3,  by+12+bob, 20, 7);
    ctx.fillRect(bx+5,  by+10+bob, 16, 9);
    ctx.fillRect(bx+7,  by+9+bob,  12, 11);

    // 머리
    ctx.fillStyle = bodyHex;
    ctx.fillRect(bx+19, by+10+bob, 7, 7);
    ctx.fillRect(bx+20, by+8+bob,  5, 9);

    // 눈 촉수
    ctx.fillStyle = bodyHex;
    ctx.fillRect(bx+21, by+4+bob, 2, 5);
    ctx.fillRect(bx+24, by+5+bob, 2, 4);
    ctx.fillStyle = '#1a0a00';
    ctx.fillRect(bx+21, by+3+bob, 3, 2);
    ctx.fillRect(bx+24, by+4+bob, 3, 2);

    // 껍질
    ctx.fillStyle = shellHex;
    ctx.fillRect(bx+6,  by+4+bob,  14, 12);
    ctx.fillRect(bx+8,  by+2+bob,  10, 14);
    ctx.fillRect(bx+4,  by+6+bob,  16, 9);
    // 껍질 나선
    ctx.fillStyle = darkHex;
    ctx.fillRect(bx+10, by+6+bob,  4, 4);
    ctx.fillRect(bx+9,  by+5+bob,  6, 2);
    ctx.fillRect(bx+9,  by+10+bob, 6, 2);
    ctx.fillStyle = shellHex;
    ctx.fillRect(bx+11, by+7+bob,  2, 2);
  }

  // ── 스포아 몬스터 시트 (24×24 × 2프레임) ─────────────────────────────────────
  _genSporeSheet() {
    const FW = 24, FH = 24;
    const canvas = this._canvas(FW * 2, FH);
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    [0, 1].forEach(f => this._drawSpore(ctx, FW * f, 0, FW, FH, f));

    this.textures.addSpriteSheet('spore', canvas, { frameWidth: FW, frameHeight: FH });
    this.anims.create({
      key: 'spore_walk', frameRate: 3, repeat: -1,
      frames: this.anims.generateFrameNumbers('spore', { start: 0, end: 1 }),
    });
  }

  _drawSpore(ctx, bx, by, fw, fh, frame) {
    const pulse = frame === 1 ? -1 : 0;

    // 그림자
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath(); ctx.ellipse(bx+12, by+22, 7, 3, 0, 0, Math.PI*2); ctx.fill();

    // 줄기
    ctx.fillStyle = '#884499'; ctx.fillRect(bx+10, by+14+pulse, 4, 8);
    ctx.fillStyle = '#663377'; ctx.fillRect(bx+10, by+17+pulse, 3, 5);

    // 갓 (모자)
    ctx.fillStyle = '#aa44cc';
    ctx.fillRect(bx+5,  by+8+pulse,  14, 8);
    ctx.fillRect(bx+4,  by+9+pulse,  16, 6);
    ctx.fillRect(bx+6,  by+6+pulse,  12, 10);
    ctx.fillRect(bx+8,  by+4+pulse,  8,  12);

    // 갓 하이라이트
    ctx.fillStyle = '#cc66ee';
    ctx.fillRect(bx+9,  by+5+pulse, 5, 3);
    ctx.fillRect(bx+10, by+4+pulse, 3, 4);

    // 흰 반점
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(bx+7,  by+8+pulse, 3, 3);
    ctx.fillRect(bx+14, by+10+pulse, 2, 2);

    // 눈
    ctx.fillStyle = '#1a0a00';
    ctx.fillRect(bx+9,  by+16+pulse, 2, 2);
    ctx.fillRect(bx+13, by+16+pulse, 2, 2);
  }

  // ── 파티클 스파크 텍스처 (8×8) ───────────────────────────────────────────────
  _genSpark() {
    const canvas = this._canvas(8, 8);
    const ctx = canvas.getContext('2d');
    const grd = ctx.createRadialGradient(4, 4, 0, 4, 4, 4);
    grd.addColorStop(0,   'rgba(255,255,255,1)');
    grd.addColorStop(0.5, 'rgba(255,255,255,0.8)');
    grd.addColorStop(1,   'rgba(255,255,255,0)');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, 8, 8);
    this.textures.addCanvas('spark', canvas);
  }

  // ── 코블스톤 타일 (암허스트 경로) ────────────────────────────────────────────
  _drawCobblestoneTile(ctx, col) {
    const x = col * 32;
    ctx.fillStyle = '#7a7060';
    ctx.fillRect(x, 0, 32, 32);
    ctx.fillStyle = '#4a4038';
    [[0,0,32,1],[0,10,32,1],[0,21,32,1],[0,31,32,1],
     [0,0,1,10],[9,0,1,10],[20,0,1,10],
     [0,11,1,10],[16,11,1,10],[25,11,1,10],
     [4,22,1,9],[14,22,1,9],[24,22,1,9]].forEach(([rx,ry,rw,rh]) => {
      ctx.fillRect(x+rx, ry, rw, rh);
    });
    ctx.fillStyle = '#9a9080';
    [[2,2,6,7],[11,2,8,7],[22,2,8,7],
     [1,12,13,7],[17,12,7,7],
     [5,23,8,6],[16,23,7,6]].forEach(([rx,ry,rw,rh]) => {
      ctx.fillRect(x+rx, ry, rw, rh);
    });
  }

  // ── 모래 타일 (사우스페리) ─────────────────────────────────────────────────
  _drawSandTile(ctx, col) {
    const x = col * 32;
    ctx.fillStyle = '#d4b483';
    ctx.fillRect(x, 0, 32, 32);
    [[3,5],[11,12],[20,4],[8,22],[25,18],[16,28],[5,15],[28,8]].forEach(([bx,by]) => {
      ctx.fillStyle = '#c4a073';
      ctx.fillRect(x+bx, by, 4, 2);
    });
    [[7,8],[19,20],[12,27],[26,5]].forEach(([bx,by]) => {
      ctx.fillStyle = '#e4c493';
      ctx.fillRect(x+bx, by, 3, 2);
    });
  }

  // ── 물 타일 (사우스페리 해안) ─────────────────────────────────────────────
  _drawWaterTile(ctx, col) {
    const x = col * 32;
    ctx.fillStyle = '#1a5a8a';
    ctx.fillRect(x, 0, 32, 32);
    ctx.fillStyle = '#2270aa';
    [[0,4,14,3],[18,4,14,3],[4,14,12,3],[20,14,12,3],[0,24,16,3],[18,24,14,3]].forEach(([rx,ry,rw,rh]) => {
      ctx.fillRect(x+rx, ry, rw, rh);
    });
    ctx.fillStyle = '#3a80ba';
    [[2,6,8,1],[20,6,8,1],[6,16,8,1],[22,16,6,1],[2,26,10,1],[20,26,8,1]].forEach(([rx,ry,rw,rh]) => {
      ctx.fillRect(x+rx, ry, rw, rh);
    });
  }

  // ── 나무 판자 타일 (선착장) ───────────────────────────────────────────────
  _drawPlankTile(ctx, col) {
    const x = col * 32;
    ctx.fillStyle = '#9a7040';
    ctx.fillRect(x, 0, 32, 32);
    [0,8,16,24].forEach(py => {
      ctx.fillStyle = '#7a5828';
      ctx.fillRect(x, py, 32, 1);
      ctx.fillStyle = '#ba9060';
      ctx.fillRect(x, py+1, 32, 1);
    });
    [[3,3],[15,11],[27,3],[7,19],[19,27],[30,19]].forEach(([bx,by]) => {
      ctx.fillStyle = '#5a4020';
      ctx.fillRect(x+bx, by, 2, 2);
    });
  }

  // ── 야자수 (사우스페리 36×60) ─────────────────────────────────────────────
  _genPalmTree() {
    const canvas = this._canvas(36, 60);
    const ctx = canvas.getContext('2d');
    // 그림자
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath(); ctx.ellipse(18, 57, 12, 4, 0, 0, Math.PI*2); ctx.fill();
    // 줄기
    ctx.fillStyle = '#9a7030';
    ctx.fillRect(15, 30, 5, 28);
    ctx.fillRect(14, 20, 5, 12);
    ctx.fillRect(13, 10, 5, 12);
    ctx.fillRect(14, 4, 4, 8);
    ctx.fillStyle = '#7a5020';
    ctx.fillRect(16, 30, 2, 28);
    // 마디
    [30, 38, 46].forEach(py => {
      ctx.fillStyle = '#c09040';
      ctx.fillRect(14, py, 6, 2);
    });
    // 잎
    const drawLeaf = (lx, ly, angle, len) => {
      ctx.save();
      ctx.translate(lx, ly);
      ctx.rotate(angle);
      ctx.fillStyle = '#2d7a10';
      ctx.fillRect(0, -1, len, 3);
      ctx.fillRect(2, -2, Math.max(2, len-4), 2);
      ctx.fillRect(4, -3, Math.max(2, len-8), 2);
      ctx.restore();
    };
    const deg = (a) => Math.PI * a / 180;
    drawLeaf(17, 8, deg(-15), 20); drawLeaf(17, 8, deg(25),  18);
    drawLeaf(17, 8, deg(-55), 16); drawLeaf(17, 8, deg(65),  16);
    drawLeaf(17, 8, deg(-95), 14); drawLeaf(17, 8, deg(105), 14);
    drawLeaf(17, 8, deg(155), 12); drawLeaf(17, 8, deg(-155),12);
    this.textures.addCanvas('palm_tree', canvas);
  }

  // ── 건물 스프라이트 (64×72) ──────────────────────────────────────────────
  _genBuilding(key, roofColor, wallColor, doorColor, isShop = false) {
    const W = 64, H = 72;
    const canvas = this._canvas(W, H);
    const ctx = canvas.getContext('2d');
    // 그림자
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath(); ctx.ellipse(32, H-2, 26, 6, 0, 0, Math.PI*2); ctx.fill();
    // 벽
    ctx.fillStyle = wallColor;
    ctx.fillRect(4, 30, 56, 38);
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fillRect(4, 30, 1, 38); ctx.fillRect(59, 30, 1, 38);
    // 지붕
    ctx.fillStyle = roofColor;
    ctx.beginPath();
    ctx.moveTo(0, 32); ctx.lineTo(32, 4); ctx.lineTo(64, 32);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.beginPath();
    ctx.moveTo(2, 31); ctx.lineTo(32, 6); ctx.lineTo(44, 18); ctx.lineTo(32, 12); ctx.lineTo(2, 31);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, 32); ctx.lineTo(32, 4); ctx.lineTo(64, 32); ctx.stroke();
    // 굴뚝
    ctx.fillStyle = '#8a4020';
    ctx.fillRect(42, 6, 8, 16);
    ctx.fillStyle = '#aa5030';
    ctx.fillRect(40, 4, 12, 4);
    ctx.fillStyle = '#221010';
    ctx.fillRect(44, 8, 4, 10);
    // 문
    ctx.fillStyle = doorColor;
    ctx.fillRect(24, 44, 16, 22);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(24, 44, 1, 22); ctx.fillRect(39, 44, 1, 22);
    ctx.fillStyle = '#ffcc44';
    ctx.fillRect(37, 55, 2, 2);
    // 창문 (좌)
    ctx.fillStyle = '#99ddff';
    ctx.fillRect(8, 38, 12, 10);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(13, 38, 1, 10); ctx.fillRect(8, 43, 12, 1);
    ctx.strokeStyle = '#7aaccc'; ctx.lineWidth = 1;
    ctx.strokeRect(8, 38, 12, 10);
    // 창문 (우)
    ctx.fillStyle = '#99ddff';
    ctx.fillRect(44, 38, 12, 10);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(49, 38, 1, 10); ctx.fillRect(44, 43, 12, 1);
    ctx.strokeStyle = '#7aaccc'; ctx.lineWidth = 1;
    ctx.strokeRect(44, 38, 12, 10);
    // 상점 간판
    if (isShop) {
      ctx.fillStyle = '#cc9900';
      ctx.fillRect(14, 22, 36, 11);
      ctx.fillStyle = '#2a1000';
      ctx.font = 'bold 7px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('SHOP', 32, 31);
    }
    this.textures.addCanvas(key, canvas);
  }

  // ── 창고 스프라이트 (96×64) ──────────────────────────────────────────────
  _genWarehouse() {
    const W = 96, H = 64;
    const canvas = this._canvas(W, H);
    const ctx = canvas.getContext('2d');
    // 그림자
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath(); ctx.ellipse(48, H-2, 40, 6, 0, 0, Math.PI*2); ctx.fill();
    // 벽
    ctx.fillStyle = '#c09060';
    ctx.fillRect(2, 20, 92, 42);
    ctx.fillStyle = '#a07040';
    ctx.fillRect(2, 20, 6, 42); ctx.fillRect(88, 20, 6, 42);
    // 지붕 삼각
    ctx.fillStyle = '#aa5530';
    ctx.beginPath();
    ctx.moveTo(0, 22); ctx.lineTo(48, 2); ctx.lineTo(96, 22);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#cc6640';
    ctx.beginPath();
    ctx.moveTo(2, 22); ctx.lineTo(48, 4); ctx.lineTo(62, 13); ctx.lineTo(48, 8); ctx.lineTo(2, 22);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#884422';
    ctx.fillRect(0, 20, 96, 4);
    // 큰 문 (이중)
    ctx.fillStyle = '#5a3810';
    ctx.fillRect(30, 28, 17, 34); ctx.fillStyle = '#4a2808'; ctx.fillRect(49, 28, 17, 34);
    [0,6,12,18,24,30].forEach(d => {
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.fillRect(30, 28+d, 36, 1);
    });
    ctx.fillStyle = '#886644';
    [[30,30],[30,48],[48,30],[48,48],[66,30],[66,48]].forEach(([hx,hy]) => {
      ctx.fillRect(hx-1, hy, 3, 3);
    });
    // 작은 창문
    [[8,26],[72,26]].forEach(([wx,wy]) => {
      ctx.fillStyle = '#88aacc'; ctx.fillRect(wx, wy, 16, 12);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(wx+7, wy, 1, 12); ctx.fillRect(wx, wy+5, 16, 1);
    });
    this.textures.addCanvas('warehouse', canvas);
  }

  // ── 배 스프라이트 (240×120) ───────────────────────────────────────────────
  _genShip() {
    const W = 240, H = 120;
    const canvas = this._canvas(W, H);
    const ctx = canvas.getContext('2d');
    // 선체
    ctx.fillStyle = '#7a4a18';
    ctx.beginPath();
    ctx.moveTo(20, 68); ctx.lineTo(10, 88); ctx.lineTo(230, 88); ctx.lineTo(220, 68);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#5a3208';
    ctx.beginPath();
    ctx.moveTo(10, 88); ctx.lineTo(8, 104); ctx.lineTo(232, 104); ctx.lineTo(230, 88);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#9a6030';
    ctx.fillRect(22, 69, 196, 5);
    // 갑판
    ctx.fillStyle = '#d4a460';
    ctx.fillRect(20, 56, 200, 14);
    [0,4,8,12].forEach(d => {
      ctx.fillStyle = '#b88840';
      ctx.fillRect(20, 56+d, 200, 1);
    });
    // 캐빈
    ctx.fillStyle = '#e8c880';
    ctx.fillRect(80, 28, 100, 30);
    ctx.fillStyle = '#c8a860'; ctx.fillRect(80, 28, 100, 4);
    [90,110,130,150].forEach(wx => {
      ctx.fillStyle = '#88bbdd'; ctx.fillRect(wx, 36, 10, 12);
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.fillRect(wx+4, 36, 1, 12); ctx.fillRect(wx, 41, 10, 1);
    });
    // 돛대
    ctx.fillStyle = '#5a3a10'; ctx.fillRect(118, 2, 5, 58);
    // 돛
    ctx.fillStyle = '#f0e8d0';
    ctx.beginPath();
    ctx.moveTo(123, 6); ctx.lineTo(123, 48); ctx.lineTo(178, 34); ctx.lineTo(170, 12);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#d8d0b8';
    ctx.beginPath();
    ctx.moveTo(118, 8); ctx.lineTo(118, 46); ctx.lineTo(68, 33); ctx.lineTo(74, 14);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#6a4a20';
    ctx.fillRect(68, 12, 112, 3); ctx.fillRect(72, 29, 108, 3);
    // 깃발
    ctx.fillStyle = '#ff4444';
    ctx.beginPath();
    ctx.moveTo(123, 2); ctx.lineTo(136, 6); ctx.lineTo(123, 10);
    ctx.closePath(); ctx.fill();
    // 닻줄
    ctx.strokeStyle = '#5a3a10'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(20, 60); ctx.lineTo(5, 68); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(220, 60); ctx.lineTo(235, 68); ctx.stroke();
    this.textures.addCanvas('ship', canvas);
  }

  // ── NPC 스프라이트 (28×40) ────────────────────────────────────────────────
  _genNPC(key, skinHex, hairHex, topHex, bottomHex, hatHex) {
    const W = 28, H = 40;
    const canvas = this._canvas(W, H);
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    const h = (n) => `#${n.toString(16).padStart(6, '0')}`;
    const skin = h(skinHex), hair = h(hairHex), top = h(topHex), bottom = h(bottomHex);
    const hasHat = !!hatHex;
    const hat = hasHat ? h(hatHex) : null;
    // 그림자
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath(); ctx.ellipse(14, 38, 10, 3, 0, 0, Math.PI*2); ctx.fill();
    // 다리
    ctx.fillStyle = bottom;
    ctx.fillRect(8, 26, 5, 10); ctx.fillRect(15, 26, 5, 10);
    // 신발
    ctx.fillStyle = '#333333';
    ctx.fillRect(7, 35, 7, 3); ctx.fillRect(14, 35, 7, 3);
    // 몸통
    ctx.fillStyle = top;
    ctx.fillRect(6, 14, 16, 13);
    ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(6, 14, 16, 2);
    // 팔
    ctx.fillStyle = top;
    ctx.fillRect(2, 15, 4, 10); ctx.fillRect(22, 15, 4, 10);
    // 손
    ctx.fillStyle = skin;
    ctx.fillRect(2, 24, 4, 3); ctx.fillRect(22, 24, 4, 3);
    // 목
    ctx.fillStyle = skin; ctx.fillRect(11, 10, 6, 5);
    // 머리
    ctx.fillStyle = skin;
    ctx.fillRect(7, 2, 14, 9); ctx.fillRect(6, 3, 16, 7);
    // 눈
    ctx.fillStyle = '#1a0a00';
    ctx.fillRect(10, 6, 2, 2); ctx.fillRect(16, 6, 2, 2);
    // 입
    ctx.fillStyle = '#cc8888'; ctx.fillRect(12, 9, 4, 1);
    // 머리카락
    ctx.fillStyle = hair;
    ctx.fillRect(6, 1, 16, 4);
    ctx.fillRect(6, 2, 2, 6); ctx.fillRect(20, 2, 2, 6);
    // 모자
    if (hasHat) {
      ctx.fillStyle = hat;
      ctx.fillRect(5, 1, 18, 3);
      ctx.fillRect(7, -1, 14, 3);
    }
    this.textures.addCanvas(key, canvas);
  }
}
