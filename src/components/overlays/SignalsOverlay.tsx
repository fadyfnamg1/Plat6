import { useState, useEffect } from 'react';
import { useStore } from '../../lib/store';
import { useI18n } from '../../lib/i18n';

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

const REASON_KEYS = [
  'sig.reason1', 'sig.reason2', 'sig.reason3', 'sig.reason4',
  'sig.reason5', 'sig.reason6', 'sig.reason7', 'sig.reason8',
];

function genSignals(markets: any[], t: (k: string) => string): Signal[] {
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
      reason: t(REASON_KEYS[Math.floor(Math.random() * REASON_KEYS.length)]),
      generatedAt: Date.now(),
    };
  });
}

const REFRESH_SEC = 30;

export default function SignalsOverlay() {
  const { t } = useI18n();
  const setOverlay       = useStore(s => s.setOverlay);
  const markets          = useStore(s => s.markets);
  const setCurrentMarket = useStore(s => s.setCurrentMarket);
  const setExpiry        = useStore(s => s.setExpiry);
  const showToast        = useStore(s => s.showToast);

  const [signals, setSignals] = useState<Signal[]>([]);
  const [filter, setFilter]   = useState<'all' | 'buy' | 'sell'>('all');
  const [refreshIn, setRefreshIn] = useState(REFRESH_SEC);

  useEffect(() => {
    setSignals(genSignals(markets, t));
    const genIv = setInterval(() => { setSignals(genSignals(markets, t)); setRefreshIn(REFRESH_SEC); }, REFRESH_SEC * 1000);
    const tickIv = setInterval(() => setRefreshIn(s => Math.max(0, s - 1)), 1000);
    return () => { clearInterval(genIv); clearInterval(tickIv); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
    showToast(`${sig.dir === 'buy' ? '▲ ' + t('sig.tapUp') : '▼ ' + t('sig.tapDown')} on ${sig.base} · ${sig.expiryLabel} ${t('sig.expiryReady')}`);
  }

  function timeAgo(ts: number) {
    const secs = Math.floor((Date.now() - ts) / 1000);
    if (secs < 5) return t('sig.justNow');
    if (secs < 60) return `${secs}s ${t('sig.ago')}`;
    return `${Math.floor(secs / 60)}m ${t('sig.ago')}`;
  }

  return (
    <div className="overlay-bg" onClick={() => setOverlay('none')}>
      <div className="overlay-sheet" style={{ maxHeight: '88vh' }} onClick={e => e.stopPropagation()}>
        <div className="overlay-handle" />
        <div className="overlay-header">
          <span className="overlay-title">{t('sig.title')}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginRight: 8 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--g0)', display: 'inline-block', boxShadow: '0 0 6px var(--g0)', animation: 'pulseDot 2s infinite' }} />
            <span style={{ fontSize: 11, color: 'var(--g0)', fontWeight: 700 }}>{t('sig.live')}</span>
          </div>
          <button className="overlay-close" onClick={() => setOverlay('none')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div style={{ padding: '8px 16px 0' }}>
          <div style={{ fontSize: 11, color: 'var(--t4)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15.5 14"/></svg>
            {t('sig.durationNote')} · {t('sig.refreshingIn')} {refreshIn}s
          </div>
          <div className="signal-filter-row">
            {(['all','buy','sell'] as const).map(f => (
              <div key={f} className={`signal-filter ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
                {f === 'all' ? t('wd.all') : f === 'buy' ? t('sig.buy') : t('sig.sell')}
              </div>
            ))}
            <div style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--t4)', alignSelf: 'center' }}>
              {filtered.length} {t('sig.signalsCount')}
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
                <span className="signal-tf" title={t('sig.recommendedDuration')}>{sig.expiryLabel} {t('sig.expirySuffix')}</span>
                <span style={{ fontSize: 10, color: 'var(--t4)', marginLeft: 'auto' }}>{timeAgo(sig.generatedAt)}</span>
              </div>

              <div style={{ fontSize: 12, color: 'var(--t3)', marginBottom: 8, fontStyle: 'italic' }}>
                {sig.reason}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 10, color: 'var(--t4)', fontWeight: 600 }}>{t('sig.strength')} {sig.strength}%</span>
                <span style={{ fontSize: 10, color: 'var(--t4)' }}>{t('sig.accuracy')} {sig.accuracy}%</span>
              </div>
              <div className="signal-strength-bar">
                <div className={`signal-strength-fill ${sig.dir}`} style={{ width: `${sig.strength}%` }} />
              </div>

              <div className="signal-metrics">
                <div className="signal-metric">
                  <div className="signal-metric-label">{t('app.panel.winRate')}</div>
                  <div className="signal-metric-val" style={{ color: 'var(--g0)' }}>{Math.round((sig.win / sig.total) * 100)}%</div>
                </div>
                <div className="signal-metric">
                  <div className="signal-metric-label">{t('sig.winTotal')}</div>
                  <div className="signal-metric-val">{sig.win}/{sig.total}</div>
                </div>
                <div className="signal-metric">
                  <div className="signal-metric-label">{t('app.trade.expiry')}</div>
                  <div className="signal-metric-val">{sig.expiryLabel}</div>
                </div>
              </div>

              <button
                className={`signal-btn ${sig.dir === 'buy' ? 'buy' : 'sell'}`}
                style={{ width: '100%', marginTop: 10 }}
                onClick={e => { e.stopPropagation(); enterSignal(sig); }}
              >
                {t('sig.enterTrade')} — {sig.dir === 'buy' ? t('app.trade.buyUp') : t('app.trade.sellDown')} {sig.base} · {sig.expiryLabel}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
