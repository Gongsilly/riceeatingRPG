export interface IDropEntry {
  itemId: string;
  chance: number; // 0 ~ 1
}

export interface IMonster {
  id:         string;
  name:       string;
  hp:         number;
  exp:        number;
  damage:     number;
  bodyColor:  number;
  shellColor: number;
  drops:      IDropEntry[];
}
