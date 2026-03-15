/* ArenaClient.js — 투기장 실시간 멀티플레이어 WebSocket 클라이언트 */

export default class ArenaClient {
  constructor({ userId, username, hp, maxHp, level, onJoin, onLeave, onMove, onHit, onDead }) {
    this._userId   = String(userId);
    this._username = username;
    this._cbs      = { onJoin, onLeave, onMove, onHit, onDead };
    this._ws       = null;
    this._connected = false;
    this._moveThrottle = 0;
    this._connect(hp, maxHp, level);
  }

  _connect(hp, maxHp, level) {
    try {
      const proto = location.protocol === 'https:' ? 'wss' : 'ws';
      const url = `${proto}://${location.host}/api/arena/ws` +
        `?user_id=${encodeURIComponent(this._userId)}` +
        `&username=${encodeURIComponent(this._username)}` +
        `&hp=${hp}&max_hp=${maxHp}&level=${level}`;
      this._ws = new WebSocket(url);
      this._ws.addEventListener('open',    ()  => { this._connected = true; });
      this._ws.addEventListener('message', (e) => { try { this._handle(JSON.parse(e.data)); } catch {} });
      this._ws.addEventListener('close',   ()  => { this._connected = false; });
      this._ws.addEventListener('error',   ()  => { this._connected = false; });
    } catch {}
  }

  _handle(msg) {
    const cb = this._cbs;
    switch (msg.type) {
      case 'init':  msg.players.forEach(p => cb.onJoin?.(p)); break;
      case 'join':  cb.onJoin?.(msg);                         break;
      case 'leave': cb.onLeave?.(msg.userId);                 break;
      case 'move':  cb.onMove?.(msg.userId, msg.x, msg.y);   break;
      case 'hit':   cb.onHit?.(msg.attackerId, msg.targetUserId, msg.damage, msg.targetHp); break;
      case 'dead':  cb.onDead?.(msg.userId, msg.attackerId);  break;
    }
  }

  sendMove(x, y) {
    const now = Date.now();
    if (!this._connected || now - this._moveThrottle < 50) return;
    this._moveThrottle = now;
    this._send({ type: 'move', x: Math.round(x), y: Math.round(y) });
  }

  sendAttack(targetUserId, damage) {
    if (!this._connected) return;
    this._send({ type: 'attack', targetUserId: String(targetUserId), damage });
  }

  updateStats(hp, maxHp, level) {
    if (!this._connected) return;
    this._send({ type: 'update_stats', hp, maxHp, level });
  }

  _send(data) {
    try {
      if (this._ws?.readyState === WebSocket.OPEN) this._ws.send(JSON.stringify(data));
    } catch {}
  }

  destroy() {
    this._connected = false;
    try { this._ws?.close(); } catch {}
    this._ws = null;
  }
}
