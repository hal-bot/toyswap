// Types mirroring backend domain models

export interface Swapper {
  userId: string;
  firstName: string;
  lastName: string;
  username: string;
  zipCode?: string;
}

export type ItemType = 'toy' | 'book' | 'misc';
export type ItemCondition = 'new' | 'lite wear' | 'medium wear' | 'heavy wear';
export type AgeLevel = 'baby' | 'crawler' | 'toddler' | 'child' | 'kid';

export interface Item {
  id?: number;
  type: ItemType;
  name: string;
  condition: ItemCondition;
  requireBatteries: boolean;
  currentOwner?: Pick<Swapper, 'userId' | 'username'>;
  ageLevel: AgeLevel;
  active: boolean;
}

export interface SwapRequest {
  offerItemId: number;
  requestItemId: number;
}

export interface SwapResponse {
  offerItem: Item;
  requestItem: Item;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface CreateSwapperRequest {
  userId: string;
  username: string;
  firstName: string;
  lastName: string;
  password: string;
  zipCode?: string;
}
