// Types mirroring backend domain models

export interface Swapper {
  userId: string;
  firstName: string;
  lastName: string;
  birthday: string; // MM/dd/yyyy
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
  whenPurchased: string; // MM/dd/yyyy
  estimatedValue: number;
  currentOwner?: Pick<Swapper, 'userId' | 'username'>;
  ageLevel: AgeLevel;
}
