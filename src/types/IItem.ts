/** ITEM_MASTER 테이블 및 items.json fallback */
export interface IItemMaster {
  id:          string;    // = code (예: 'snail_shell')
  name:        string;
  description: string;
  category:    'EQUIP' | 'CONSUME' | 'ETC';
  subType:     string;
  reqLv:       number;
  sellPrice:   number;
  maxStack:    number;
  bodyColor:   number;
  gemColor:    number;
  // EQUIP 기본 스탯
  baseAtk:     number;
  baseStr:     number;
  baseDex:     number;
  baseInt:     number;
  baseLuk:     number;
  baseDef:     number;
  maxUpgrade:  number;
  // CONSUME 효과
  hpRecover:   number;
  mpRecover:   number;
}

/** EQUIP_INSTANCE 테이블 — 장비 고유 랜덤 옵션 */
export interface IEquipInstance {
  equipId:      number;
  invId:        number;
  strBonus:     number;
  dexBonus:     number;
  intBonus:     number;
  lukBonus:     number;
  atkBonus:     number;
  defBonus:     number;
  upgradeCount: number;
  upgradeSlots: number;
}

/** USER_INVENTORY + ITEM_MASTER + EQUIP_INSTANCE 조인 결과 */
export interface IInventoryItem {
  invId:    number;
  userId:   string;
  quantity: number;
  equipped: boolean;
  master:   IItemMaster;
  equip?:   IEquipInstance;
}

/** 하위 호환성 */
export type IItem = IItemMaster;
