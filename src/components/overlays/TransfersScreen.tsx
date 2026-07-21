import { useState, useEffect } from 'react';
import { useStore } from '../../lib/store';
import { apiFetch } from '../../lib/api';
import type { Transaction } from '../../types';
import { EGY_WALLETS, CRYPTO_METHODS, isEgypt } from '../../lib/paymentMethods';
import { flagEmoji, COUNTRIES } from '../../lib/countries';
import CountryPicker from '../CountryPicker';

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function statusColor(s: string) {
  if (s === 'completed') return 'var(--g0)';
  if (s === 'processing') return '#F59E0B';
  if (s === 'rejected')  return 'var(--red)';
  return '#60A5FA';
}
function statusLabel(s: string) {
  if (s === 'completed')  return 'Completed';
  if (s === 'processing') return 'Processing';
  if (s === 'rejected')   return 'Rejected';
  return 'Pending';
}

export default function TransfersScreen() {
  const setOverlay         = useStore(s => s.setOverlay);
  const showToast          = useStore(s => s.showToast);
  const realBalance        = useStore(s => s.realBalance);
  const setRealBalance     = useStore(s => s.setRealBalance);
  const bonusBalance       = useStore(s => s.bonusBalance);
  const transactions       = useStore(s => s.transactions);
  const addTransaction     = useStore(s => s.addTransaction);
  const transfersTab       = useStore(s => s.transfersTab);
  const [tab, setTab]      = useState<'history' | 'withdraw'>(transfersTab);
  const userCountry        = useStore(s => s.userCountry);
  const setUserCountry     = useStore(s => s.setUserCountry);
  const [withdrawSub, setWithdrawSub] = useState<'country' | 'form'>(userCountry ? 'form' : 'country');
  const [method, setMethod]= useState('');
  const [amount, setAmount]= useState('');
  const [account, setAccount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [filterType, setFilterType] = useState<'all'|'deposit'|'withdrawal'>('all');

  useEffect(() => {
    apiFetch('/api/wallet/transactions')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          data.forEach((t: any) => {
            addTransaction({
              id: t.id || t._id,
              type: t.type === 'withdraw' ? 'withdrawal' : t.type,
              desc: t.description || t.desc || `${t.type} ${t.method || ''}`.trim(),
              amount: t.amount,
              status: t.status,
              date: t.createdAt ? new Date(t.createdAt).getTime() : Date.now(),
              method: t.method,
              currency: t.currency || 'USD',
            });
          });
        }
      })
      .catch(() => {});
  }, []);

  // Withdrawal methods mirror the deposit methods exactly: Egyptian e-wallets
  // only for Egypt, plus the full crypto list for every country. No Bank Wire.
  const countryCode = COUNTRIES.find(c => c.name === userCountry)?.code;
  const withdrawMethods = [
    ...(isEgypt(userCountry) ? EGY_WALLETS.map(w => ({ id: w.id, label: w.name, color: w.color, icon: 'phone' as const })) : []),
    ...CRYPTO_METHODS.map(c => ({ id: c.id, label: c.name, color: c.color, icon: 'coin' as const })),
  ];
  const selectedMethod = withdrawMethods.find(m => m.id === method) || withdrawMethods[0];

  function selectCountry(c: string) {
    setUserCountry(c);
    setMethod('');
    setWithdrawSub('form');
  }

  const filtered = transactions.filter(tx => filterType === 'all' ? true : tx.type === filterType);

  async function submitWithdraw() {
    const v = parseFloat(amount);
    const withdrawable = Math.max(0, realBalance - bonusBalance);
    if (!method) { showToast('Please select a withdrawal method'); return; }
    if (!amount || isNaN(v) || v < 20) { showToast('Minimum withdrawal is $20'); return; }
    if (v > withdrawable) {
      if (bonusBalance > 0) showToast(`Max withdrawable: ${withdrawable.toFixed(2)} (bonus deducted: ${bonusBalance.toFixed(2)})`);
      else showToast('Insufficient real balance');
      return;
    }
    if (!account.trim())               { showToast('Enter your account / wallet address'); return; }
    setSubmitting(true);
    try {
      const res = await apiFetch('/api/wallet/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: v, method, account: account.trim(), country: userCountry }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { showToast(data.message || 'Withdrawal failed'); return; }

      const cryptoMatch = CRYPTO_METHODS.find(c => c.id === method);
      const tx: Transaction = {
        id:     data.id || data.transactionId || `wd_${Date.now()}_${Math.random().toString(36).slice(2,6)}`,
        type:   'withdrawal',
        desc:   `${withdrawMethods.find(m => m.id === method)?.label || method} Withdrawal`,
        amount: -v,
        status: 'pending',
        date:   Date.now(),
        method,
        currency: cryptoMatch?.symbol || 'USD',
      };
      addTransaction(tx);
      setRealBalance(Math.max(0, realBalance - v));
      showToast('Withdrawal request submitted! Processing in 1–3 business days.');
      setAmount(''); setAccount(''); setMethod('');
      setTab('history');
    } catch {
      showToast('Connection error — please try again');
    } finally {
      setSubmitting(false);
    }
  }

  const totalDeposited  = transactions.filter(t => t.type === 'deposit'    && t.status === 'completed').reduce((a, t) => a + Math.abs(t.amount), 0);
  const totalWithdrawn  = transactions.filter(t => t.type === 'withdrawal' && t.status === 'completed').reduce((a, t) => a + Math.abs(t.amount), 0);
  const pendingCount    = transactions.filter(t => t.status === 'pending' || t.status === 'processing').length;

  return (
    <div className="fullscreen">
      <div className="fs-header">
        <button className="fs-back" onClick={() => setOverlay('panel')}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <span className="fs-title">Transfers</span>
      </div>

      <div className="fs-body">
        {/* Quick action cards */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:14 }}>
          <div style={{ background:'rgba(0,230,118,.06)', border:'1px solid rgba(0,230,118,.2)', borderRadius:'var(--r2)', padding:14, cursor:'pointer' }} onClick={() => setOverlay('deposit')}>
            <div style={{ fontSize:11, color:'var(--t4)', fontWeight:700, textTransform:'uppercase', letterSpacing:'.4px' }}>Deposit</div>
            <div style={{ fontSize:17, fontWeight:800, color:'var(--g0)', marginTop:4, fontFamily:'JetBrains Mono' }}>+ Add Funds</div>
          </div>
          <div style={{ background:'rgba(59,130,246,.06)', border:'1px solid rgba(59,130,246,.2)', borderRadius:'var(--r2)', padding:14, cursor:'pointer' }} onClick={() => setTab('withdraw')}>
            <div style={{ fontSize:11, color:'var(--t4)', fontWeight:700, textTransform:'uppercase', letterSpacing:'.4px' }}>Withdraw</div>
            <div style={{ fontSize:17, fontWeight:800, color:'#3B82F6', marginTop:4, fontFamily:'JetBrains Mono' }}>${realBalance.toFixed(2)}</div>
          </div>
        </div>

        {/* Stats row */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:14 }}>
          {[
            { label:'Deposited', val:`$${totalDeposited.toFixed(0)}`, color:'var(--g0)' },
            { label:'Withdrawn', val:`$${totalWithdrawn.toFixed(0)}`, color:'var(--red)' },
            { label:'Pending',   val:String(pendingCount),           color:'#F59E0B' },
          ].map(s => (
            <div key={s.label} style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:'var(--r2)', padding:'10px 12px', textAlign:'center' }}>
              <div style={{ fontSize:15, fontWeight:800, color:s.color, fontFamily:'JetBrains Mono' }}>{s.val}</div>
              <div style={{ fontSize:10, color:'var(--t4)', fontWeight:700, marginTop:2, textTransform:'uppercase', letterSpacing:'.3px' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="profile-tabs">
          {(['history','withdraw'] as const).map(t => (
            <button key={t} className={`profile-tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)} style={{ fontFamily:'inherit' }}>
              {t === 'history' ? 'Transaction History' : 'Withdraw Funds'}
            </button>
          ))}
        </div>

        {/* ── HISTORY TAB ── */}
        {tab === 'history' && (
          <>
            <div style={{ display:'flex', gap:6, marginBottom:10 }}>
              {(['all','deposit','withdrawal'] as const).map(f => (
                <button key={f} onClick={() => setFilterType(f)}
                  style={{ fontSize:11, padding:'4px 10px', borderRadius:20, border:'1px solid', cursor:'pointer', fontFamily:'inherit', fontWeight:600,
                    borderColor: filterType===f ? 'var(--g0)' : 'var(--border)',
                    background:  filterType===f ? 'rgba(0,230,118,.08)' : 'transparent',
                    color:       filterType===f ? 'var(--g0)' : 'var(--t4)',
                  }}>
                  {f === 'all' ? 'All' : f === 'deposit' ? 'Deposits' : 'Withdrawals'}
                </button>
              ))}
            </div>

            {filtered.length === 0 ? (
              <div style={{ textAlign:'center', padding:'40px 0', color:'var(--t4)' }}>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ margin:'0 auto 12px', opacity:.4 }}><path d="M9 17H7A5 5 0 017 7h10a5 5 0 010 10h-2"/><path d="M12 12v5m0 0l-2-2m2 2l2-2"/></svg>
                <div style={{ fontSize:14 }}>No transactions yet</div>
                <div style={{ fontSize:12, marginTop:4 }}>Your deposit &amp; withdrawal history will appear here</div>
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {filtered.map(tx => (
                  <TxCard key={tx.id} tx={tx} />
                ))}
              </div>
            )}
          </>
        )}

        {/* ── WITHDRAW TAB ── */}
        {tab === 'withdraw' && withdrawSub === 'country' && (
          <CountryPicker current={userCountry} onSelect={selectCountry} />
        )}

        {tab === 'withdraw' && withdrawSub === 'form' && (
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <div className="balance-hero">
              <div className="balance-hero-label">Withdrawable Balance</div>
              <div className="balance-hero-val">${Math.max(0, realBalance - bonusBalance).toFixed(2)}</div>
              <div className="balance-hero-sub">
                Real balance ${realBalance.toFixed(2)}
                {bonusBalance > 0 ? ` · Bonus held $${bonusBalance.toFixed(2)}` : ''} · 1–3 business days
              </div>
            </div>

            {/* Country pill + change link */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <span style={{ fontSize:18 }}>{countryCode ? flagEmoji(countryCode) : '🌍'}</span>
                <span style={{ fontSize:13, fontWeight:700, color:'var(--t1)' }}>{userCountry}</span>
              </div>
              <button onClick={() => setWithdrawSub('country')} style={{ background:'none', border:'none', color:'var(--g0)', fontSize:12.5, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
                Change
              </button>
            </div>

            {bonusBalance > 0 && (
              <div style={{ background:'rgba(255,61,87,.06)', border:'1px solid rgba(255,61,87,.2)', borderRadius:'var(--r2)', padding:12, fontSize:12, color:'var(--red)' }}>
                <strong>⚠ Bonus Obligation:</strong> ${bonusBalance.toFixed(2)} will be deducted from any withdrawal (non-withdrawable bonus).
              </div>
            )}

            <div className="auth-field">
              <label>Withdrawal Method</label>
              <div className="withdraw-method-grid">
                {withdrawMethods.map(m => (
                  <button
                    key={m.id}
                    type="button"
                    className={`withdraw-method-card${method === m.id ? ' active' : ''}`}
                    onClick={() => setMethod(m.id)}
                  >
                    <div className="withdraw-method-ico" style={{ background: `${m.color}20`, color: m.color }}>
                      {m.icon === 'coin'
                        ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v10M9 9.5c0-1.2 1.3-2 3-2s3 .9 3 2-1.3 1.5-3 2-3 .8-3 2 1.3 2 3 2 3-.8 3-2"/></svg>
                        : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>
                      }
                    </div>
                    <span className="withdraw-method-label">{m.label}</span>
                  </button>
                ))}
              </div>
              {withdrawMethods.length === 0 && (
                <div style={{ fontSize:12, color:'var(--t4)', padding:'8px 2px' }}>No methods available — please pick a country first.</div>
              )}
            </div>

            <div className="auth-field">
              <label>Amount (USD)</label>
              <input className="dep-input" type="number" min={20} placeholder="Minimum $20" value={amount} onChange={e => setAmount(e.target.value)} />
              <div className="quick-amount-row">
                {[25, 50, 100, Math.max(20, Math.floor(Math.max(0, realBalance - bonusBalance)))].map((v, i) => (
                  <button
                    key={i}
                    type="button"
                    className={`quick-amount-chip${amount === String(v) ? ' active' : ''}`}
                    onClick={() => setAmount(String(v))}
                  >
                    {i === 3 ? 'Max' : v.toLocaleString()}
                  </button>
                ))}
              </div>
            </div>

            {selectedMethod && (
              <div className="auth-field">
                <label>
                  {isEgypt(userCountry) && EGY_WALLETS.some(w => w.id === method)
                    ? (method === 'instapay' ? 'InstaPay ID' : `${selectedMethod.label} Number`)
                    : `${selectedMethod.label} Address`}
                </label>
                <input className="auth-input"
                  placeholder="Enter wallet / account address"
                  value={account} onChange={e => setAccount(e.target.value)} />
              </div>
            )}

            <div style={{ background:'rgba(255,61,87,.04)', border:'1px solid rgba(255,61,87,.12)', borderRadius:'var(--r2)', padding:'10px 12px', fontSize:12, color:'var(--t3)', lineHeight:1.6 }}>
              <strong style={{ color:'var(--t2)' }}>Important:</strong> Withdrawals are processed within 1–3 business days. Minimum withdrawal is $20. Your real balance must cover the requested amount.
            </div>

            <button className={`auth-btn ${submitting ? 'loading' : ''}`} onClick={submitWithdraw} disabled={submitting}>
              {submitting ? '' : 'Submit Withdrawal Request'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function TxCard({ tx }: { tx: Transaction }) {
  const isIn = tx.amount > 0;
  const typeColor = isIn ? 'var(--g0)' : 'var(--red)';
  const typeBg    = isIn ? 'rgba(0,230,118,.08)' : 'rgba(255,61,87,.08)';

  return (
    <div className="transfer-card" style={{ flexDirection:'column', gap:0, padding:'14px 14px 10px' }}>
      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
        <div style={{ width:40, height:40, borderRadius:12, display:'flex', alignItems:'center', justifyContent:'center', background: typeBg, flexShrink:0 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={typeColor} strokeWidth="2">
            {isIn
              ? <><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></>
              : <><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></>
            }
          </svg>
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:14, fontWeight:700, color:'var(--t1)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{tx.desc}</div>
          <div style={{ fontSize:11, color:'var(--t4)', marginTop:2 }}>{formatDate(tx.date)}</div>
        </div>
        <div style={{ textAlign:'right', flexShrink:0 }}>
          <div style={{ fontSize:15, fontWeight:800, color: typeColor, fontFamily:'JetBrains Mono' }}>
            {isIn ? '+' : ''}{Math.abs(tx.amount).toLocaleString('en-US', { minimumFractionDigits:2, maximumFractionDigits:2 })}
            <span style={{ fontSize:10, fontWeight:400, marginLeft:3 }}>{tx.currency || 'USD'}</span>
          </div>
        </div>
      </div>
      <div style={{ marginTop:8, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          {tx.method && <span style={{ fontSize:10, color:'var(--t4)', background:'var(--bg2)', padding:'2px 7px', borderRadius:4, fontWeight:600 }}>{tx.method}</span>}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:5 }}>
          {(tx.status === 'pending' || tx.status === 'processing') && (
            <div className="spinner" style={{ width:10, height:10, borderWidth:1.5, borderColor:'rgba(245,158,11,.2)', borderTopColor:'#F59E0B' }} />
          )}
          <span style={{ fontSize:11, fontWeight:700, color: statusColor(tx.status) }}>{statusLabel(tx.status)}</span>
        </div>
      </div>
    </div>
  );
}
