export type CurrencyCode = 'HKD' | 'JPY';

export interface CurrencyInfo {
  symbol: string;
  rate: number;
  name: string;
}

export const currencies: Record<CurrencyCode, CurrencyInfo> = {
  HKD: { symbol: '$', rate: 1, name: 'HKD' },
  JPY: { symbol: '¥', rate: 0.05, name: 'JPY' }
};

export const categories = [
  { id: 'c1', name: '飲食', icon: '🍱' },
  { id: 't1', name: '交通', icon: '🚌' },
  { id: 's1', name: '購物', icon: '🛍️' },
  { id: 'e1', name: '娛樂', icon: '🎮' },
  { id: 'o1', name: '其他', icon: '📝' }
];

export const transactionTypes = {
  EXPENSE: 'expense',
  INCOME: 'income',
  TRANSFER: 'transfer'
};