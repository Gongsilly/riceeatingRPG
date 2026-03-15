export default class MagicClaw {
  constructor(scene, fromX, fromY, toX, toY) {
    this.scene = scene;
    this.alive = true;

    // 마우스 방향 벡터
    const dx = toX - fromX;
    const dy = toY - fromY;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const nx = dx / len;
    const ny = dy / len;
    this.nx = nx;
    this.ny = ny;

    // 수직 벡터 (두 줄 간격)
    const px = -ny * 5;
    const py =  nx * 5;

    const clawLen = 320;
    const speed   = 520;

    // 두 줄 그래픽
    this.g1 = scene.add.graphics();
    this.g2 = scene.add.graphics();

    this.startX1 = fromX + px; this.startY1 = fromY + py;
    this.startX2 = fromX - px; this.startY2 = fromY - py;

    this.vx = nx * speed;
    this.vy = ny * speed;
    this.elapsed = 0;
    this.duration = (clawLen / speed) * 1000; // ms

    this.hitbox = new Phaser.Geom.Circle(fromX, fromY, 18);
  }

  update(delta) {
    if (!this.alive) return;

    this.elapsed += delta;
    const t = Math.min(this.elapsed / this.duration, 1);

    const ex1 = this.startX1 + this.vx * (this.elapsed / 1000);
    const ey1 = this.startY1 + this.vy * (this.elapsed / 1000);
    const ex2 = this.startX2 + this.vx * (this.elapsed / 1000);
    const ey2 = this.startY2 + this.vy * (this.elapsed / 1000);

    // 히트박스는 중간 지점 추적
    this.hitbox.x = (this.startX1 + ex1) / 2;
    this.hitbox.y = (this.startY1 + ey1) / 2;

    // 줄 1 그리기
    this.g1.clear();
    this.g1.lineStyle(3, 0xcc44ff, 1.0);
    this.g1.beginPath();
    this.g1.moveTo(this.startX1, this.startY1);
    this.g1.lineTo(ex1, ey1);
    this.g1.strokePath();

    // 줄 2 그리기
    this.g2.clear();
    this.g2.lineStyle(3, 0x9933ff, 0.85);
    this.g2.beginPath();
    this.g2.moveTo(this.startX2, this.startY2);
    this.g2.lineTo(ex2, ey2);
    this.g2.strokePath();

    if (t >= 1) this.destroy();
  }

  destroy() {
    this.alive = false;
    this.g1.destroy();
    this.g2.destroy();
  }

  // 스내일 히트 체크
  checkHit(snail) {
    if (!snail.alive) return false;
    const d = Phaser.Math.Distance.Between(this.hitbox.x, this.hitbox.y, snail.sprite.x, snail.sprite.y);
    return d < this.hitbox.radius + 14;
  }
}
