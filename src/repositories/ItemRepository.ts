import { db }       from '../services/DatabaseService';
import type { IItem } from '../types/IItem';

export const ItemRepository = {
  /**
   * ID로 아이템 데이터를 조회합니다.
   * 존재하지 않는 ID면 Error를 던집니다.
   */
  getById(id: string): IItem {
    const item = db.getItem(id);
    if (!item) throw new Error(`[ItemRepository] Unknown item id: "${id}"`);
    return item;
  },

  /** 전체 아이템 목록을 반환합니다. */
  getAll(): IItem[] {
    return db.getAllItems();
  },
};
