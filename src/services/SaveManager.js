/**
 * SaveManager — 캐릭터 진행상황 D1 동기화
 *
 * 저장 트리거:
 *   - 5초 자동 인터벌 (위치 포함 전체 스탯)
 *   - saveNow()  : 레벨업, 아이템 루팅 등 즉시 저장
 *   - destroy()  : 씬 종료 시 마지막 저장
 *   - beforeunload : 브라우저 닫기 시 keepalive fetch
 */
import { AuthState } from './AuthState.js';

export default class SaveManager {
  /**
   * @param {Phaser.Scene} scene
   * @param {() => object|null} getStats  — 현재 저장 데이터를 반환하는 콜백
   */
  constructor(scene, getStats) {
    this._scene    = scene;
    this._getStats = getStats;
    this._saving   = false;

    // ── 5초 자동 저장 ──────────────────────────────────────────────────────
    this._autoTimer = scene.time.addEvent({
      delay:    5000,
      loop:     true,
      callback: () => this._flush('auto'),
    });

    // ── 브라우저 닫기 / 탭 닫기 ────────────────────────────────────────────
    this._unloadHandler = () => this._flushOnUnload();
    window.addEventListener('beforeunload', this._unloadHandler);
  }

  // ── 즉시 저장 (레벨업, 아이템 루팅 등 중요 이벤트) ──────────────────────
  saveNow(reason = '') {
    this._flush(reason);
  }

  // ── 내부: 비동기 저장 ────────────────────────────────────────────────────
  async _flush(reason) {
    if (this._saving) return;
    if (!AuthState.userId || AuthState.isGuest) return;

    const data = this._getStats();
    if (!data) return;

    this._saving = true;
    try {
      const res = await fetch('/api/character', {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(data),
      });
      if (res.ok) {
        this._scene._showSaveIndicator?.(reason);
      }
    } catch (_e) {
      // 네트워크 오류 — 다음 인터벌에 재시도
    } finally {
      this._saving = false;
    }
  }

  // ── 내부: 동기식 페이지 언로드 저장 (keepalive) ──────────────────────────
  _flushOnUnload() {
    if (!AuthState.userId || AuthState.isGuest) return;
    const data = this._getStats();
    if (!data) return;
    // keepalive: true → 페이지 닫힌 후에도 브라우저가 요청 완료 보장
    fetch('/api/character', {
      method:    'PUT',
      headers:   { 'Content-Type': 'application/json' },
      body:      JSON.stringify(data),
      keepalive: true,
    }).catch(() => {});
  }

  // ── 씬 종료 / 포탈 전환 시 호출 ─────────────────────────────────────────
  destroy() {
    if (this._autoTimer) {
      this._autoTimer.remove(false);
      this._autoTimer = null;
    }
    window.removeEventListener('beforeunload', this._unloadHandler);
    // 마지막 동기 저장
    this._flushOnUnload();
  }
}
