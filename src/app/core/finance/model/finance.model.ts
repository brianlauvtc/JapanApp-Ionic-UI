export interface Account {
  id: string;
  name: string;
  type: 'cash' | 'bank' | 'credit' | 'loan' | 'transit';
  currency: 'HKD' | 'JPY';
  initBalance: number;
  // ===== 新增交通卡專屬功能欄位 =====
  allowNegative?: boolean;         // 是否允許負數
  negativeLimit?: number;          // 負數下限 (正數輸入，如 50 代表下限 -50)
  negativeMode?: 'once' | 'unlimited';    // 'once': 僅限一次, 'unlimited': 不限次數
  autoTopUp?: boolean;             // 是否開啟自動轉帳 (自動增值)
  topUpSourceAccountId?: string;   // 自動轉帳來源帳戶 ID
  topUpAmount?: number;            // 每次自動增值金額 (例如 250 或 500)
  topUpTrigger?: 'instant' | 'before_next'; // 觸發條件：當下轉帳 / 下次交易前轉帳
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
  customCategories?: { id: string, name: string, icon: string, type: 'expense' | 'income' }[];
}