import { useState, useEffect } from 'react';
import { useStore } from '../../lib/store';
import { apiFetch } from '../../lib/api';

interface ApiEvent {
  id: string;
  type: string;
  title: string;
  date: string;
  desc: string;
  prize: string;
  color: string;
  ico: string;
  promoCode?: string | null;
  terms?: string;
}

// Fallback events shown while API loads or if backend is offline
const FALLBACK_EVENTS: ApiEvent[] = [
  {
    id: 'oxier100',
    type: 'promo',
    title: '100% First Deposit Bonus',
    date: 'Always active',
    desc: 'Get a 100% bonus on your very first deposit. Enter code OXIER100 in the bonus code field when depositing. Bonus funds are non-withdrawable and will be automatically deducted upon any withdrawal request.',
    prize: '100% Bonus',
    color: '#00E676',
    ico: '🎁',
    promoCode: 'OXIER100',
    terms: 'Valid on first deposit only. Bonus is non-withdrawable.',
  },
  {
    id: 'refer',
    type: 'promo',
    title: 'Refer & Earn',
    date: 'Ongoing',
    desc: 'Share your unique referral code with friends and earn 10% commission on every trade they make. No cap on earnings.',
    prize: '10% Commission',
    color: '#10B981',
    ico: '💰',
    promoCode: null,
    terms: 'Commission credited automatically when referred users trade.',
  },
  {
    id: 'loyalty',
    type: 'promo',
    title: 'Weekly Loyalty Cashback',
    date: 'Every Monday',
    desc: 'Active traders receive weekly cashback on net losses from the previous week. The more you trade, the higher your cashback tier.',
    prize: 'Up to 15% Cashback',
    color: '#8B5CF6',
    ico: '⭐',
    promoCode: null,
    terms: 'Calculated every Monday. Applied automatically.',
  },
];

export default function EventsOverlay() {
  const setOverlay  = useStore(s => s.setOverlay);
  const showToast   = useStore(s => s.showToast);
  const userInfo    = useStore(s => s.userInfo);

  const [events, setEvents]         = useState<ApiEvent[]>(FALLBACK_EVENTS);
  const [coupon, setCoupon]          = useState('');
  const [validating, setValidating]  = useState(false);
  const [promoResult, setPromoResult]= useState<{ ok: boolean; msg: string } | null>(null);

  // Fetch events from backend (no auth required)
  useEffect(() => {
    apiFetch('/api/events')
      .then(r => r.json())
      .then(data => { if (Array.isArray(data.events) && data.events.length) setEvents(data.events); })
      .catch(() => { /* keep fallback */ });
  }, []);

  async function applyPromo() {
    const code = coupon.trim().toUpperCase();
    if (!code) return;

    if (!userInfo || !userInfo.token || userInfo.token === 'demo') {
      setPromoResult({ ok: false, msg: 'Please log in to apply a promo code.' });
      return;
    }

    setValidating(true);
    setPromoResult(null);
    try {
      const res = await apiFetch('/api/events/validate-promo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.valid) {
        setPromoResult({ ok: true, msg: `✓ ${data.description}` });
        showToast(`${code} validated — enter it when depositing!`);
      } else {
        setPromoResult({ ok: false, msg: data.error || 'Invalid promo code.' });
      }
    } catch {
      setPromoResult({ ok: false, msg: 'Connection error — try again.' });
    } finally {
      setValidating(false);
    }
  }

  function copyCode(code: string) {
    navigator.clipboard.writeText(code).catch(() => {});
    setCoupon(code);
    showToast(`Code ${code} copied — paste it when depositing!`);
  }

  return (
    <div className="overlay-bg" onClick={() => setOverlay('none')}>
      <div className="overlay-sheet" style={{ maxHeight: '88vh' }} onClick={e => e.stopPropagation()}>
        <div className="overlay-handle" />
        <div className="overlay-header">
          <span className="overlay-title">Events & Promotions</span>
          <button className="overlay-close" onClick={() => setOverlay('none')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="overlay-body">
          {/* Promo code validator */}
          <div className="event-coupon" style={{ flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                className="coupon-input"
                placeholder="Enter promo code..."
                value={coupon}
                onChange={e => { setCoupon(e.target.value); setPromoResult(null); }}
                onKeyDown={e => e.key === 'Enter' && applyPromo()}
                style={{ textTransform: 'uppercase' }}
              />
              <button className="coupon-btn" onClick={applyPromo} disabled={validating}>
                {validating ? '…' : 'Validate'}
              </button>
            </div>
            {promoResult && (
              <div style={{
                fontSize: 12, padding: '8px 12px', borderRadius: 'var(--r3)',
                background: promoResult.ok ? 'rgba(0,230,118,.08)' : 'rgba(255,61,87,.08)',
                border: `1px solid ${promoResult.ok ? 'rgba(0,230,118,.25)' : 'rgba(255,61,87,.25)'}`,
                color: promoResult.ok ? 'var(--g0)' : 'var(--red)',
                fontWeight: 600,
              }}>
                {promoResult.msg}
              </div>
            )}
            <div style={{ fontSize: 11, color: 'var(--t4)' }}>
              Validate first, then enter the code in the <strong style={{ color: 'var(--t3)' }}>Deposit</strong> screen.
            </div>
          </div>

          {/* Event cards */}
          {events.map(ev => (
            <div key={ev.id} className="event-card">
              <div className="event-header">
                <div className="event-ico" style={{ background: `${ev.color}14`, fontSize: 24 }}>{ev.ico}</div>
                <div>
                  <div className="event-title">{ev.title}</div>
                  <div className="event-date">{ev.date}</div>
                </div>
              </div>
              <div className="event-desc">{ev.desc}</div>

              {ev.terms && (
                <div style={{ fontSize: 11, color: 'var(--t4)', marginTop: 6, fontStyle: 'italic' }}>
                  {ev.terms}
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
                <span className="event-prize" style={{ color: ev.color }}>{ev.prize}</span>

                {ev.promoCode ? (
                  <button
                    onClick={() => copyCode(ev.promoCode!)}
                    style={{
                      padding: '8px 16px', borderRadius: 'var(--r3)',
                      background: `${ev.color}18`, border: `1px solid ${ev.color}44`,
                      color: ev.color, fontWeight: 800, fontSize: 12,
                      cursor: 'pointer', fontFamily: 'JetBrains Mono, monospace',
                      letterSpacing: 1, transition: 'all .15s',
                    }}
                  >
                    {ev.promoCode}
                  </button>
                ) : (
                  <button
                    onClick={() => { setOverlay('deposit'); }}
                    style={{
                      padding: '8px 14px', borderRadius: 'var(--r3)',
                      background: `${ev.color}18`, border: `1px solid ${ev.color}44`,
                      color: ev.color, fontWeight: 700, fontSize: 12,
                      cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s',
                    }}
                  >
                    Learn More
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
