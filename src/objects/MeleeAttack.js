/* MeleeAttack.js ─ 근접 부채꼴 공격 (60°, 반경 75px) */
export default class MeleeAttack {
  constructor(scene, x, y, facingX, facingY) {
    this.scene = scene;
    this.alive  = true;

    // 방향 벡터
    this.nx = facingX;
    this.ny = facingY;
    this._ox = x;
    this._oy = y;

    const RADIUS    = 75;
    const HALF_ARC  = Math.PI / 6; // ±30° → 60° 부채꼴
    const center    = Math.atan2(facingY, facingX);
    const start     = center - HALF_ARC;
    const end       = center + HALF_ARC;

    this._center = center;
    this._half   = HALF_ARC;
    this._radius = RADIUS;

    // ── 부채꼴 그래픽 ──────────────────────────────────────────────────────────
    const g = scene.add.graphics().setDepth(8);

    // 내부 채움 (황금색 반투명)
    g.fillStyle(0xffe066, 0.45);
    g.beginPath();
    g.moveTo(x, y);
    g.arc(x, y, RADIUS, start, end, false);
    g.closePath();
    g.fillPath();

    // 테두리 — 호 + 두 변
    g.lineStyle(2.5, 0xffffff, 0.90);
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + Math.cos(start) * RADIUS, y + Math.sin(start) * RADIUS);
    g.arc(x, y, RADIUS, start, end, false);
    g.lineTo(x, y);
    g.strokePath();

    // 안쪽 밝은 호 (깊이감)
    g.lineStyle(1.5, 0xffffcc, 0.55);
    g.beginPath();
    g.arc(x, y, RADIUS * 0.4, start, end, false);
    g.strokePath();

    // 페이드아웃
    scene.tweens.add({
      targets: g, alpha: 0, duration: 230, ease: 'Power2',
      onComplete: () => { if (g.active) g.destroy(); },
    });

    // ── 파티클 버스트 ──────────────────────────────────────────────────────────
    const bx  = x + Math.cos(center) * RADIUS * 0.65;
    const by  = y + Math.sin(center) * RADIUS * 0.65;
    const deg = Phaser.Math.RadToDeg(center);

    const burst = scene.add.particles(bx, by, 'spark', {
      speed:    { min: 55, max: 190 },
      scale:    { start: 0.9, end: 0 },
      alpha:    { start: 1,   end: 0 },
      lifespan: 330,
      tint:     [0xffe066, 0xffffff, 0xffcc00, 0xffaa00],
      angle:    { min: deg - 50, max: deg + 50 },
      emitting: false,
    }).setDepth(9);
    burst.explode(16);
    scene.time.delayedCall(450, () => { if (burst.active) burst.destroy(); });

    // 생존 시간 (220ms 후 GameScene 필터에서 제거됨)
    scene.time.delayedCall(220, () => { this.alive = false; });
  }

  // ── 부채꼴 충돌 판정 ────────────────────────────────────────────────────────
  checkHit(snail) {
    if (!snail.alive) return false;

    const dx   = snail.sprite.x - this._ox;
    const dy   = snail.sprite.y - this._oy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > this._radius + 14) return false;

    // 각도 차이 계산 (-π ~ π 범위)
    let diff = Math.atan2(dy, dx) - this._center;
    while (diff >  Math.PI) diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;

    return Math.abs(diff) <= this._half;
  }

  update(_delta) { /* 근접공격 - 이동 없음 */ }
}
