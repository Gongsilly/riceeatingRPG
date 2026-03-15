/* LoginScene.js — 로그인 / 회원가입 (HTML 오버레이 방식, Phaser DOM 플러그인 불필요) */
import { AuthState } from '../services/AuthState.js';

export default class LoginScene extends Phaser.Scene {
  constructor() { super('LoginScene'); }

  create() {
    const W = this.scale.width;
    const H = this.scale.height;

    // ── Phaser 배경 그래픽 ─────────────────────────────────────────────────
    this.add.rectangle(W / 2, H / 2, W, H, 0x07111d);

    // 별
    const sg = this.add.graphics();
    for (let i = 0; i < 60; i++) {
      sg.fillStyle(0xffffff, Phaser.Math.FloatBetween(0.2, 0.7));
      sg.fillCircle(
        Phaser.Math.Between(0, W),
        Phaser.Math.Between(0, H * 0.7),
        Phaser.Math.FloatBetween(0.5, 2),
      );
    }

    // 땅
    const gg = this.add.graphics();
    gg.fillStyle(0x1a3a1a).fillRect(0, H * 0.72, W, H * 0.28);
    gg.fillStyle(0x2a5a2a).fillRect(0, H * 0.72, W, 6);

    // 나무 실루엣
    const tg = this.add.graphics();
    for (let x = 30; x < W; x += Phaser.Math.Between(55, 90)) {
      const tx = x + Phaser.Math.Between(-10, 10);
      const th = Phaser.Math.Between(55, 90);
      const tw = th * 0.55;
      const gy = H * 0.72;
      tg.fillStyle(0x1a3a10);
      tg.fillRect(tx - 3, gy - 18, 6, 18);
      tg.fillTriangle(tx, gy - th,        tx - tw / 2,   gy - 20,       tx + tw / 2,   gy - 20);
      tg.fillTriangle(tx, gy - th * 0.65, tx - tw * 0.6, gy - 18,       tx + tw * 0.6, gy - 18);
      tg.fillStyle(0x2a5a18);
      tg.fillTriangle(tx, gy - th * 1.05, tx - tw * 0.45, gy - th * 0.35, tx + tw * 0.45, gy - th * 0.35);
    }

    // 버전 라벨
    this.add.text(8, 8, 'v0.000.026', {
      fontSize: '10px', color: '#445566',
      backgroundColor: '#00000055', padding: { x: 3, y: 2 },
    });

    // ── HTML 오버레이 ──────────────────────────────────────────────────────
    this._overlay = this._buildOverlay();

    // 씬 종료 시 오버레이 정리
    this.events.once('shutdown', () => this._destroyOverlay());
    this.events.once('destroy',  () => this._destroyOverlay());
  }

  // ── HTML 오버레이 생성 ───────────────────────────────────────────────────
  _buildOverlay() {
    // 스타일
    const style = document.createElement('style');
    style.id = 'lo-style';
    style.textContent = `
      #lo-wrap {
        position:fixed; inset:0; z-index:1000;
        display:flex; align-items:center; justify-content:center;
        pointer-events:none;
      }
      #lo-panel {
        background:rgba(8,14,26,0.97); border:1px solid #2a4060;
        border-radius:10px; padding:34px 30px; width:310px;
        pointer-events:all;
        box-shadow:0 8px 32px rgba(0,0,0,.7);
        font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
      }
      #lo-panel h1 {
        font-size:22px; color:#ffee44; text-align:center; margin:0 0 5px;
        text-shadow:0 2px 6px rgba(0,0,0,.8);
      }
      #lo-panel .sub {
        font-size:12px; color:#5577aa; text-align:center; margin:0 0 20px;
      }
      #lo-tabs {
        display:flex; border:1px solid #1e3050; border-radius:6px;
        overflow:hidden; margin-bottom:16px;
      }
      .lo-tab {
        flex:1; padding:8px 0; background:#06101e; border:none;
        color:#445566; font-size:13px; cursor:pointer;
        transition:background .15s,color .15s;
      }
      .lo-tab.on { background:#182a44; color:#88ccff; font-weight:700; }
      #lo-panel input {
        display:block; width:100%; padding:10px 12px; margin-bottom:10px;
        background:#04090f; border:1px solid #1e3050; border-radius:6px;
        color:#cce4ff; font-size:14px; outline:none; box-sizing:border-box;
      }
      #lo-panel input:focus { border-color:#3a6aaa; }
      #lo-msg { min-height:18px; font-size:12px; text-align:center; margin-bottom:8px; }
      #lo-submit {
        width:100%; padding:11px; background:#e8bb00; border:none;
        border-radius:6px; color:#000; font-size:14px; font-weight:700;
        cursor:pointer; margin-bottom:11px; transition:background .1s;
      }
      #lo-submit:hover:not(:disabled) { background:#ffd633; }
      #lo-submit:disabled { opacity:.5; cursor:not-allowed; }
      .lo-div {
        display:flex; align-items:center; gap:10px; margin-bottom:10px;
        color:#334455; font-size:11px;
      }
      .lo-div::before,.lo-div::after {
        content:''; flex:1; height:1px; background:#182030;
      }
      #lo-guest {
        width:100%; padding:9px; background:transparent;
        border:1px solid #1e3050; border-radius:6px;
        color:#4a6a88; font-size:13px; cursor:pointer;
        transition:background .1s, color .1s;
      }
      #lo-guest:hover { background:#0a1a28; color:#88aacc; }
    `;
    document.head.appendChild(style);

    // HTML
    const wrap = document.createElement('div');
    wrap.id = 'lo-wrap';
    wrap.innerHTML = `
      <div id="lo-panel">
        <h1>🍚 Rice Eating RPG</h1>
        <p class="sub">Maple Island에 오신 것을 환영합니다</p>
        <div id="lo-tabs">
          <button class="lo-tab on" data-m="login">로그인</button>
          <button class="lo-tab"    data-m="register">회원가입</button>
        </div>
        <input id="lo-id" type="text"     placeholder="아이디"   maxlength="20" autocomplete="username">
        <input id="lo-pw" type="password" placeholder="비밀번호" maxlength="30" autocomplete="current-password">
        <div id="lo-msg"></div>
        <button id="lo-submit">로그인</button>
        <div class="lo-div">또는</div>
        <button id="lo-guest">게스트로 시작</button>
      </div>
    `;
    document.body.appendChild(wrap);

    // 이벤트 바인딩
    let mode = 'login';

    const setMode = (m) => {
      mode = m;
      wrap.querySelectorAll('.lo-tab').forEach(b => b.classList.toggle('on', b.dataset.m === m));
      wrap.querySelector('#lo-submit').textContent = m === 'login' ? '로그인' : '회원가입';
      setMsg('');
      wrap.querySelector('#lo-id').value = '';
      wrap.querySelector('#lo-pw').value = '';
      wrap.querySelector('#lo-id').focus();
    };

    const setMsg = (txt, color = '#ff7766') => {
      const el = wrap.querySelector('#lo-msg');
      el.textContent = txt;
      el.style.color = color;
    };

    wrap.querySelectorAll('.lo-tab').forEach(btn => {
      btn.addEventListener('click', () => setMode(btn.dataset.m));
    });

    const submit = async () => {
      const id = wrap.querySelector('#lo-id').value.trim().toLowerCase();
      const pw = wrap.querySelector('#lo-pw').value;
      const submitBtn = wrap.querySelector('#lo-submit');
      if (!id || !pw) { setMsg('아이디와 비밀번호를 입력해주세요.'); return; }

      setMsg('처리 중...', '#aaaaff');
      submitBtn.disabled = true;

      try {
        if (mode === 'register') {
          const res  = await fetch('/api/auth/register', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: id, password: pw }),
          });
          const data = await res.json();
          if (!res.ok) { setMsg(data.error ?? '회원가입 실패'); }
          else {
            setMsg('계정이 생성되었습니다! 로그인해주세요.', '#55ffaa');
            setMode('login');
            wrap.querySelector('#lo-id').value = id;
            wrap.querySelector('#lo-pw').focus();
          }
        } else {
          const lRes  = await fetch('/api/auth/login', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: id, password: pw }),
          });
          const lData = await lRes.json();
          if (!lRes.ok) { setMsg(lData.error ?? '로그인 실패'); }
          else if (lData.isAdmin) {
            // 관리자 계정 → 어드민 페이지로 이동
            sessionStorage.setItem('admin_token', lData.token ?? 'riceadmin_2025_secure_token');
            this._destroyOverlay();
            window.location.href = '/admin.html';
          } else {
            const cRes    = await fetch(`/api/character?user_id=${lData.userId}`);
            const charStats = cRes.ok ? await cRes.json() : null;
            AuthState.set(lData.userId, lData.username);
            this._startGame(charStats);
          }
        }
      } catch {
        setMsg('서버 오류가 발생했습니다.');
      } finally {
        submitBtn.disabled = false;
      }
    };

    wrap.querySelector('#lo-submit').addEventListener('click', submit);
    wrap.querySelector('#lo-guest').addEventListener('click', () => {
      AuthState.setGuest();
      this._startGame(null);
    });
    wrap.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });

    // 초기 포커스
    setTimeout(() => wrap.querySelector('#lo-id')?.focus(), 80);

    this._overlayStyle = style;
    return wrap;
  }

  _destroyOverlay() {
    this._overlay?.remove();
    this._overlayStyle?.remove();
    this._overlay      = null;
    this._overlayStyle = null;
  }

  _startGame(charStats) {
    this._destroyOverlay();
    const mapId  = charStats?.mapId  ?? 100000000;
    const startX = charStats?.posX   ?? 960;
    const startY = charStats?.posY   ?? 720;
    this.cameras.main.fade(500, 0, 0, 0, false, (_cam, p) => {
      if (p < 1) return;
      this.scene.start('GameScene', { mapId, startX, startY, charStats });
    });
  }
}
