-- ── 아이템 테이블 ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS items (
  id          TEXT    PRIMARY KEY,
  name        TEXT    NOT NULL,
  description TEXT    NOT NULL,
  body_color  INTEGER NOT NULL,
  gem_color   INTEGER NOT NULL
);

-- ── 몬스터 테이블 ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS monsters (
  id          TEXT    PRIMARY KEY,
  name        TEXT    NOT NULL,
  hp          INTEGER NOT NULL,
  exp         INTEGER NOT NULL,
  damage      INTEGER NOT NULL,
  body_color  INTEGER NOT NULL,
  shell_color INTEGER NOT NULL
);

-- ── 드롭 테이블 ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS monster_drops (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  monster_id  TEXT    NOT NULL REFERENCES monsters(id),
  item_id     TEXT    NOT NULL REFERENCES items(id),
  chance      REAL    NOT NULL -- 0.0 ~ 1.0
);
