import { db }          from '../services/DatabaseService';
import type { IMonster } from '../types/IMonster';

export const MonsterRepository = {
  /**
   * ID로 몬스터 데이터를 조회합니다.
   * 존재하지 않는 ID면 Error를 던집니다.
   */
  getById(id: string): IMonster {
    const monster = db.getMonster(id);
    if (!monster) throw new Error(`[MonsterRepository] Unknown monster id: "${id}"`);
    return monster;
  },

  /** 전체 몬스터 목록을 반환합니다. */
  getAll(): IMonster[] {
    return db.getAllMonsters();
  },
};
