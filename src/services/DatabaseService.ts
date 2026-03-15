/**
 * DatabaseService — JSON 파일을 메모리에 캐싱하는 Mock DB
 *
 * Cloudflare D1으로 교체 시:
 *   1. import를 제거하고 _fetchMonsters / _fetchItems를
 *      D1 쿼리 (await db.prepare('SELECT * FROM monsters').all()) 로 교체
 *   2. getMonster / getItem를 async 메서드로 변경
 *   3. Repository 메서드들도 async / await으로 변경
 */
import monstersJson from '../assets/data/monsters.json';
import itemsJson    from '../assets/data/items.json';
import type { IMonster } from '../types/IMonster';
import type { IItem }    from '../types/IItem';

class DatabaseService {
  private _monsters: Map<string, IMonster> | null = null;
  private _items:    Map<string, IItem>    | null = null;

  private _loadMonsters(): Map<string, IMonster> {
    if (!this._monsters) {
      this._monsters = new Map(
        (monstersJson as IMonster[]).map(m => [m.id, m]),
      );
    }
    return this._monsters;
  }

  private _loadItems(): Map<string, IItem> {
    if (!this._items) {
      this._items = new Map(
        (itemsJson as IItem[]).map(i => [i.id, i]),
      );
    }
    return this._items;
  }

  // ── Monsters ──────────────────────────────────────────────────────────────
  getMonster(id: string): IMonster | undefined {
    return this._loadMonsters().get(id);
  }

  getAllMonsters(): IMonster[] {
    return [...this._loadMonsters().values()];
  }

  // ── Items ─────────────────────────────────────────────────────────────────
  getItem(id: string): IItem | undefined {
    return this._loadItems().get(id);
  }

  getAllItems(): IItem[] {
    return [...this._loadItems().values()];
  }
}

// 싱글턴 인스턴스 — 앱 전체에서 공유
export const db = new DatabaseService();
