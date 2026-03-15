// ── 경험치 테이블 (Lv 1~20) ──────────────────────────────────────────────────
export const EXP_TABLE: { [key: number]: number } = {
  1: 15,   2: 34,   3: 57,   4: 92,   5: 135,
  6: 372,  7: 560,  8: 840,  9: 1242, 10: 1490,
  11: 1784, 12: 2132, 13: 2544, 14: 3030, 15: 3602,
  16: 4272, 17: 5055, 18: 5966, 19: 7025, 20: 8252,
};

// ── 타입 re-export (하위 호환) ────────────────────────────────────────────────
export type { IItem    as ItemData   } from '../types/IItem';
export type { IMonster as MonsterData } from '../types/IMonster';
export type { IDropEntry as DropEntry } from '../types/IMonster';
