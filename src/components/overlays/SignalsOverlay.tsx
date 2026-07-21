import { useState, useEffect } from 'react';
import { useStore } from '../../lib/store';

type SignalDir = 'buy' | 'sell';

// Only durations a 1–5 minute binary trade can actually use.
const EXPIRIES = [
  { min: 1, label: '1m' },
  { min: 2, label: '2m' },
  { min: 3, label: '3m' },
  { min: 5, label: '5m' },
];

interface Signal {
  id: string;
  market: string;
  base: string;
  dir: SignalDir;
  expiryMin: number;
  expiryLabel: string;
  strength: number;
  accuracy: number;
  win: number;
  total: number;
  reason: string;
  generatedAt: number;
}

const REASONS = [
  'RSI oversold + support bounce',
  'MACD bullish crossover detected',
  'Bollinger band squeeze breakout',
  'EMA 20/50 golden cross',
  'Strong volume spike + trend',
  'Support/resistance flip',
  'Stochastic divergence signal',
  'VWAP reclaim with momentum',
];

function genSignals(markets: any[]): Signal[] {
  const top = markets.slice(0, 12);
  return top.map((m, i) => {
    const dir: SignalDir = Math.random() > 0.5 ? 'buy' : 'sell';
    const exp = EXPIRIES[Math.floor(Math.random() * EXPIRIES.length)];
    return {
      id: `sig_${i}_${Date.now()}`,
      market: m.name,
      base: m.base,
      dir,
      expiryMin: exp.min,
      expiryLabel: exp.label,
      strength: 60 + Math.floor(Math.random() * 35),
      accuracy: 65 + Math.floor(Math.random() * 25),
      win: Math.floor(Math.random() * 120) + 40,
      total: Math.floor(Math.random() * 60) + 90,
      reason: REASONS[Math.floor(Math.random() * REASONS.length)],
      generatedAt: Date.now(),
    };
  });
}

const REFRESH_SEC = 30;

export default function SignalsOverlay() {
  const setOverlay       = useStore(s => s.setOverlay);
  const markets          = useStore(s => s.markets);
  const setCurrentMarket = useStore(s => s.setCurrentMarket);
  const setExpiry        = useStore(s => s.setExpiry);
  const showToast        = useStore(s => s.showToast);

  const [signals, setSignals] = useState<Signal[]>([]);
  const [filter, setFilter]   = useState<'all' | 'buy' | 'sell'>('all');
  const [refreshIn, setRefreshIn] = useState(REFRESH_SEC);

  useEffect(() => {
    setSignals(genSignals(markets));
    const genIv = setInterval(() => { setSignals(genSignals(markets)); setRefreshIn(REFRESH_SEC); }, REFRESH_SEC * 1000);
    const tickIv = setInterval(() => setRefreshIn(s => Math.max(0, s - 1)), 1000);
    return () => { clearInterval(genIv); clearInterval(tickIv); };
  }, [markets]);

  const filtered = signals.filter(s => filter === 'all' || s.dir === filter);

  // Tapping a signal jumps straight to that pair's chart with the matching
  // trade duration pre-selected — no extra taps needed to line the trade up.
  function enterSignal(sig: Signal) {
    const market = markets.find(m => m.name === sig.market);
    if (!market) return;
    setCurrentMarket(market);
    setExpiry(sig.expiryMin, sig.expiryLabel);
    setOverlay('none');
    showToast(`${sig.dir === 'buy' ? '▲ Tap UP' : '▼ Tap DOWN'} on ${sig.base} · ${sig.expiryLabel} expiry ready`);
  }

  function timeAgo(ts: number) {
    const s = Math.floor((Date.now() - ts) / 1000);
    if (s < 5) return 'just now';
    if (s < 60) return `${s}s ago`;
    return `${Math.floor(s / 60)}m ago`;
  }

  return (
    <div className="overlay-bg" onClick={() => setOverlay('none')}>
      <div className="overlay-sheet" style={{ maxHeight: '88vh' }} onClick={e => e.stopPropagation()}>
        <div className="overlay-handle" />
        <div className="overlay-header">
          <span className="overlay-title">Trade Signals</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginRight: 8 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--g0)', display: 'inline-block', boxShadow: '0 0 6px var(--g0)', animation: 'pulseDot 2s infinite' }} />
            <span style={{ fontSize: 11, color: 'var(--g0)', fontWeight: 700 }}>LIVE</span>
          </div>
          <button className="overlay-close" onClick={() => setOverlay('none')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div style={{ padding: '8px 16px 0' }}>
          <div style={{ fontSize: 11, color: 'var(--t4)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15.5 14"/></svg>
            1–5 minute signals · refreshing in {refreshIn}s
          </div>
          <div className="signal-filter-row">
            {(['all','buy','sell'] as const).map(f => (
              <div key={f} className={`signal-filter ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </div>
            ))}
            <div style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--t4)', alignSelf: 'center' }}>
              {filtered.length} signals
            </div>
          </div>
        </div>

        <div className="overlay-body">
          {filtered.map(sig => (
            <div
              key={sig.id}
              className="signal-card"
              onClick={() => enterSignal(sig)}
              style={{ cursor: 'pointer' }}
            >
              <div className="signal-header">
                <span className={`signal-dir ${sig.dir}`}>
                  {sig.dir === 'buy' ? '▲ ' : '▼ '}{sig.dir.toUpperCase()}
                </span>
                <span className="signal-market">{sig.base}</span>
                <span className="signal-tf" title="Recommended trade duration">{sig.expiryLabel} expiry</span>
                <span style={{ fontSize: 10, color: 'var(--t4)', marginLeft: 'auto' }}>{timeAgo(sig.generatedAt)}</span>
              </div>

              <div style={{ fontSize: 12, color: 'var(--t3)', marginBottom: 8, fontStyle: 'italic' }}>
                {sig.reason}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 10, color: 'var(--t4)', fontWeight: 600 }}>Strength {sig.strength}%</span>
                <span style={{ fontSize: 10, color: 'var(--t4)' }}>Accuracy {sig.accuracy}%</span>
              </div>
              <div className="signal-strength-bar">
                <div className={`signal-strength-fill ${sig.dir}`} style={{ width: `${sig.strength}%` }} />
              </div>

              <div className="signal-metrics">
                <div className="signal-metric">
                  <div className="signal-metric-label">Win Rate</div>
                  <div className="signal-metric-val" style={{ color: 'var(--g0)' }}>{Math.round((sig.win / sig.total) * 100)}%</div>
                </div>
                <div className="signal-metric">
                  <div className="signal-metric-label">Win/Total</div>
                  <div className="signal-metric-val">{sig.win}/{sig.total}</div>
                </div>
                <div className="signal-metric">
                  <div className="signal-metric-label">Expiry</div>
                  <div className="signal-metric-val">{sig.expiryLabel}</div>
                </div>
              </div>

              <button
                className={`signal-btn ${sig.dir === 'buy' ? 'buy' : 'sell'}`}
                style={{ width: '100%', marginTop: 10 }}
                onClick={e => { e.stopPropagation(); enterSignal(sig); }}
              >
                Enter Trade — {sig.dir === 'buy' ? 'BUY' : 'SELL'} {sig.base} · {sig.expiryLabel}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
