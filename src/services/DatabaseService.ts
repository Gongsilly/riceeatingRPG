import type { IMonster }    from '../types/IMonster';
import type { IItemMaster, IInventoryItem } from '../types/IItem';
import type { IMap, IPortal } from '../types/IMap';

import FALLBACK_MONSTERS from '../assets/data/monsters.json';
import FALLBACK_ITEMS    from '../assets/data/items.json';
import FALLBACK_MAPS     from '../assets/data/maps.json';
import FALLBACK_PORTALS  from '../assets/data/portals.json';

class DatabaseService {
  private _monsters: Map<string, IMonster> = new Map(
    (FALLBACK_MONSTERS as IMonster[]).map(m => [m.id, m]),
  );
  private _items: Map<string, IItemMaster> = new Map(
    (FALLBACK_ITEMS as IItemMaster[]).map(i => [i.id, i]),
  );
  private _maps: Map<number, IMap> = new Map(
    (FALLBACK_MAPS as IMap[]).map(m => [m.map_id, m]),
  );
  private _portals: IPortal[] = FALLBACK_PORTALS as IPortal[];
  private _inventory: IInventoryItem[] = [];

  seedFromPreload(
    monsters: IMonster[] | null,
    items:    IItemMaster[] | null,
    maps:     IMap[]     | null,
    portals:  IPortal[]  | null,
  ): void {
    if (Array.isArray(monsters) && monsters.length > 0)
      this._monsters = new Map(monsters.map(m => [m.id, m]));
    if (Array.isArray(items) && items.length > 0)
      this._items = new Map(items.map(i => [i.id, i]));
    if (Array.isArray(maps) && maps.length > 0)
      this._maps = new Map(maps.map(m => [m.map_id, m]));
    if (Array.isArray(portals) && portals.length > 0)
      this._portals = portals;
  }

  // ── Monsters ──────────────────────────────────────────────────────────────
  getMonster(id: string): IMonster | undefined  { return this._monsters.get(id); }
  getAllMonsters(): IMonster[]                   { return [...this._monsters.values()]; }

  // ── Items ─────────────────────────────────────────────────────────────────
  getItem(id: string): IItemMaster | undefined  { return this._items.get(id); }
  getAllItems(): IItemMaster[]                   { return [...this._items.values()]; }

  // ── Maps ──────────────────────────────────────────────────────────────────
  getMap(mapId: number): IMap | undefined       { return this._maps.get(mapId); }
  getAllMaps(): IMap[]                           { return [...this._maps.values()]; }

  // ── Portals ───────────────────────────────────────────────────────────────
  getPortalsByMap(fromMapId: number): IPortal[] {
    return this._portals.filter(p => p.from_map_id === fromMapId);
  }

  // ── Inventory ─────────────────────────────────────────────────────────────
  addInventoryItem(item: IInventoryItem): void  { this._inventory.push(item); }
  getInventory(): IInventoryItem[]              { return [...this._inventory]; }
  setInventory(items: IInventoryItem[]): void   { this._inventory = items; }
}

export const db = new DatabaseService();
