// 匯出支出分類
export const EXPENSE_CATEGORIES = [
  { id: 'food', name: '飲食', icon: '🍜' },
  { id: 'daily', name: '日用', icon: '🧼' },
  { id: 'transport', name: '交通', icon: '🚗' },
  { id: 'social', name: '社交', icon: '🎉' },
  { id: 'housing', name: '住房物業', icon: '🏢' },
  { id: 'gift', name: '禮物', icon: '🎁' },
  { id: 'clothing', name: '服飾', icon: '👗' },
  { id: 'communication', name: '通信', icon: '📞' },
  { id: 'entertainment', name: '娛樂', icon: '🎬' },
  { id: 'beauty', name: '美容', icon: '💅' },
  { id: 'medical', name: '醫療', icon: '💊' },
  { id: 'tax', name: '稅金', icon: '🏛️' },
  { id: 'education', name: '教育', icon: '🎓' },
  { id: 'baby', name: '寶寶', icon: '🍼' },
  { id: 'pet', name: '寵物', icon: '🐱' },
  { id: 'travel', name: '旅行', icon: '🌴' },
  { id: 'household', name: '家用', icon: '🧹' },
  { id: 'savings_insurance', name: '儲蓄保險', icon: '🏦' },
  { id: 'credit_payment', name: '信用卡還款', icon: '💳' },
  { id: 'shopping_dining', name: '買野飲', icon: '🛍️' },
  { id: 'snacks', name: '零食', icon: '🍬' },
  { id: 'gaming', name: '遊戲', icon: '🕹️' },
  { id: 'other_expense', name: '其他', icon: '⭐' },
  { id: 'on9_stuff', name: 'on9野', icon: '🤪' },
  { id: 'debt_repayment', name: '欠債還款', icon: '📤' }
];

// 匯出收入分類
export const INCOME_CATEGORIES = [
  { id: 'bonus', name: '獎金', icon: '🏆' },
  { id: 'salary', name: '工資', icon: '💼' },
  { id: 'investment', name: '理財投資', icon: '📈' },
  { id: 'parttime', name: '兼職', icon: '🕒' },
  { id: 'debt_collection', name: '欠債收款', icon: '📥' },
  { id: 'transport_subsidy', name: '交通補貼', icon: '🚇' },
  { id: 'other_income', name: '其他', icon: '✨' },
  { id: 'credit_repayment', name: '信用卡還款', icon: '💳' },
  { id: 'interest', name: '利息', icon: '📊' },
  { id: 'insurance', name: '保險', icon: '🛡️' }
];

// 自動生成供 AI 使用的 ID 轉 中文 名稱對照表 (Map)
export const CATEGORY_MAP = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES].reduce((acc, cat) => {
  acc[cat.id] = cat.name;
  return acc;
}, {} as { [key: string]: string });