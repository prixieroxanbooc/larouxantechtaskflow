export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  created_at: string;
}

export interface Board {
  id: string;
  name: string;
  description?: string;
  owner_id: string;
  owner_name?: string;
  color: string;
  icon: string;
  created_at: string;
  updated_at: string;
}

export interface Group {
  id: string;
  board_id: string;
  name: string;
  color: string;
  position: number;
  created_at: string;
}

export interface Column {
  id: string;
  board_id: string;
  name: string;
  type: 'text' | 'status' | 'date' | 'person' | 'number' | 'checkbox' | 'url' | 'email' | 'phone';
  settings: string;
  position: number;
  created_at: string;
}

export interface Item {
  id: string;
  board_id: string;
  group_id: string;
  name: string;
  position: number;
  created_by: string;
  created_at: string;
  updated_at: string;
  values: Record<string, string>;
}

export interface BoardDetail extends Board {
  groups: Group[];
  columns: Column[];
  items: Item[];
}

export interface Comment {
  id: string;
  item_id: string;
  user_id: string;
  user_name: string;
  text: string;
  created_at: string;
}

export interface StatusOption {
  label: string;
  color: string;
}
