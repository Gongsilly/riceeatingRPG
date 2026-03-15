-- ── USERS ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS USERS (
  user_id       INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT    NOT NULL UNIQUE,
  password_hash TEXT    NOT NULL,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ── CHARACTER_STATS ───────────────────────────────────────────────────────────
-- user_id 1:1 매핑, 계정 생성 시 기본값으로 자동 INSERT
CREATE TABLE IF NOT EXISTS CHARACTER_STATS (
  user_id       INTEGER PRIMARY KEY,
  current_level INTEGER NOT NULL DEFAULT 1,
  current_exp   INTEGER NOT NULL DEFAULT 0,
  hp            INTEGER NOT NULL DEFAULT 50,
  mp            INTEGER NOT NULL DEFAULT 50,
  str           INTEGER NOT NULL DEFAULT 4,
  dex           INTEGER NOT NULL DEFAULT 4,
  int_stat      INTEGER NOT NULL DEFAULT 4,
  luk           INTEGER NOT NULL DEFAULT 4,
  ap            INTEGER NOT NULL DEFAULT 0,
  map_id        INTEGER NOT NULL DEFAULT 100000000,
  pos_x         REAL    NOT NULL DEFAULT 960,
  pos_y         REAL    NOT NULL DEFAULT 720,
  FOREIGN KEY (user_id) REFERENCES USERS(user_id)
);
