import { useState, useRef } from 'react';
import { useStore } from '../../lib/store';
import { apiFetch } from '../../lib/api';
import type { Transaction } from '../../types';
import { EGY_WALLETS, CRYPTO_METHODS as CRYPTO, PLATFORM_PHONES, DEPOSIT_MIN_USD, isEgypt } from '../../lib/paymentMethods';
import { flagEmoji, COUNTRIES } from '../../lib/countries';
import CountryPicker from '../CountryPicker';
import { useI18n } from '../../lib/i18n';

type DepTab  = 'egy' | 'crypto';
type DepStep = 'country' | 'select' | 'form' | 'payment' | 'done';
const STEP_ORDER: DepStep[] = ['country', 'select', 'form', 'payment'];

export default function DepositScreen() {
  const { t } = useI18n();
  const setOverlay     = useStore(s => s.setOverlay);
  const showToast      = useStore(s => s.showToast);
  const addTransaction = useStore(s => s.addTransaction);
  const userCountry    = useStore(s => s.userCountry);
  const setUserCountry = useStore(s => s.setUserCountry);

  const [step, setStep]             = useState<DepStep>(userCountry ? 'select' : 'country');
  const [tab, setTab]               = useState<DepTab>(isEgypt(userCountry) ? 'egy' : 'crypto');
  const [wallet, setWallet]         = useState<typeof EGY_WALLETS[0] | null>(null);
  const [crypto, setCrypto]         = useState<typeof CRYPTO[0] | null>(null);

  // Form fields
  const [fullName,    setFullName]   = useState('');
  const [phone,       setPhone]      = useState('+2');
  const [amount,      setAmount]     = useState('');
  const [bonusCode,   setBonusCode]  = useState('');

  // Payment step
  const [platformNumber, setPlatformNumber] = useState('');
  const [copied,         setCopied]         = useState(false);
  const [receiptFile,    setReceiptFile]    = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [submitting,     setSubmitting]     = useState(false);
  const [txId,           setTxId]           = useState('');

  const fileRef = useRef<HTMLInputElement>(null);

  const countryCode = COUNTRIES.find(c => c.name === userCountry)?.code;
  const isCrypto  = tab === 'crypto';
  const minAmount = isCrypto ? (crypto?.min || DEPOSIT_MIN_USD) : 1000;
  const currency  = isCrypto ? (crypto?.symbol || 'USDT') : 'EGP';
  const methodColor = isCrypto ? (crypto?.color || '#00D68F') : (wallet?.color || '#00D68F');

  function selectCountry(c: string) {
    setUserCountry(c);
    setTab(isEgypt(c) ? 'egy' : 'crypto');
    setStep('select');
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────
  function reset() {
    setStep('select'); setWallet(null); setCrypto(null);
    setFullName(''); setPhone('+2'); setAmount(''); setBonusCode('');
    setReceiptFile(null); setReceiptPreview(null); setPlatformNumber(''); setTxId('');
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setReceiptFile(f);
    setReceiptPreview(URL.createObjectURL(f));
  }

  async function goToPayment() {
    // Validate form
    const amt = parseFloat(amount);
    if (!fullName.trim()) { showToast('Please enter your name'); return; }
    if (!isCrypto && phone.length < 8) { showToast('Enter a valid phone number'); return; }
    if (!amount || isNaN(amt) || amt < minAmount) {
      showToast(`Minimum deposit is ${minAmount.toLocaleString()} ${currency}`); return;
    }

    // Fetch platform phone/address from backend
    try {
      const res = await apiFetch('/api/wallet/deposit-info').catch(() => null);
      if (res?.ok) {
        const data = await res.json().catch(() => ({}));
        if (!isCrypto && wallet) {
          setPlatformNumber(data[wallet.phoneKey] || PLATFORM_PHONES[wallet.id] || '');
        }
      }
    } catch {}

    if (!isCrypto && wallet && !platformNumber) {
      setPlatformNumber(PLATFORM_PHONES[wallet.id] || '');
    }

    setStep('payment');
  }

  async function confirmDeposit() {
    if (!receiptFile) { showToast('Please upload your payment receipt'); return; }
    setSubmitting(true);

    const methodName = isCrypto
      ? `${crypto?.name} (${crypto?.network})`
      : wallet?.name || '';

    try {
      const form = new FormData();
      form.append('amount', amount);
      form.append('method', methodName);
      form.append('currency', currency);
      form.append('fullName', fullName);
      if (!isCrypto) form.append('senderPhone', phone);
      if (bonusCode.trim()) form.append('bonusCode', bonusCode.trim());
      form.append('proof', receiptFile);

      const res = await apiFetch('/api/wallet/deposit', { method: 'POST', body: form });
      const data = await res.json().catch(() => ({}));

      const id = data.id || data.transactionId || `dep_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      setTxId(id);

      const tx: Transaction = {
        id,
        type: 'deposit',
        desc: `${methodName} Deposit`,
        amount: parseFloat(amount),
        status: 'pending',
        date: Date.now(),
        method: methodName,
        currency,
      };
      addTransaction(tx);
      setStep('done');
    } catch {
      showToast('Connection error — please try again');
    } finally {
      setSubmitting(false);
    }
  }

  async function copyAddress() {
    const addr = isCrypto ? crypto?.address : platformNumber;
    if (!addr) return;
    await navigator.clipboard.writeText(addr).catch(() => {});
    setCopied(true);
    showToast('Copied!');
    setTimeout(() => setCopied(false), 2000);
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="fullscreen dep-fullscreen">
      {/* Header */}
      <div className="fs-header">
        <button className="fs-back" onClick={
          step === 'country' || step === 'done' ? () => setOverlay('none')
          : step === 'select' ? () => setStep('country')
          : step === 'payment' ? () => setStep('form')
          : reset
        }>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <span className="fs-title">
          {step === 'country' ? t('dep.title') : step === 'select' ? t('dep.title') : step === 'form' ? (isCrypto ? `${t('dep.title').split(' ')[0]} ${crypto?.name}` : `${t('dep.title').split(' ')[0]} ${wallet?.name}`) : step === 'payment' ? t('dep.paymentDetails') : t('dep.submitted')}
        </span>
        <button style={{ background:'none', border:'none', color:'var(--t4)', cursor:'pointer', padding:4 }} onClick={() => setOverlay('none')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      {/* Step indicator */}
      {step !== 'done' && (
        <div className="dep-step-track">
          {STEP_ORDER.map((s, i) => (
            <div key={s} className="seg">
              <div className={`fill ${STEP_ORDER.indexOf(step) >= i ? 'done' : ''}`} />
            </div>
          ))}
        </div>
      )}

      <div className="fs-body" style={{ paddingTop: step === 'done' ? 32 : 16 }}>

        {/* ── STEP 0: COUNTRY ─────────────────────────────────────────────── */}
        {step === 'country' && (
          <CountryPicker current={userCountry} onSelect={selectCountry} />
        )}

        {/* ── STEP 1: SELECT METHOD ────────────────────────────────────────── */}
        {step === 'select' && (
          <>
            {/* Country pill + change link */}
            <div className="dep-glass dep-country-pill">
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <span className="flag">{countryCode ? flagEmoji(countryCode) : '🌍'}</span>
                <span className="name">{userCountry}</span>
              </div>
              <button className="change-btn" onClick={() => setStep('country')}>
                {t('dep.change')}
              </button>
            </div>

            {isEgypt(userCountry) && (
              <div className="dep-glass" style={{ display:'flex', padding:4, gap:4, marginBottom:16, borderRadius:999 }}>
                {([['egy',t('dep.egyptianWallets')],['crypto',t('dep.crypto')]] as [DepTab,string][]).map(([tabId, label]) => (
                  <button key={tabId} onClick={() => setTab(tabId)} style={{
                    flex:1, padding:'10px 0', borderRadius:999, fontSize:13, fontWeight:700, fontFamily:"'Outfit','Inter',sans-serif",
                    background: tab === tabId ? 'linear-gradient(135deg, var(--g0), #00A3E0)' : 'transparent',
                    color: tab === tabId ? '#04120C' : 'var(--t3)',
                    border:'none', cursor:'pointer', transition:'all .2s var(--ease)',
                  }}>
                    {label}
                  </button>
                ))}
              </div>
            )}
            {!isEgypt(userCountry) && (
              <div className="dep-eyebrow">{t('dep.availableMethods')}</div>
            )}

            {tab === 'egy' && isEgypt(userCountry) && (
              <>
                <div className="dep-eyebrow">Min. 1,000 EGP (~${DEPOSIT_MIN_USD}) · {t('dep.instantBalance')}</div>
                <div className="dep-method-list">
                  {EGY_WALLETS.map(w => (
                    <button key={w.id} className="dep-glass dep-method-card"
                      style={{ '--mc': w.color, '--mc-glow': `${w.color}55` } as React.CSSProperties}
                      onClick={() => { setWallet(w); setStep('form'); }}>
                      <div className="dep-method-ico" style={{ background: w.color }}>
                        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
                          <rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>
                        </svg>
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div className="dep-method-name">{w.name}</div>
                        <div className="dep-method-sub">Min 1,000 EGP · {t('dep.zeroFees')}</div>
                      </div>
                      <svg className="dep-method-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
                    </button>
                  ))}
                </div>
              </>
            )}

            {(tab === 'crypto' || !isEgypt(userCountry)) && (
              <>
                <div className="dep-eyebrow">Min. ${DEPOSIT_MIN_USD} · {t('dep.creditAfterConfirm')}</div>
                <div className="dep-method-list">
                  {CRYPTO.map(c => (
                    <button key={c.id} className="dep-glass dep-method-card"
                      style={{ '--mc': c.color, '--mc-glow': `${c.color}55` } as React.CSSProperties}
                      onClick={() => { setCrypto(c); setStep('form'); }}>
                      <div className="dep-method-ico" style={{ background: c.color }}>{c.symbol[0]}</div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div className="dep-method-name">{c.name}</div>
                        <div className="dep-method-sub">{t('dep.network')}: {c.network} · {t('dep.min')} {c.min} {c.symbol}</div>
                      </div>
                      <svg className="dep-method-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
                    </button>
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {/* ── STEP 2: FORM ──────────────────────────────────────────────────── */}
        {step === 'form' && (
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            {/* Method badge */}
            <div className="dep-glass" style={{ display:'flex', alignItems:'center', gap:12, padding:'13px 15px' }}>
              <div className="dep-method-ico" style={{ width:38, height:38, borderRadius:11, background: methodColor, fontSize:14 }}>
                {isCrypto
                  ? crypto?.symbol[0]
                  : <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
                }
              </div>
              <div>
                <div className="dep-method-name" style={{ fontSize:13.5 }}>{isCrypto ? crypto?.name : wallet?.name}</div>
                <div className="dep-method-sub">{t('dep.min')} {minAmount.toLocaleString()} {currency}</div>
              </div>
            </div>

            {/* Name */}
            <div className="dep-field">
              <label>{t('dep.fullName')}</label>
              <input placeholder={t('dep.fullNamePlaceholder')} value={fullName} onChange={e => setFullName(e.target.value)} />
            </div>

            {/* Phone (Egyptian only) */}
            {!isCrypto && (
              <div className="dep-field">
                <label>{t('dep.phoneNumber')}</label>
                <input type="tel" placeholder="+201001234567"
                  value={phone}
                  onChange={e => {
                    let v = e.target.value;
                    if (!v.startsWith('+2')) v = '+2' + v.replace(/^\+2?/, '');
                    setPhone(v);
                  }}
                />
                <div className="dep-field-hint">{t('dep.phoneHint')}</div>
              </div>
            )}

            {/* Amount */}
            <div className="dep-field">
              <label>{t('dep.amount')} ({currency})</label>
              <div className="dep-glass dep-amount-shell">
                <span className="cur">{currency}</span>
                <input type="number" min={minAmount}
                  placeholder={`Min ${minAmount.toLocaleString()}`}
                  value={amount} onChange={e => setAmount(e.target.value)} />
              </div>
              <div className="dep-chip-row">
                {(isCrypto ? [25, 50, 100, 250] : [1000, 2500, 5000, 10000]).map(v => (
                  <button
                    key={v}
                    type="button"
                    className={`dep-chip${amount === String(v) ? ' active' : ''}`}
                    onClick={() => setAmount(String(v))}
                  >
                    {v.toLocaleString()}
                  </button>
                ))}
              </div>
            </div>

            {/* Bonus code */}
            <div className="dep-field">
              <label style={{ display:'flex', alignItems:'center', gap:6 }}>
                {t('dep.bonusCode')}
                <span style={{ fontSize:10, color:'var(--t4)', fontWeight:600, background:'var(--bg3)', padding:'2px 6px', borderRadius:4, textTransform:'none', letterSpacing:0 }}>{t('dep.optional')}</span>
              </label>
              <input placeholder={t('dep.bonusPlaceholder')}
                value={bonusCode} onChange={e => setBonusCode(e.target.value)} />
            </div>

            {/* Summary */}
            {amount && parseFloat(amount) >= minAmount && (
              <div className="dep-glass" style={{ padding:'14px 16px', borderColor: 'rgba(0,214,143,.25)' }}>
                <div style={{ color:'var(--t3)', marginBottom:4, fontSize:13 }}>{t('dep.willSend')}</div>
                <div className="dep-headline" style={{ fontSize:22, color:'var(--g0)', fontFamily:"'JetBrains Mono'" }}>
                  {parseFloat(amount).toLocaleString()} {currency}
                </div>
                {bonusCode.trim() && (
                  <div style={{ fontSize:11, color:'#F59E0B', marginTop:8, display:'flex', alignItems:'center', gap:5 }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                    {t('dep.bonusApplied')} <strong>{bonusCode}</strong>
                  </div>
                )}
              </div>
            )}

            <button className="dep-btn-primary" onClick={goToPayment} style={{ marginTop:4 }}>
              {t('dep.continue')}
            </button>
          </div>
        )}

        {/* ── STEP 3: PAYMENT DETAILS — the ticket ───────────────────────────── */}
        {step === 'payment' && (
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
            {/* Instruction */}
            <div className="dep-glass" style={{ padding:'13px 15px', fontSize:13, color:'var(--t3)', lineHeight:1.7, borderColor:'rgba(59,130,246,.22)' }}>
              {isCrypto
                ? <>Send <strong style={{ color:'var(--t1)' }}>{amount} {currency}</strong> to the address below, then upload your transfer receipt.</>
                : <>Transfer <strong style={{ color:'var(--t1)' }}>{parseFloat(amount).toLocaleString()} EGP</strong> from <strong style={{ color:wallet?.color }}>{wallet?.name}</strong> to the number below, then upload a screenshot of your receipt.</>
              }
            </div>

            {/* The ticket */}
            <div className="dep-glass dep-ticket">
              <div className="dep-ticket-top">
                <div className="dep-method-ico" style={{ background: methodColor, width:44, height:44, borderRadius:14, fontSize:16 }}>
                  {isCrypto
                    ? crypto?.symbol[0]
                    : <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
                  }
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div className="dep-ticket-label">{isCrypto ? crypto?.network : t('app.panel.deposit')}</div>
                  <div className="dep-method-name" style={{ fontSize:15 }}>{isCrypto ? crypto?.name : wallet?.name}</div>
                </div>
                <div style={{ textAlign:'right' }}>
                  <div className="dep-ticket-label">{t('dep.amount')}</div>
                  <div className="dep-ticket-amount" style={{ fontSize:20 }}>{amount || '0'} <span style={{ fontSize:12, color:'var(--t4)' }}>{currency}</span></div>
                </div>
              </div>

              <div className="dep-ticket-notch-row" />

              <div className="dep-ticket-bottom">
                <div className="dep-ticket-label">{isCrypto ? t('dep.walletAddress') : t('dep.transferTo')}</div>
                <div className="dep-addr-shell">
                  <div className="dep-addr-text">
                    {isCrypto ? crypto?.address : (platformNumber || PLATFORM_PHONES[wallet?.id || ''])}
                  </div>
                  <button className={`dep-copy-btn ${copied ? 'copied' : ''}`} onClick={copyAddress}>
                    {copied ? (
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                    ) : (
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                    )}
                    {copied ? t('dep.copied') : t('dep.copy')}
                  </button>
                </div>
                {isCrypto && crypto && (
                  <div style={{ marginTop:10, fontSize:11, color:'var(--t4)' }}>{t('dep.network')}: <strong style={{ color:'var(--t2)' }}>{crypto.network}</strong></div>
                )}
              </div>
            </div>

            {/* Receipt upload */}
            <div>
              <div className="dep-eyebrow" style={{ marginBottom:8 }}>{t('dep.uploadReceipt')}</div>
              <div
                className={`dep-glass dep-dropzone ${receiptFile ? 'has-file' : ''}`}
                onClick={() => fileRef.current?.click()}>
                {receiptPreview ? (
                  <>
                    <img src={receiptPreview} alt="Receipt"
                      style={{ maxWidth:'100%', maxHeight:180, borderRadius:14, objectFit:'contain', marginBottom:10 }} />
                    <div style={{ fontSize:12, color:'var(--g0)', fontWeight:700 }}>{receiptFile?.name}</div>
                    <div style={{ fontSize:11, color:'var(--t4)', marginTop:4 }}>{t('dep.tapToChange')}</div>
                  </>
                ) : (
                  <>
                    <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="var(--t4)" strokeWidth="1.5" style={{ margin:'0 auto 12px' }}>
                      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                    </svg>
                    <div style={{ fontSize:14, fontWeight:700, color:'var(--t2)', marginBottom:4, fontFamily:"'Outfit','Inter',sans-serif" }}>{t('dep.tapToUpload')}</div>
                    <div style={{ fontSize:12, color:'var(--t4)' }}>{t('dep.fileTypes')}</div>
                  </>
                )}
              </div>
              <input ref={fileRef} type="file" accept="image/*,application/pdf" style={{ display:'none' }} onChange={handleFile} />
            </div>

            <button
              className="dep-btn-primary"
              onClick={confirmDeposit}
              disabled={submitting || !receiptFile}
            >
              {submitting ? '' : t('dep.confirmDeposit')}
            </button>

            <div className="dep-glass" style={{ padding:'12px 15px', fontSize:12, color:'var(--t4)', lineHeight:1.7 }}>
              <strong style={{ color:'var(--t2)', display:'block', marginBottom:4, fontFamily:"'Outfit','Inter',sans-serif" }}>How it works</strong>
              1. Send the exact amount to the address/number above<br/>
              2. Upload a screenshot of your payment<br/>
              3. Tap <strong>Confirm Deposit</strong> — reviewed within <strong style={{ color:'var(--g0)' }}>15–30 min</strong>
            </div>
          </div>
        )}

        {/* ── STEP 4: DONE ────────────────────────────────────────────────── */}
        {step === 'done' && (
          <div style={{ textAlign:'center', padding:'20px 0' }}>
            <div style={{
              width:80, height:80, borderRadius:'50%',
              background:'rgba(0,214,143,.1)', border:'2px solid rgba(0,214,143,.3)',
              display:'flex', alignItems:'center', justifyContent:'center',
              margin:'0 auto 20px', animation:'bounceIn .5s var(--ease)',
            }}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--g0)" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            </div>

            <div className="dep-headline" style={{ fontSize:22, marginBottom:8 }}>{t('dep.receiptSubmitted')}</div>
            <div style={{ fontSize:13, color:'var(--t3)', lineHeight:1.8, marginBottom:20 }}>
              {t('dep.underReview')}<br/>
              {t('dep.fundsAppear1530')}
            </div>

            <div className="dep-glass" style={{ padding:'14px 16px', marginBottom:16, textAlign:'left', borderColor:'rgba(245,158,11,.3)' }}>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <div className="spinner" style={{ width:18, height:18, borderColor:'rgba(245,158,11,.2)', borderTopColor:'#F59E0B' }} />
                <div>
                  <div style={{ fontSize:13, fontWeight:700, color:'#F59E0B' }}>{t('dep.processing')}</div>
                  <div style={{ fontSize:11, color:'var(--t4)', marginTop:2 }}>{t('dep.fundsAppear1530')}</div>
                </div>
              </div>
            </div>

            {txId && (
              <div className="dep-glass" style={{ padding:'11px 15px', marginBottom:16, textAlign:'left' }}>
                <div style={{ fontSize:10, color:'var(--t4)', fontWeight:700, textTransform:'uppercase', letterSpacing:'.5px' }}>{t('dep.transactionId')}</div>
                <div style={{ fontSize:12, fontFamily:'JetBrains Mono', color:'var(--t2)', marginTop:4, wordBreak:'break-all' }}>{txId}</div>
              </div>
            )}

            <button className="dep-btn-primary" onClick={() => setOverlay('transfers')} style={{ marginBottom:10 }}>
              {t('dep.viewHistory')}
            </button>
            <button style={{ background:'none', border:'none', color:'var(--t4)', cursor:'pointer', fontSize:13, fontFamily:'inherit', display:'block', margin:'0 auto' }} onClick={() => setOverlay('none')}>
              {t('dep.close')}
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
