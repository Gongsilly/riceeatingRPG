export interface IMap {
  map_id:  number;
  name:    string;
  bg_key:  string;
  is_town: number; // 0: 필드, 1: 마을
}

export interface IPortal {
  portal_id:   number;
  from_map_id: number;
  to_map_id:   number;
  pos_x:       number;
  pos_y:       number;
  target_x:    number;
  target_y:    number;
}
