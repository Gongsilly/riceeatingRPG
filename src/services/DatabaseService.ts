/**
 * DatabaseService — API에서 받은 데이터를 메모리에 캐싱
 *
 * 데이터 흐름:
 *   Production : GET /api/monsters, /api/items  → Cloudflare Pages Function → D1
 *   Local dev  : GET /api/monsters, /api/items  → Vite mock middleware → JSON 파일
 *   Fallback   : API 실패 시 번들된 JSON 파일 직접 사용
 */
import type { IMonster } from '../types/IMonster';
import type { IItem }    from '../types/IItem';
import FALLBACK_MONSTERS from '../assets/data/monsters.json';
import FALLBACK_ITEMS    from '../assets/data/items.json';

class DatabaseService {
  private _monsters: Map<string, IMonster> = new Map(
    (FALLBACK_MONSTERS as IMonster[]).map(m => [m.id, m]),
  );
  private _items: Map<string, IItem> = new Map(
    (FALLBACK_ITEMS as IItem[]).map(i => [i.id, i]),
  );

  /** PreloadScene에서 API 응답을 받은 후 호출. 실패 시 fallback JSON 유지. */
  seedFromPreload(monsters: IMonster[] | null, items: IItem[] | null): void {
    if (Array.isArray(monsters) && monsters.length > 0) {
      this._monsters = new Map(monsters.map(m => [m.id, m]));
    }
    if (Array.isArray(items) && items.length > 0) {
      this._items = new Map(items.map(i => [i.id, i]));
    }
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
