export interface Account {
  id: string;
  name: string;
  type: 'cash' | 'bank' | 'credit';
  currency: 'HKD' | 'JPY';
  initBalance: number;
}

export interface Fund {
  id: string;
  name: string;
  initAmount: number;
  hasDaily?: boolean;
  dailyLimit?: number;
  unspentAction?: 'none' | 'carry' | 'cancel' | 'transfer';
  transferTargetId?: string;
  currency?: 'HKD' | 'JPY';
}

export interface TransactionItem {
  name: string;
  quantity: number;
  price: number;
}

export interface Transaction {
  id: string;
  type: 'expense' | 'income' | 'transfer' | 'sys_fund_cancel' | 'sys_fund_transfer_out' | 'sys_fund_transfer_in' | 'sys_fund_carry' | 'sys_alloc';
  amount: number;
  currency: 'HKD' | 'JPY';
  exRate: number;
  accDeduction: number;
  toAccDeduction?: number;
  accountId: string;
  toAccountId?: string;
  category?: string;
  icon?: string;
  note?: string;
  date: string;
  fundId?: string;
  toFundId?: string;
  _warnLimit?: boolean;
  _runningBal?: number;
  items?: TransactionItem[];
}

export interface Plan {
  id: string;
  type: 'buy' | 'save';
  name: string;
  amount: number;
  targetMonth: string;
}

export interface AIHistoryItem {
  date: string;
  text: string;
}

export interface AppData {
  isInit: boolean;
  settings: {
    baseCurrency: 'HKD' | 'JPY';
    apiKey: string;
    enableAIHistory: boolean;
    aiFrequency: string;
  };
  accounts: Account[];
  transactions: Transaction[];
  funds: Fund[];
  plans: Plan[];
  aiHistory: AIHistoryItem[];
  lastAITime: string | null;
  lastRolloverDate: string | null;
}