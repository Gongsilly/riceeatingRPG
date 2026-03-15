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
    this._genPlayerSheet();
    this._genMonsterSheet('green_snail', '#44cc44', '#228822', '#1d8800');
    this._genMonsterSheet('blue_snail',  '#4488ff', '#2255cc', '#0033aa');
    this._genSporeSheet();
    this._genSpark();
    this.scene.start('GameScene');
  }

  // ── 유틸 ─────────────────────────────────────────────────────────────────────
  _canvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }

  // ── 타일셋 (32×32 × 6종, 좌→우) ─────────────────────────────────────────────
  // 인덱스(1-based): 1=어두운잔디 2=중간잔디 3=밝은잔디 4=흙 5=어두운흙 6=꽃
  _genTileset() {
    const T = 32, N = 6;
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
}
