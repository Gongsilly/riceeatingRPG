export default class Player {
  constructor(scene, x, y) {
    this.scene = scene;

    // 노란 사각형 캐릭터
    this.sprite = scene.add.rectangle(x, y, 32, 32, 0xffdd00);
    scene.physics.add.existing(this.sprite);
    this.sprite.body.setCollideWorldBounds(false);
    this.sprite.setDepth(5);

    // 방향 표시 삼각형 (캐릭터 앞쪽)
    this._dirGfx = scene.add.graphics().setDepth(6);

    this.speed = 220;
    this.targetX = x;
    this.targetY = y;
    this.moving = false;

    // 아날로그 스틱 방향 벡터
    this.padDx = 0;
    this.padDy = 0;

    // 바라보는 방향 (공격 발사용)
    this.facingX = 1;
    this.facingY = 0;
  }

  _drawFacing() {
    const g = this._dirGfx;
    g.clear();

    const cx = this.sprite.x;
    const cy = this.sprite.y;
    const dist = 22;        // 캐릭터 중심에서 앞쪽 거리
    const hw   = 7;         // 삼각형 너비 절반
    const len  = 10;        // 삼각형 길이

    // 앞 방향 벡터
    const fx = this.facingX;
    const fy = this.facingY;
    // 수직 벡터
    const px = -fy;
    const py =  fx;

    // 삼각형 꼭짓점 3개
    const tip = { x: cx + fx * (dist + len), y: cy + fy * (dist + len) };
    const l   = { x: cx + fx * dist + px * hw, y: cy + fy * dist + py * hw };
    const r   = { x: cx + fx * dist - px * hw, y: cy + fy * dist - py * hw };

    g.fillStyle(0xffffff, 0.9);
    g.fillTriangle(tip.x, tip.y, l.x, l.y, r.x, r.y);

    g.lineStyle(1.5, 0xffdd00, 0.8);
    g.strokeTriangle(tip.x, tip.y, l.x, l.y, r.x, r.y);
  }

  moveTo(x, y) {
    this.padDx = 0;
    this.padDy = 0;
    this.targetX = x;
    this.targetY = y;
    this.moving = true;
  }

  // 십자키 방향 설정 (0이면 정지)
  setPadDirection(dx, dy) {
    this.padDx = dx;
    this.padDy = dy;
    if (dx !== 0 || dy !== 0) {
      this.moving = false; // 클릭 이동 취소
      const len = Math.sqrt(dx * dx + dy * dy);
      this.facingX = dx / len;
      this.facingY = dy / len;
    }
  }

  update() {
    // 아날로그 스틱 입력 우선
    if (this.padDx !== 0 || this.padDy !== 0) {
      const len = Math.sqrt(this.padDx * this.padDx + this.padDy * this.padDy);
      this.sprite.body.setVelocity(
        (this.padDx / len) * this.speed,
        (this.padDy / len) * this.speed,
      );
      this._drawFacing();
      return;
    }

    if (!this.moving) {
      this.sprite.body.setVelocity(0, 0);
      return;
    }

    const dx = this.targetX - this.sprite.x;
    const dy = this.targetY - this.sprite.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 4) {
      this.sprite.body.setVelocity(0, 0);
      this.sprite.x = this.targetX;
      this.sprite.y = this.targetY;
      this.moving = false;
    } else {
      const vx = (dx / dist) * this.speed;
      const vy = (dy / dist) * this.speed;
      this.sprite.body.setVelocity(vx, vy);
      this.facingX = dx / dist;
      this.facingY = dy / dist;
    }

    this._drawFacing();
  }

  get x() { return this.sprite.x; }
  get y() { return this.sprite.y; }
}
