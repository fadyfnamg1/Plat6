import { useState, useEffect, useRef } from 'react';
import { useStore } from '../lib/store';
import { getFlagUrl, fmt } from '../lib/markets';
import { playClick, resumeAudio } from '../lib/sounds';
import type { Market } from '../types';

function AssetIcon({ market, size = 24 }: { market: Market; size?: number }) {
  const [err, setErr] = useState(false);
  if (err) {
    return (
      <div style={{
        width: size, height: size, borderRadius: '50%',
        background: `linear-gradient(135deg, #1e3a5f, #2a5a8f)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: size * 0.35, fontWeight: 700, color: '#fff',
        flexShrink: 0, border: '1px solid rgba(255,255,255,.1)',
      }}>
        {market.base.slice(0, 2)}
      </div>
    );
  }
  return (
    <img
      src={getFlagUrl(market.base)}
      width={size} height={size}
      style={{ borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
      onError={() => setErr(true)}
    />
  );
}

function MarketsModal({ onClose }: { onClose: () => void }) {
  const markets         = useStore(s => s.markets);
  const currentMarket   = useStore(s => s.currentMarket);
  const setCurrentMarket = useStore(s => s.setCurrentMarket);

  const [search, setSearch] = useState('');
  const [cat, setCat]       = useState('All');
  const cats = ['All', 'Crypto', 'Gold'];

  const filtered = markets.filter(m => {
    const matchCat    = cat === 'All' || m.category === cat;
    const matchSearch = !search
      || m.name.toLowerCase().includes(search.toLowerCase())
      || m.base.toLowerCase().includes(search.toLowerCase())
      || m.symbol.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  return (
    <div className="markets-modal">
      <div className="markets-header">
        <button className="markets-back" onClick={onClose}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <span className="markets-title">Markets</span>
        <span style={{ fontSize: 11, color: 'var(--t4)', marginLeft: 'auto', fontWeight: 600 }}>
          {filtered.length} pairs
        </span>
      </div>

      <div className="markets-search-wrap">
        <div className="markets-search-wrap-inner">
          <svg className="markets-search-ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            className="markets-search"
            placeholder="Search markets..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            autoFocus
          />
        </div>
      </div>

      <div className="markets-cats">
        {cats.map(c => (
          <div key={c} className={`markets-cat ${cat === c ? 'active' : ''}`} onClick={() => setCat(c)}>
            {c}
          </div>
        ))}
      </div>

      <div className="markets-list">
        {filtered.slice(0, 100).map(m => (
          <div
            key={m.id}
            className={`market-row ${currentMarket?.id === m.id ? 'active' : ''}`}
            onClick={() => { playClick(); setCurrentMarket(m); onClose(); }}
          >
            <AssetIcon market={m} size={38} />
            <div className="market-row-info">
              <div className="market-row-name">{m.base}</div>
              <div className="market-row-sub">{m.name} · {m.category}</div>
            </div>
            <div className="market-row-right">
              <div className="market-row-price">{fmt(m.price, m.dec)}</div>
              <div className={`market-row-change ${m.change >= 0 ? 'up' : 'down'}`}>
                {m.change >= 0 ? '+' : ''}{m.change.toFixed(2)}%
              </div>
            </div>
            <div className="market-row-payout">{m.payout}%</div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--t4)' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🔍</div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>No markets found</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>Try a different search term</div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AssetBar() {
  const markets          = useStore(s => s.markets);
  const currentMarket    = useStore(s => s.currentMarket);
  const setCurrentMarket = useStore(s => s.setCurrentMarket);
  const trades           = useStore(s => s.trades);
  const expMin           = useStore(s => s.expMin);
  const setLivePrice     = useStore(s => s.setLivePrice);
  const setOverlay       = useStore(s => s.setOverlay);
  const liveGlobalPrice  = useStore(s => s.livePrice);

  const [showMarkets, setShowMarkets] = useState(false);
  const [livePrice, setLivePriceLocal] = useState<number | null>(null);
  const [prevPrice, setPrevPrice]     = useState<number | null>(null);
  const wsRef   = useRef<WebSocket | null>(null);
  const countdown = useRef<NodeJS.Timeout | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [, forceTick] = useState(0);

  // All open trades
  const openTrades = trades.filter(t => !t.resolved);
  const activeTrade = openTrades.length > 0
    ? openTrades.reduce((a, b) => a.expiryAt < b.expiryAt ? a : b)
    : null;

  // Countdown for active trade
  useEffect(() => {
    if (activeTrade) {
      const update = () => {
        const left = Math.max(0, Math.floor((activeTrade.expiryAt - Date.now()) / 1000));
        setTimeLeft(left);
      };
      update();
      countdown.current = setInterval(update, 1000);
      return () => { if (countdown.current) clearInterval(countdown.current); };
    } else {
      setTimeLeft(expMin * 60);
    }
  }, [activeTrade?.id, expMin]);

  // Force re-render for live P&L
  useEffect(() => {
    if (!activeTrade) return;
    const iv = setInterval(() => forceTick(t => t + 1), 1000);
    return () => clearInterval(iv);
  }, [activeTrade?.id]);

  // WebSocket for live price
  useEffect(() => {
    if (!currentMarket) return;
    const symbol = currentMarket.symbol;
    let stopped = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let lastMsgAt = Date.now();

    function connect() {
      if (wsRef.current) { try { wsRef.current.close(); } catch {} wsRef.current = null; }
      const sym = symbol.toLowerCase();
      const ws = new WebSocket(`wss://stream.binance.com:9443/ws/${sym}@trade`);
      ws.onmessage = (e) => {
        lastMsgAt = Date.now();
        const d = JSON.parse(e.data);
        const p = parseFloat(d.p);
        setLivePriceLocal(prev => { setPrevPrice(prev); return p; });
        setLivePrice(p);
      };
      ws.onclose = () => { if (!stopped) reconnectTimer = setTimeout(connect, 1500); };
      ws.onerror = () => { try { ws.close(); } catch {} };
      wsRef.current = ws;
    }

    setLivePriceLocal(null);
    useStore.getState().setLivePrice(null);
    connect();

    const staleCheck = setInterval(() => {
      if (Date.now() - lastMsgAt > 8000) connect();
    }, 4000);

    return () => {
      stopped = true;
      clearInterval(staleCheck);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (wsRef.current) { try { wsRef.current.close(); } catch {} wsRef.current = null; }
    };
  }, [currentMarket?.symbol]);

  if (!currentMarket) return <div className="assetbar" />;

  const price    = livePrice ?? currentMarket.price;
  const priceDir = livePrice !== null && prevPrice !== null
    ? (livePrice > prevPrice ? 'up' : livePrice < prevPrice ? 'down' : '')
    : '';

  const total = expMin * 60;
  const perc  = activeTrade
    ? Math.max(0, Math.min(1, timeLeft / ((activeTrade.expiryAt - activeTrade.openedAt) / 1000)))
    : (total > 0 ? timeLeft / total : 0);

  // Live P&L for active trade
  const currentPrice = liveGlobalPrice ?? price;
  const livePnl = activeTrade
    ? activeTrade.side === 'buy'
      ? ((currentPrice - activeTrade.entry) / activeTrade.entry) * 100
      : ((activeTrade.entry - currentPrice) / activeTrade.entry) * 100
    : 0;
  const pnlPositive = livePnl >= 0;

  // Show 6 other markets in the quick-scroll bar
  const topMarkets = markets.filter(m => m.id !== currentMarket.id).slice(0, 6);

  return (
    <>
      <div className="assetbar-wrap">
        <div className="assetbar">
          {/* Current asset */}
          <div className="asset-pick-btn" onClick={() => { resumeAudio(); playClick(); setShowMarkets(true); }}>
            <AssetIcon market={currentMarket} size={24} />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span className="asset-pick-name">{currentMarket.base}/USDT</span>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--g0)" strokeWidth="2.5">
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className={`asset-pick-price ${priceDir}`}>
                  {fmt(price, currentMarket.dec)}
                </span>
                <span className={`asset-pick-change ${currentMarket.change >= 0 ? 'up' : 'down'}`}>
                  {currentMarket.change >= 0 ? '+' : ''}{currentMarket.change.toFixed(2)}%
                </span>
              </div>
            </div>
          </div>

          {/* Quick-access markets */}
          <div className="asset-mini-scroll">
            {topMarkets.map(m => (
              <div
                key={m.id}
                className={`asset-mini ${currentMarket.id === m.id ? 'active' : ''}`}
                onClick={() => { playClick(); setCurrentMarket(m); }}
              >
                <AssetIcon market={m} size={17} />
                <div>
                  <div className="asset-mini-name">{m.base}</div>
                  <div className="asset-mini-price">{fmt(m.price, m.dec)}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Countdown timer */}
          <div className="countdown-wrap">
            <div className="countdown-ring">
              <svg width="32" height="32" viewBox="0 0 32 32">
                <circle className="track" cx="16" cy="16" r="12" />
                <circle
                  className="fill"
                  cx="16" cy="16" r="12"
                  strokeDasharray={`${perc * 2 * Math.PI * 12} ${2 * Math.PI * 12}`}
                  stroke={activeTrade ? (pnlPositive ? 'var(--g0)' : 'var(--red)') : 'var(--g0)'}
                />
              </svg>
              <span className="countdown-num" style={{ color: activeTrade ? (pnlPositive ? 'var(--g0)' : 'var(--red)') : 'var(--g0)' }}>
                {timeLeft >= 3600
                  ? `${Math.ceil(timeLeft / 3600)}h`
                  : timeLeft >= 60
                  ? `${Math.ceil(timeLeft / 60)}m`
                  : `${timeLeft}s`}
              </span>
            </div>
          </div>
        </div>

        {/* ── Active trade interactive strip ────────────────────────────── */}
        {activeTrade && (
          <div
            className="trade-strip"
            onClick={() => setOverlay('history')}
            style={{ borderTop: `1px solid ${pnlPositive ? 'rgba(0,214,143,.15)' : 'rgba(255,58,78,.15)'}` }}
          >
            {/* Direction badge */}
            <div className={`trade-strip-badge ${activeTrade.side}`}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                {activeTrade.side === 'buy'
                  ? <polyline points="18 15 12 9 6 15"/>
                  : <polyline points="6 9 12 15 18 9"/>
                }
              </svg>
              {activeTrade.side === 'buy' ? 'BUY' : 'SELL'}
            </div>

            {/* Market */}
            <div style={{ fontSize:11, fontWeight:700, color:'var(--t2)', flex:1 }}>
              {activeTrade.mktName || currentMarket.base}
            </div>

            {/* Live P&L */}
            <div style={{ fontSize:12, fontWeight:800, fontFamily:'JetBrains Mono', color: pnlPositive ? 'var(--g0)' : 'var(--red)', marginRight:8 }}>
              {pnlPositive ? '+' : ''}{livePnl.toFixed(2)}%
            </div>

            {/* Pulse dot */}
            <div style={{ width:6, height:6, borderRadius:'50%', background: pnlPositive ? 'var(--g0)' : 'var(--red)', boxShadow:`0 0 6px ${pnlPositive ? 'var(--g0)' : 'var(--red)'}`, animation:'pulseDot 1.2s infinite', marginRight:6 }} />

            {/* Time */}
            <div style={{ fontSize:11, fontWeight:700, fontFamily:'JetBrains Mono', color:'var(--t3)', whiteSpace:'nowrap' }}>
              {Math.floor(timeLeft/60)}:{String(timeLeft%60).padStart(2,'0')}
            </div>

            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--t4)" strokeWidth="2" style={{ marginLeft:4, flexShrink:0 }}>
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </div>
        )}
      </div>

      {showMarkets && <MarketsModal onClose={() => setShowMarkets(false)} />}
    </>
  );
}
