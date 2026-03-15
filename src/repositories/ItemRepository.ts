import { db }                from '../services/DatabaseService';
import { AuthState }        from '../services/AuthState.js';
import type { IItemMaster, IInventoryItem, IEquipInstance } from '../types/IItem';

export const ItemRepository = {
  getByCode(code: string): IItemMaster {
    const item = db.getItem(code);
    if (!item) throw new Error(`[ItemRepository] Unknown item code: "${code}"`);
    return item;
  },

  getAll(): IItemMaster[] {
    return db.getAllItems();
  },

  /** 몬스터 처치 시 아이템 줍기 → POST /api/inventory/add → DB INSERT */
  async addToInventory(itemCode: string): Promise<IInventoryItem> {
    const master = db.getItem(itemCode);
    if (!master) throw new Error(`[ItemRepository] Unknown item: ${itemCode}`);

    const res = await fetch('/api/inventory/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: AuthState.userId ?? 'local', item_code: itemCode }),
    });

    if (!res.ok) throw new Error(`[ItemRepository] /api/inventory/add failed: ${res.status}`);

    const data = await res.json() as { inv_id: number; master: IItemMaster; equip?: IEquipInstance | null };

    const invItem: IInventoryItem = {
      invId:    data.inv_id,
      userId:   String(AuthState.userId ?? 'local'),
      quantity: 1,
      equipped: false,
      master:   data.master ?? master,
      equip:    data.equip ?? undefined,
    };

    db.addInventoryItem(invItem);
    return invItem;
  },
};
