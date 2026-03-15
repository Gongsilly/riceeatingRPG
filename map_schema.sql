-- ── 맵 마스터 ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS MAP_MASTER (
  map_id  INTEGER PRIMARY KEY,
  name    TEXT    NOT NULL,
  bg_key  TEXT    NOT NULL,
  is_town INTEGER NOT NULL DEFAULT 0  -- 0: 필드, 1: 마을
);

-- ── 맵 포탈 ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS MAP_PORTALS (
  portal_id   INTEGER PRIMARY KEY AUTOINCREMENT,
  from_map_id INTEGER NOT NULL REFERENCES MAP_MASTER(map_id),
  to_map_id   INTEGER NOT NULL REFERENCES MAP_MASTER(map_id),
  pos_x       INTEGER NOT NULL,  -- 이 맵에서 포탈이 위치하는 좌표
  pos_y       INTEGER NOT NULL,
  target_x    INTEGER NOT NULL,  -- 목적지 맵에서 플레이어가 등장하는 좌표
  target_y    INTEGER NOT NULL
);
