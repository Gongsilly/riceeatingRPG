/* Portal.js ─ 맵 이동 포탈 (시각 + 충돌 판정) */
export default class Portal {
  constructor(scene, portalData, toMapName) {
    this.scene    = scene;
    this.x        = portalData.pos_x;
    this.y        = portalData.pos_y;
    this.toMapId  = portalData.to_map_id;
    this.targetX  = portalData.target_x;
    this.targetY  = portalData.target_y;
    this._used    = false;

    const RADIUS = 32;

    // ── 포탈 그래픽 ───────────────────────────────────────────────────────────
    this._gfx = scene.add.graphics().setDepth(3);
    this._angle = 0;

    this._drawPortal(0);

    // 이름 라벨
    this._label = scene.add.text(this.x, this.y - 52, `▶ ${toMapName}`, {
      fontSize: '11px', color: '#aaffee',
      stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(4);

    // 포탈 입장 안내
    this._hint = scene.add.text(this.x, this.y + 48, '[ 맵 이동 ]', {
      fontSize: '10px', color: '#55ffcc',
      stroke: '#000', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(4).setAlpha(0);

    // 회전 트윈
    scene.tweens.add({
      targets: this, _angle: Math.PI * 2,
      duration: 2200, repeat: -1,
      onUpdate: () => this._drawPortal(this._angle),
    });

    this._RADIUS = RADIUS;
  }

  _drawPortal(angle) {
    const g = this._gfx;
    const { x, y } = this;
    const R = this._RADIUS ?? 32;
    g.clear();

    // 바닥 그림자
    g.fillStyle(0x000000, 0.18);
    g.fillEllipse(x, y + R * 0.8, R * 2.2, R * 0.6);

    // 외부 링 (회전)
    for (let i = 0; i < 8; i++) {
      const a = angle + (i / 8) * Math.PI * 2;
      const px = x + Math.cos(a) * R;
      const py = y + Math.sin(a) * R * 0.45;
      const alpha = 0.4 + 0.6 * ((Math.sin(a * 2 + angle) + 1) / 2);
      g.fillStyle(0x00ffcc, alpha);
      g.fillCircle(px, py, 4);
    }

    // 내부 타원 (포탈 구멍)
    g.fillStyle(0x001a33, 0.88);
    g.fillEllipse(x, y, R * 1.6, R * 0.9);

    // 내부 빛
    g.fillStyle(0x00ffcc, 0.12 + 0.08 * Math.sin(angle * 3));
    g.fillEllipse(x, y, R * 1.0, R * 0.55);

    // 테두리 링
    g.lineStyle(2, 0x00ffcc, 0.7);
    g.strokeEllipse(x, y, R * 1.6, R * 0.9);
  }

  /** 플레이어가 포탈 범위 안에 있는지 확인 */
  checkOverlap(player) {
    if (this._used) return false;
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    // 타원형 충돌 (가로가 넓음)
    return (dx * dx) / (this._RADIUS * this._RADIUS) +
           (dy * dy) / (this._RADIUS * 0.5 * this._RADIUS * 0.5) < 1;
  }

  showHint(visible) {
    this._hint.setAlpha(visible ? 1 : 0);
  }

  destroy() {
    this._gfx.destroy();
    this._label.destroy();
    this._hint.destroy();
  }
}
