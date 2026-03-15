/** 전역 인증 상태 — 씬 전환 시에도 유지되는 싱글턴 */
export const AuthState = {
  userId:   null,   // number | 'local'
  username: null,   // string
  isGuest:  false,

  set(userId, username) {
    this.userId   = userId;
    this.username = username;
    this.isGuest  = false;
  },

  setGuest() {
    this.userId   = 'local';
    this.username = 'guest';
    this.isGuest  = true;
  },

  clear() {
    this.userId   = null;
    this.username = null;
    this.isGuest  = false;
  },
};
