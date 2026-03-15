import { db }        from '../services/DatabaseService';
import type { IMap, IPortal } from '../types/IMap';

export const MapRepository = {
  getById(mapId: number): IMap {
    const map = db.getMap(mapId);
    if (!map) throw new Error(`[MapRepository] Unknown map_id: ${mapId}`);
    return map;
  },

  getAll(): IMap[] {
    return db.getAllMaps();
  },

  /** 특정 맵에서 출발하는 포탈 목록 */
  getPortals(fromMapId: number): IPortal[] {
    return db.getPortalsByMap(fromMapId);
  },
};
