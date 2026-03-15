// ── 경험치 테이블 (Lv 1~20) ──────────────────────────────────────────────────
export const EXP_TABLE: { [key: number]: number } = {
  1: 15,   2: 34,   3: 57,   4: 92,   5: 135,
  6: 372,  7: 560,  8: 840,  9: 1242, 10: 1490,
  11: 1784, 12: 2132, 13: 2544, 14: 3030, 15: 3602,
  16: 4272, 17: 5055, 18: 5966, 19: 7025, 20: 8252,
};

// ── 아이템 데이터 ─────────────────────────────────────────────────────────────
export interface ItemData {
  id: string;
  name: string;
  description: string;
  bodyColor: number;
  gemColor: number;
}

export const ITEM_DATA: { [key: string]: ItemData } = {
  snail_shell: {
    id: 'snail_shell', name: '달팽이 껍질',
    description: '초록 달팽이의 껍질',
    bodyColor: 0x8B7355, gemColor: 0x88ff88,
  },
  apple: {
    id: 'apple', name: '사과',
    description: '싱싱한 빨간 사과',
    bodyColor: 0xdd2222, gemColor: 0xff6666,
  },
  blue_shell: {
    id: 'blue_shell', name: '파란 껍질',
    description: '파란 달팽이의 껍질',
    bodyColor: 0x2255cc, gemColor: 0x66aaff,
  },
  red_potion: {
    id: 'red_potion', name: '빨간 포션',
    description: 'HP를 회복하는 포션',
    bodyColor: 0xcc1111, gemColor: 0xff4444,
  },
  spore_drop: {
    id: 'spore_drop', name: '포자',
    description: '스포아의 포자',
    bodyColor: 0x774488, gemColor: 0xcc66cc,
  },
  orange: {
    id: 'orange', name: '오렌지',
    description: '새콤달콤한 오렌지',
    bodyColor: 0xdd6600, gemColor: 0xffaa33,
  },
};

// ── 드롭 테이블 ───────────────────────────────────────────────────────────────
export interface DropEntry {
  itemId: string;
  chance: number; // 0 ~ 1
}

// ── 몬스터 데이터 ─────────────────────────────────────────────────────────────
export interface MonsterData {
  id: string;
  name: string;
  hp: number;
  exp: number;
  damage: number;
  bodyColor: number;
  shellColor: number;
  drops: DropEntry[];
}

export const MONSTER_DATA: { [key: string]: MonsterData } = {
  green_snail: {
    id: 'green_snail', name: '달팽이',
    hp: 8, exp: 3, damage: 3,
    bodyColor: 0x44cc44, shellColor: 0x228822,
    drops: [
      { itemId: 'snail_shell', chance: 0.40 },
      { itemId: 'apple',       chance: 0.10 },
    ],
  },
  blue_snail: {
    id: 'blue_snail', name: '파란 달팽이',
    hp: 15, exp: 5, damage: 5,
    bodyColor: 0x4488ff, shellColor: 0x2255cc,
    drops: [
      { itemId: 'blue_shell', chance: 0.35 },
      { itemId: 'red_potion', chance: 0.05 },
    ],
  },
  spore: {
    id: 'spore', name: '스포아',
    hp: 20, exp: 6, damage: 7,
    bodyColor: 0xaa44cc, shellColor: 0x772299,
    drops: [
      { itemId: 'spore_drop', chance: 0.45 },
      { itemId: 'orange',     chance: 0.10 },
    ],
  },
};
