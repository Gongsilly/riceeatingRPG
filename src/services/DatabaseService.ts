/**
 * DatabaseService — API에서 받은 데이터를 메모리에 캐싱
 *
 * 데이터 흐름:
 *   Production : GET /api/monsters, /api/items  → Cloudflare Pages Function → D1
 *   Local dev  : GET /api/monsters, /api/items  → Vite mock middleware → JSON 파일
 *
 * 나중에 D1 쿼리를 Pages Function에서 직접 교체하면 됩니다.
 */
import type { IMonster } from '../types/IMonster';
import type { IItem }    from '../types/IItem';

class DatabaseService {
  private _monsters: Map<string, IMonster> = new Map();
  private _items:    Map<string, IItem>    = new Map();

  /** PreloadScene에서 API 응답을 받은 후 호출 */
  seedFromPreload(monsters: IMonster[], items: IItem[]): void {
    this._monsters = new Map(monsters.map(m => [m.id, m]));
    this._items    = new Map(items.map(i => [i.id, i]));
  }

  // ── Monsters ──────────────────────────────────────────────────────────────
  getMonster(id: string): IMonster | undefined {
    return this._monsters.get(id);
  }

  getAllMonsters(): IMonster[] {
    return [...this._monsters.values()];
  }

  // ── Items ─────────────────────────────────────────────────────────────────
  getItem(id: string): IItem | undefined {
    return this._items.get(id);
  }

  getAllItems(): IItem[] {
    return [...this._items.values()];
  }
}

export const db = new DatabaseService();
