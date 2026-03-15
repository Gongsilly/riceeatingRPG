-- ── 아이템 시드 데이터 ────────────────────────────────────────────────────────
INSERT OR REPLACE INTO items (id, name, description, body_color, gem_color) VALUES
  ('snail_shell', '달팽이 껍질', '초록 달팽이의 껍질',  9139029, 8978312),
  ('apple',       '사과',       '싱싱한 빨간 사과',    14492194, 16737894),
  ('blue_shell',  '파란 껍질',  '파란 달팽이의 껍질',  2250188, 6728447),
  ('red_potion',  '빨간 포션',  'HP를 회복하는 포션',  13373713, 16729156),
  ('spore_drop',  '포자',       '스포아의 포자',       7816328, 13395660),
  ('orange',      '오렌지',     '새콤달콤한 오렌지',   14509568, 16755251);

-- ── 몬스터 시드 데이터 ────────────────────────────────────────────────────────
INSERT OR REPLACE INTO monsters (id, name, hp, exp, damage, body_color, shell_color) VALUES
  ('green_snail', '달팽이',      8,  3, 3, 4508740, 2263074),
  ('blue_snail',  '파란 달팽이', 15, 5, 5, 4491519, 2250188),
  ('spore',       '스포아',      20, 6, 7, 11158732, 7807641);

-- ── 드롭 시드 데이터 ─────────────────────────────────────────────────────────
INSERT OR REPLACE INTO monster_drops (monster_id, item_id, chance) VALUES
  ('green_snail', 'snail_shell', 0.40),
  ('green_snail', 'apple',       0.10),
  ('blue_snail',  'blue_shell',  0.35),
  ('blue_snail',  'red_potion',  0.05),
  ('spore',       'spore_drop',  0.45),
  ('spore',       'orange',      0.10);
