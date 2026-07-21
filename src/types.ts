// ── Screens ──────────────────────────────────────────────────────────────────
export type Screen = 'splash' | 'landing' | 'login' | 'register' | 'verify' | 'pin' | 'trading';

// ── Theme ─────────────────────────────────────────────────────────────────────
export type Theme = 'dark' | 'light';

// ── Overlays ──────────────────────────────────────────────────────────────────
export type ActiveOverlay =
  | 'none'
  | 'panel'
  | 'history'
  | 'signals'
  | 'indicators'
  | 'expiry'
  | 'events'
  | 'deposit'
  | 'profile'
  | 'transfers';

// ── Market ────────────────────────────────────────────────────────────────────
export interface Market {
  id: string;
  name: string;
  base: string;
  symbol: string;
  category: 'Crypto' | 'Forex' | 'Gold';
  price: number;
  change: number;
  high24: number;
  low24: number;
  volume24: number;
  volume: number;
  dec: number;
  payout: number;
}

// ── Trade ─────────────────────────────────────────────────────────────────────
export interface Trade {
  id: string;
  mktId: string;
  mktName: string;
  side: 'buy' | 'sell';
  amount: number;
  entry: number;
  exit?: number;
  payout: number;
  dec: number;
  expiryAt: number;
  openedAt: number;
  resolvedAt?: number;
  resolved: boolean;
  won?: boolean;
  profit?: number;
  walType: 'demo' | 'real';
  earlyClosed?: boolean;
}

// ── Transaction ───────────────────────────────────────────────────────────────
export interface Transaction {
  id: string;
  type: 'deposit' | 'withdrawal';
  desc: string;
  amount: number;
  status: 'pending' | 'processing' | 'completed' | 'rejected';
  date: number;
  method?: string;
  currency?: string;
}
