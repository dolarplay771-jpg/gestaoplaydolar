export type TransactionType = 'WIN' | 'LOSS' | 'RESET' | 'DEPOSIT';

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  balanceAfter: number;
  timestamp: number;
  mode: string;
  note?: string;
}

export interface BankrollState {
  currentBalance: number;
  initialBalance: number;
  transactions: Transaction[];
  theme: 'light' | 'dark';
  riskPercentage: number;
  subscriptionExpiry: number | null; // Timestamp da expiração
  isAdmin: boolean; // Status de administrador
}

export interface BankrollContextType extends BankrollState {
  setInitialBalance: (amount: number) => void;
  addTransaction: (type: TransactionType, amount: number, mode: string, note?: string) => void;
  resetBankroll: () => void;
  toggleTheme: () => void;
  setRiskPercentage: (risk: number) => void;
  renewSubscription: () => Promise<void>; // Função para renovar
  isSubscribed: boolean; // Status calculado
  usdToBrlRate: number;
  usdToBrlUpdatedAt: number | null;
  convertUsdToBrl: (usd: number) => number;
}

export enum AppView {
  DASHBOARD = 'DASHBOARD',
  MODE_WHITE = 'MODE_WHITE',
  MODE_DOLLAR = 'MODE_DOLLAR',
  MODE_CANDLE = 'MODE_CANDLE',
  MODE_COLOR = 'MODE_COLOR',
  MODE_PLANILHA = 'MODE_PLANILHA',
  SETTINGS = 'SETTINGS',
  ADMIN = 'ADMIN'
}
