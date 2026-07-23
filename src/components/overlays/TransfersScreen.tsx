import { useState, useEffect } from 'react';
import { useStore } from '../../lib/store';
import { apiFetch } from '../../lib/api';
import type { Transaction } from '../../types';
import { EGY_WALLETS, CRYPTO_METHODS, isEgypt } from '../../lib/paymentMethods';
import { flagEmoji, COUNTRIES } from '../../lib/countries';
import CountryPicker from '../CountryPicker';
import { useI18n } from '../../lib/i18n';

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function statusColor(s: string) {
  if (s === 'completed') return 'var(--g0)';
  if (s === 'processing') return '#F59E0B';
  if (s === 'rejected')  return 'var(--red)';
  return '#60A5FA';
}
function statusLabel(s: string, t: (k: string) => string) {
  if (s === 'completed')  return t('wd.completed');
  if (s === 'processing') return t('wd.processingStatus');
  if (s === 'rejected')   return t('wd.rejected');
  return t('wd.pendingStatus');
}

export default function TransfersScreen() {
  const { t } = useI18n();
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
          data.forEach((tx: any) => {
            addTransaction({
              id: tx.id || tx._id,
              type: tx.type === 'withdraw' ? 'withdrawal' : tx.type,
              desc: tx.description || tx.desc || `${tx.type} ${tx.method || ''}`.trim(),
              amount: tx.amount,
              status: tx.status,
              date: tx.createdAt ? new Date(tx.createdAt).getTime() : Date.now(),
              method: tx.method,
              currency: tx.currency || 'USD',
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

  const totalDeposited  = transactions.filter(tx => tx.type === 'deposit'    && tx.status === 'completed').reduce((a, tx) => a + Math.abs(tx.amount), 0);
  const totalWithdrawn  = transactions.filter(tx => tx.type === 'withdrawal' && tx.status === 'completed').reduce((a, tx) => a + Math.abs(tx.amount), 0);
  const pendingCount    = transactions.filter(tx => tx.status === 'pending' || tx.status === 'processing').length;
  const selectedColor   = selectedMethod?.color || '#00D68F';

  return (
    <div className="fullscreen dep-fullscreen">
      <div className="fs-header">
        <button className="fs-back" onClick={() => setOverlay('panel')}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <span className="fs-title">{t('wd.title')}</span>
        <button style={{ background:'none', border:'none', color:'var(--t4)', cursor:'pointer', padding:4 }} onClick={() => setOverlay('none')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      <div className="fs-body">
        {/* Quick action cards */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:14 }}>
          <div className="dep-glass" style={{ padding:15, cursor:'pointer', '--mc':'#00D68F', '--mc-glow':'rgba(0,214,143,.35)' } as React.CSSProperties}
            onClick={() => setOverlay('deposit')}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.borderColor = '#00D68F'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.borderColor = ''; }}
          >
            <div className="dep-eyebrow" style={{ marginBottom: 6 }}>{t('app.panel.deposit')}</div>
            <div className="dep-headline" style={{ fontSize:17, color:'var(--g0)', fontFamily:"'JetBrains Mono'" }}>{t('wd.addFunds')}</div>
          </div>
          <div className="dep-glass" style={{ padding:15, cursor:'pointer' }}
            onClick={() => setTab('withdraw')}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.borderColor = '#3B82F6'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.borderColor = ''; }}
          >
            <div className="dep-eyebrow" style={{ marginBottom: 6 }}>{t('wd.withdraw')}</div>
            <div className="dep-headline" style={{ fontSize:17, color:'#3B82F6', fontFamily:"'JetBrains Mono'" }}>${realBalance.toFixed(2)}</div>
          </div>
        </div>

        {/* Stats row */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:16 }}>
          {[
            { label:t('wd.deposited'), val:`$${totalDeposited.toFixed(0)}`, color:'var(--g0)' },
            { label:t('wd.withdrawn'), val:`$${totalWithdrawn.toFixed(0)}`, color:'var(--red)' },
            { label:t('wd.pending'),   val:String(pendingCount),           color:'#F59E0B' },
          ].map(s => (
            <div key={s.label} className="dep-glass" style={{ padding:'11px 8px', textAlign:'center' }}>
              <div className="dep-headline" style={{ fontSize:15, color:s.color, fontFamily:"'JetBrains Mono'" }}>{s.val}</div>
              <div style={{ fontSize:9.5, color:'var(--t4)', fontWeight:700, marginTop:3, textTransform:'uppercase', letterSpacing:'.4px' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="dep-glass" style={{ display:'flex', padding:4, gap:4, marginBottom:16, borderRadius:999 }}>
          {(['history','withdraw'] as const).map(tabId => (
            <button key={tabId} onClick={() => setTab(tabId)} style={{
              flex:1, padding:'10px 0', borderRadius:999, fontSize:13, fontWeight:700, fontFamily:"'Outfit','Inter',sans-serif",
              background: tab === tabId ? 'linear-gradient(135deg, var(--g0), #00A3E0)' : 'transparent',
              color: tab === tabId ? '#04120C' : 'var(--t3)',
              border:'none', cursor:'pointer', transition:'all .2s var(--ease)',
            }}>
              {tabId === 'history' ? t('wd.transactionHistory') : t('wd.withdrawFunds')}
            </button>
          ))}
        </div>

        {/* ── HISTORY TAB ── */}
        {tab === 'history' && (
          <>
            <div className="dep-chip-row" style={{ marginBottom:14, marginTop:0 }}>
              {(['all','deposit','withdrawal'] as const).map(f => (
                <button key={f} onClick={() => setFilterType(f)} className={`dep-chip${filterType === f ? ' active' : ''}`} style={{ flex:'0 1 auto', padding:'7px 16px' }}>
                  {f === 'all' ? t('wd.all') : f === 'deposit' ? t('wd.deposits') : t('wd.withdrawals')}
                </button>
              ))}
            </div>

            {filtered.length === 0 ? (
              <div className="dep-glass" style={{ textAlign:'center', padding:'40px 20px', color:'var(--t4)' }}>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ margin:'0 auto 14px', opacity:.4 }}><path d="M9 17H7A5 5 0 017 7h10a5 5 0 010 10h-2"/><path d="M12 12v5m0 0l-2-2m2 2l2-2"/></svg>
                <div className="dep-headline" style={{ fontSize:14, color:'var(--t3)' }}>{t('wd.noTransactions')}</div>
                <div style={{ fontSize:12, marginTop:4 }}>{t('wd.noTransactionsSub')}</div>
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:9 }}>
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
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
            {/* Withdrawable balance ticket */}
            <div className="dep-glass dep-ticket">
              <div className="dep-ticket-top" style={{ flexDirection:'column', alignItems:'flex-start', gap:4 }}>
                <div className="dep-ticket-label">{t('wd.withdrawableBalance')}</div>
                <div className="dep-ticket-amount" style={{ fontSize:32 }}>${Math.max(0, realBalance - bonusBalance).toFixed(2)}</div>
              </div>
              <div className="dep-ticket-notch-row" />
              <div className="dep-ticket-bottom" style={{ fontSize:11.5, color:'var(--t4)' }}>
                {t('wd.realBalanceLabel')} ${realBalance.toFixed(2)}
                {bonusBalance > 0 ? ` · ${t('wd.bonusHeld')} $${bonusBalance.toFixed(2)}` : ''} · {t('wd.businessDays')}
              </div>
            </div>

            {/* Country pill + change link */}
            <div className="dep-glass dep-country-pill" style={{ marginBottom:0 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <span className="flag">{countryCode ? flagEmoji(countryCode) : '🌍'}</span>
                <span className="name">{userCountry}</span>
              </div>
              <button className="change-btn" onClick={() => setWithdrawSub('country')}>
                {t('dep.change')}
              </button>
            </div>

            {bonusBalance > 0 && (
              <div className="dep-glass" style={{ padding:'12px 14px', fontSize:12, color:'var(--red)', borderColor:'rgba(255,61,87,.25)' }}>
                <strong>⚠ {t('wd.bonusObligation')}</strong> ${bonusBalance.toFixed(2)} {t('wd.bonusDeductNote')}
              </div>
            )}

            <div className="dep-field">
              <label>{t('wd.withdrawalMethod')}</label>
              <div className="dep-method-grid">
                {withdrawMethods.map(m => (
                  <button
                    key={m.id}
                    type="button"
                    className={`dep-glass dep-method-card${method === m.id ? ' selected' : ''}`}
                    style={{ '--mc': m.color, '--mc-glow': `${m.color}55` } as React.CSSProperties}
                    onClick={() => setMethod(m.id)}
                  >
                    <div className="dep-method-ico" style={{ background: m.color, width:36, height:36, borderRadius:11, fontSize:13 }}>
                      {m.icon === 'coin'
                        ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v10M9 9.5c0-1.2 1.3-2 3-2s3 .9 3 2-1.3 1.5-3 2-3 .8-3 2 1.3 2 3 2 3-.8 3-2"/></svg>
                        : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>
                      }
                    </div>
                    <span className="dep-method-name">{m.label}</span>
                  </button>
                ))}
              </div>
              {withdrawMethods.length === 0 && (
                <div style={{ fontSize:12, color:'var(--t4)', padding:'8px 2px' }}>{t('wd.noMethodsAvailable')}</div>
              )}
            </div>

            <div className="dep-field">
              <label>{t('wd.amountUsd')}</label>
              <div className="dep-glass dep-amount-shell">
                <span className="cur">$</span>
                <input type="number" min={20} placeholder={t('wd.minimumPlaceholder')} value={amount} onChange={e => setAmount(e.target.value)} />
              </div>
              <div className="dep-chip-row">
                {[25, 50, 100, Math.max(20, Math.floor(Math.max(0, realBalance - bonusBalance)))].map((v, i) => (
                  <button
                    key={i}
                    type="button"
                    className={`dep-chip${amount === String(v) ? ' active' : ''}`}
                    onClick={() => setAmount(String(v))}
                  >
                    {i === 3 ? t('wd.max') : v.toLocaleString()}
                  </button>
                ))}
              </div>
            </div>

            {selectedMethod && (
              <div className="dep-field">
                <label>
                  {isEgypt(userCountry) && EGY_WALLETS.some(w => w.id === method)
                    ? (method === 'instapay' ? t('wd.instaPayId') : `${selectedMethod.label} ${t('wd.number')}`)
                    : `${selectedMethod.label} ${t('wd.address')}`}
                </label>
                <input
                  placeholder={t('wd.enterAddressPlaceholder')}
                  value={account} onChange={e => setAccount(e.target.value)} />
              </div>
            )}

            <div className="dep-glass" style={{ padding:'12px 14px', fontSize:12, color:'var(--t3)', lineHeight:1.6, borderColor:'rgba(255,61,87,.14)' }}>
              <strong style={{ color:'var(--t2)' }}>{t('wd.important')}</strong> {t('wd.importantNote')}
            </div>

            <button
              className="dep-btn-primary"
              style={{ background: `linear-gradient(135deg, ${selectedColor} 0%, #00A3E0 100%)`, boxShadow: `0 8px 24px -8px ${selectedColor}70, inset 0 1px 0 rgba(255,255,255,.3)` }}
              onClick={submitWithdraw} disabled={submitting}>
              {submitting ? '' : t('wd.submitRequest')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function TxCard({ tx }: { tx: Transaction }) {
  const { t } = useI18n();
  const isIn = tx.amount > 0;
  const typeColor = isIn ? 'var(--g0)' : 'var(--red)';
  const typeBg    = isIn ? 'rgba(0,230,118,.1)' : 'rgba(255,61,87,.1)';

  return (
    <div className="dep-glass" style={{ padding:'14px 15px 11px' }}>
      <div style={{ display:'flex', alignItems:'center', gap:11 }}>
        <div style={{ width:40, height:40, borderRadius:12, display:'flex', alignItems:'center', justifyContent:'center', background: typeBg, flexShrink:0 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={typeColor} strokeWidth="2">
            {isIn
              ? <><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></>
              : <><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></>
            }
          </svg>
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <div className="dep-method-name" style={{ fontSize:13.5, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{tx.desc}</div>
          <div style={{ fontSize:11, color:'var(--t4)', marginTop:2 }}>{formatDate(tx.date)}</div>
        </div>
        <div style={{ textAlign:'right', flexShrink:0 }}>
          <div style={{ fontSize:15, fontWeight:800, color: typeColor, fontFamily:'JetBrains Mono' }}>
            {isIn ? '+' : ''}{Math.abs(tx.amount).toLocaleString('en-US', { minimumFractionDigits:2, maximumFractionDigits:2 })}
            <span style={{ fontSize:10, fontWeight:400, marginLeft:3 }}>{tx.currency || 'USD'}</span>
          </div>
        </div>
      </div>
      <div style={{ marginTop:9, paddingTop:9, borderTop:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          {tx.method && <span style={{ fontSize:10, color:'var(--t4)', background:'var(--bg2)', padding:'3px 8px', borderRadius:999, fontWeight:600 }}>{tx.method}</span>}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:5 }}>
          {(tx.status === 'pending' || tx.status === 'processing') && (
            <div className="spinner" style={{ width:10, height:10, borderWidth:1.5, borderColor:'rgba(245,158,11,.2)', borderTopColor:'#F59E0B' }} />
          )}
          <span style={{ fontSize:11, fontWeight:700, color: statusColor(tx.status) }}>{statusLabel(tx.status, t)}</span>
        </div>
      </div>
    </div>
  );
}
