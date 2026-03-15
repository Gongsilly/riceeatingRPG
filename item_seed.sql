-- ITEM_MASTER 시드 데이터
INSERT OR IGNORE INTO ITEM_MASTER
  (item_id, code, name, description, category, sub_type, req_lv, sell_price, max_stack, body_color, gem_color, base_atk, base_str, base_dex, base_int, base_luk, base_def, max_upgrade, hp_recover, mp_recover)
VALUES
  (1,  'snail_shell',    '달팽이 껍질',   '초록 달팽이의 껍질',                    'ETC',     'MATERIAL',  0, 5,   100, 9139029,  8978312,  0, 0, 0, 0, 0, 0, 0, 0,  0),
  (2,  'blue_shell',     '파란 껍질',     '파란 달팽이의 껍질',                    'ETC',     'MATERIAL',  0, 10,  100, 2250188,  6728447,  0, 0, 0, 0, 0, 0, 0, 0,  0),
  (3,  'spore_drop',     '포자',          '스포아의 포자',                         'ETC',     'MATERIAL',  0, 7,   100, 7816328,  13395660, 0, 0, 0, 0, 0, 0, 0, 0,  0),
  (4,  'red_potion',     '빨간 포션',     'HP를 회복하는 포션',                    'CONSUME', 'HP_POTION', 0, 20,  100, 13373713, 16729156, 0, 0, 0, 0, 0, 0, 0, 50, 0),
  (5,  'orange',         '오렌지',        '새콤달콤한 오렌지',                     'CONSUME', 'HP_POTION', 0, 15,  50,  14509568, 16755251, 0, 0, 0, 0, 0, 0, 0, 30, 0),
  (6,  'blue_potion',    '파란 포션',     'MP를 회복하는 포션',                    'CONSUME', 'MP_POTION', 0, 20,  100, 3364300,  6724095,  0, 0, 0, 0, 0, 0, 0, 0,  30),
  (7,  'apple',          '사과',          '싱싱한 빨간 사과',                      'CONSUME', 'HP_POTION', 0, 10,  50,  14492194, 16737894, 0, 0, 0, 0, 0, 0, 0, 20, 0),
  (8,  'old_sword',      '낡은 검',       '낡고 오래된 검이지만 여전히 날이 서있다.','EQUIP',  'WEAPON',    1, 100, 1,   11184810, 14540253, 10,0, 0, 0, 0, 0, 5, 0,  0),
  (9,  'wooden_staff',   '나무 지팡이',   '나무로 만든 지팡이. 마법사에게 어울린다.','EQUIP', 'WEAPON',    1, 80,  1,   9133628,  13934647, 7, 0, 0, 2, 0, 0, 5, 0,  0),
  (10, 'leather_armor',  '가죽 갑옷',     '가죽으로 만든 갑옷. 몸을 보호해준다.',  'EQUIP',  'ARMOR',     1, 80,  1,   9136404,  12290099, 0, 1, 0, 0, 0, 5, 5, 0,  0),
  (11, 'leather_gloves', '가죽 장갑',     '손을 보호하고 민첩함을 더한다.',        'EQUIP',  'ACCESSORY', 1, 60,  1,   6048306,  10057557, 0, 1, 2, 0, 0, 0, 3, 0,  0);

-- 장비 드롭 추가 (monster_drops)
INSERT OR IGNORE INTO monster_drops (monster_id, item_id, chance) VALUES
  ('green_snail', 'old_sword',      0.02),
  ('blue_snail',  'blue_potion',    0.05),
  ('blue_snail',  'leather_gloves', 0.03),
  ('spore',       'leather_armor',  0.03),
  ('spore',       'wooden_staff',   0.02);
