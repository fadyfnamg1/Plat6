import { useState, useEffect } from 'react';
import { useStore } from '../../lib/store';
import { fmt } from '../../lib/markets';

function formatDate(ts: number) {
  return new Date(ts).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function formatDur(from: number, to: number) {
  const s = Math.round((to - from) / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.round(s / 60)}m`;
}

export default function HistoryOverlay() {
  const setOverlay     = useStore(s => s.setOverlay);
  const trades         = useStore(s => s.trades);
  const earlyCloseTrade = useStore(s => s.earlyCloseTrade);
  const adjustBalance  = useStore(s => s.adjustBalance);
  const showConfirm    = useStore(s => s.showConfirm);
  const showToast      = useStore(s => s.showToast);
  const [tab, setTab]  = useState<'open' | 'closed'>('open');
  const [, tick]       = useState(0);

  useEffect(() => {
    const iv = setInterval(() => tick(t => t + 1), 1000);
    return () => clearInterval(iv);
  }, []);

  const open   = trades.filter(t => !t.resolved).sort((a, b) => b.openedAt - a.openedAt);
  const closed = trades.filter(t => t.resolved).sort((a, b) => (b.resolvedAt || 0) - (a.resolvedAt || 0));
  const list   = tab === 'open' ? open : closed;

  const totalProfit = closed.filter(t => t.won).reduce((a, t) => a + (t.profit || 0), 0);
  const wins   = closed.filter(t => t.won).length;
  const losses = closed.filter(t => !t.won && !t.earlyClosed).length;
  const wr     = closed.length ? Math.round(wins / closed.length * 100) : 0;

  function earlyClose(t: typeof trades[0]) {
    const exit = t.entry * (1 + (Math.random() - 0.5) * 0.005);
    showConfirm('Early Close',
      `Close now and get back 50% ($${(t.amount / 2).toFixed(2)})?`,
      () => { earlyCloseTrade(t.id, exit); adjustBalance(t.amount / 2, t.walType); showToast(`Refunded $${(t.amount / 2).toFixed(2)}`); }
    );
  }

  return (
    <div className="overlay-bg" onClick={() => setOverlay('none')}>
      <div className="overlay-sheet" style={{ maxHeight: '90vh' }} onClick={e => e.stopPropagation()}>
        <div className="overlay-handle" />

        {/* Header */}
        <div className="overlay-header">
          <span className="overlay-title">Trade History</span>
          <button className="overlay-close" onClick={() => setOverlay('none')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {/* Summary strip */}
        <div style={{ padding: '0 16px 12px', display: 'flex', gap: 8 }}>
          <div style={{ flex: 1, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--r3)', padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 16 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--g0)' }}>{wins}</div>
                <div style={{ fontSize: 9, color: 'var(--t4)', fontWeight: 600, marginTop: 1 }}>WINS</div>
              </div>
              <div style={{ width: 1, background: 'var(--border)' }} />
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--red)' }}>{losses}</div>
                <div style={{ fontSize: 9, color: 'var(--t4)', fontWeight: 600, marginTop: 1 }}>LOSSES</div>
              </div>
              <div style={{ width: 1, background: 'var(--border)' }} />
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--t2)' }}>{wr}%</div>
                <div style={{ fontSize: 9, color: 'var(--t4)', fontWeight: 600, marginTop: 1 }}>WIN RATE</div>
              </div>
            </div>
            <div style={{ fontSize: 16, fontWeight: 800, color: totalProfit >= 0 ? 'var(--g0)' : 'var(--red)', fontFamily: 'JetBrains Mono' }}>
              {totalProfit >= 0 ? '+' : ''}${Math.abs(totalProfit).toFixed(2)}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ padding: '0 16px 8px' }}>
          <div className="hist-tabs">
            <button className={`hist-tab ${tab === 'open' ? 'active' : ''}`} onClick={() => setTab('open')}>
              Active {open.length > 0 && <span style={{ marginLeft: 4, background: 'var(--g0)', color: '#000', borderRadius: 10, padding: '0 6px', fontSize: 10, fontWeight: 800 }}>{open.length}</span>}
            </button>
            <button className={`hist-tab ${tab === 'closed' ? 'active' : ''}`} onClick={() => setTab('closed')}>
              Closed {closed.length > 0 && <span style={{ marginLeft: 4, background: 'var(--bg3)', color: 'var(--t3)', borderRadius: 10, padding: '0 6px', fontSize: 10, fontWeight: 700 }}>{closed.length}</span>}
            </button>
          </div>
        </div>

        {/* Trade list */}
        <div className="overlay-body">
          {list.length === 0 ? (
            <div className="hist-empty">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--t4)" strokeWidth="1.2">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
              </svg>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--t3)', marginTop: 8 }}>No {tab} trades</div>
              <div style={{ fontSize: 12, color: 'var(--t4)', marginTop: 4 }}>
                {tab === 'open' ? 'Open a trade to see it here' : 'Your closed trades will appear here'}
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {list.map(t => {
                const now = Date.now();
                const secsLeft = Math.max(0, Math.floor((t.expiryAt - now) / 1000));
                const mins = Math.floor(secsLeft / 60);
                const secs = secsLeft % 60;
                const isBuy = t.side === 'buy';
                const statusColor = !t.resolved ? '#3B82F6' : t.won ? 'var(--g0)' : 'var(--red)';
                const leftBorder = !t.resolved ? '#3B82F6' : t.won ? 'var(--g0)' : 'var(--red)';

                return (
                  <div key={t.id} style={{
                    background: 'var(--bg2)',
                    border: '1px solid var(--border)',
                    borderLeft: `3px solid ${leftBorder}`,
                    borderRadius: 'var(--r2)',
                    padding: '12px 14px',
                    animation: 'fadeUp .3s both',
                  }}>
                    {/* Row 1: side badge + market + status */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                      <div style={{
                        padding: '3px 8px', borderRadius: 6, fontSize: 10, fontWeight: 800, letterSpacing: .5,
                        background: isBuy ? 'rgba(0,214,143,.12)' : 'rgba(255,58,78,.12)',
                        color: isBuy ? 'var(--g0)' : 'var(--red)',
                        display: 'flex', alignItems: 'center', gap: 4,
                      }}>
                        {isBuy
                          ? <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="18 15 12 9 6 15"/></svg>
                          : <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="6 9 12 15 18 9"/></svg>
                        }
                        {t.side.toUpperCase()}
                      </div>
                      <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: 'var(--t1)' }}>{t.mktName}</span>
                      <div style={{
                        fontSize: 11, fontWeight: 800, color: statusColor,
                        fontFamily: !t.resolved ? 'JetBrains Mono' : 'inherit',
                      }}>
                        {!t.resolved
                          ? `${mins}:${secs.toString().padStart(2, '0')}`
                          : t.earlyClosed ? 'CLOSED' : t.won ? '✓ WON' : '✗ LOST'
                        }
                      </div>
                    </div>

                    {/* Row 2: metrics grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6, marginBottom: 10 }}>
                      {[
                        { lbl: 'Amount',  val: `$${t.amount.toFixed(2)}` },
                        { lbl: 'Entry',   val: fmt(t.entry, t.dec) },
                        { lbl: t.resolved ? 'Exit' : 'Payout', val: t.resolved ? fmt(t.exit || 0, t.dec) : `${t.payout}%` },
                        { lbl: t.resolved ? 'Duration' : 'Wallet', val: t.resolved ? formatDur(t.openedAt, t.resolvedAt || now) : t.walType.toUpperCase() },
                      ].map((f, i) => (
                        <div key={i} style={{ background: 'var(--bg1)', borderRadius: 6, padding: '6px 8px' }}>
                          <div style={{ fontSize: 9, color: 'var(--t4)', fontWeight: 600, marginBottom: 3 }}>{f.lbl}</div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--t2)', fontFamily: 'JetBrains Mono' }}>{f.val}</div>
                        </div>
                      ))}
                    </div>

                    {/* Row 3: date + P&L / close button */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ fontSize: 10, color: 'var(--t4)' }}>{formatDate(t.openedAt)}</div>
                      {t.resolved ? (
                        <div style={{
                          fontSize: 14, fontWeight: 800,
                          color: (t.profit || 0) >= 0 ? 'var(--g0)' : 'var(--red)',
                          fontFamily: 'JetBrains Mono',
                        }}>
                          {(t.profit || 0) >= 0 ? '+' : ''}${Math.abs(t.profit || 0).toFixed(2)}
                        </div>
                      ) : (
                        <button
                          onClick={() => earlyClose(t)}
                          style={{
                            padding: '5px 12px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                            background: 'rgba(255,58,78,.1)', border: '1px solid rgba(255,58,78,.25)',
                            color: 'var(--red)', cursor: 'pointer', fontFamily: 'inherit',
                          }}
                        >Close Early</button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
