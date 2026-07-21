import { useState, useRef } from 'react';
import { useStore } from '../../lib/store';
import { apiFetch } from '../../lib/api';
import type { Transaction } from '../../types';
import { EGY_WALLETS, CRYPTO_METHODS as CRYPTO, PLATFORM_PHONES, DEPOSIT_MIN_USD, isEgypt } from '../../lib/paymentMethods';
import { flagEmoji, COUNTRIES } from '../../lib/countries';
import CountryPicker from '../CountryPicker';

type DepTab  = 'egy' | 'crypto';
type DepStep = 'country' | 'select' | 'form' | 'payment' | 'done';

export default function DepositScreen() {
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
          {step === 'country' ? 'Deposit Funds' : step === 'select' ? 'Deposit Funds' : step === 'form' ? (isCrypto ? `Deposit ${crypto?.name}` : `Deposit via ${wallet?.name}`) : step === 'payment' ? 'Payment Details' : 'Submitted!'}
        </span>
        <button style={{ background:'none', border:'none', color:'var(--t4)', cursor:'pointer', padding:4 }} onClick={() => setOverlay('none')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      {/* Step indicator */}
      {step !== 'done' && (
        <div style={{ display:'flex', padding:'10px 16px 0', gap:4 }}>
          {(['country','select','form','payment'] as DepStep[]).map((s, i) => (
            <div key={s} style={{ flex:1, height:3, borderRadius:2, background: ['country','select','form','payment'].indexOf(step) >= i ? 'var(--g0)' : 'var(--bg3)', transition:'background .3s' }} />
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
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <span style={{ fontSize:18 }}>{countryCode ? flagEmoji(countryCode) : '🌍'}</span>
                <span style={{ fontSize:13, fontWeight:700, color:'var(--t1)' }}>{userCountry}</span>
              </div>
              <button onClick={() => setStep('country')} style={{ background:'none', border:'none', color:'var(--g0)', fontSize:12.5, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
                Change
              </button>
            </div>

            {isEgypt(userCountry) && (
              <div style={{ display:'flex', background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:'var(--r2)', padding:4, gap:4, marginBottom:16 }}>
                {([['egy','Egyptian Wallets'],['crypto','Crypto']] as [DepTab,string][]).map(([t, label]) => (
                  <button key={t} onClick={() => setTab(t)} style={{
                    flex:1, padding:'9px 0', borderRadius:'var(--r3)', fontSize:13, fontWeight:700,
                    background: tab === t ? 'var(--g0)' : 'transparent',
                    color: tab === t ? '#04070E' : 'var(--t3)',
                    border:'none', cursor:'pointer', fontFamily:'inherit', transition:'all .2s',
                  }}>
                    {label}
                  </button>
                ))}
              </div>
            )}
            {!isEgypt(userCountry) && (
              <div style={{ fontSize:11, color:'var(--t4)', fontWeight:700, letterSpacing:'.5px', textTransform:'uppercase', marginBottom:12 }}>
                Available payment methods
              </div>
            )}

            {tab === 'egy' && isEgypt(userCountry) && (
              <>
                <div style={{ fontSize:11, color:'var(--t4)', fontWeight:700, letterSpacing:'.5px', textTransform:'uppercase', marginBottom:10 }}>
                  Min. 1,000 EGP (~${DEPOSIT_MIN_USD}) · Instant Balance
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {EGY_WALLETS.map(w => (
                    <button key={w.id} onClick={() => { setWallet(w); setStep('form'); }}
                      style={{
                        display:'flex', alignItems:'center', gap:14, padding:'14px 16px',
                        background: w.bg, border:`1.5px solid ${w.border}`, borderRadius:'var(--r2)',
                        cursor:'pointer', transition:'all .2s', textAlign:'left', fontFamily:'inherit',
                      }}>
                      <div style={{ width:40, height:40, borderRadius:12, background:w.color, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
                          <rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>
                        </svg>
                      </div>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:14, fontWeight:800, color:'var(--t1)' }}>{w.name}</div>
                        <div style={{ fontSize:11, color:'var(--t4)', marginTop:2 }}>Min 1,000 EGP · 0% Fees</div>
                      </div>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--t4)" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
                    </button>
                  ))}
                </div>
              </>
            )}

            {(tab === 'crypto' || !isEgypt(userCountry)) && (
              <>
                <div style={{ fontSize:11, color:'var(--t4)', fontWeight:700, letterSpacing:'.5px', textTransform:'uppercase', marginBottom:10 }}>
                  Min. ${DEPOSIT_MIN_USD} · Credit after 1 confirmation
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {CRYPTO.map(c => (
                    <button key={c.id} onClick={() => { setCrypto(c); setStep('form'); }}
                      style={{
                        display:'flex', alignItems:'center', gap:14, padding:'14px 16px',
                        background:`${c.color}10`, border:`1.5px solid ${c.color}30`, borderRadius:'var(--r2)',
                        cursor:'pointer', transition:'all .2s', textAlign:'left', fontFamily:'inherit',
                      }}>
                      <div style={{ width:40, height:40, borderRadius:12, background:c.color, display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, fontWeight:900, color:'#fff', flexShrink:0 }}>
                        {c.symbol[0]}
                      </div>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:14, fontWeight:800, color:'var(--t1)' }}>{c.name}</div>
                        <div style={{ fontSize:11, color:'var(--t4)', marginTop:2 }}>Network: {c.network} · Min {c.min} {c.symbol}</div>
                      </div>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--t4)" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
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
            <div style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 14px', background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:'var(--r2)' }}>
              <div style={{ width:36, height:36, borderRadius:10, background: isCrypto ? `${crypto?.color}20` : wallet ? wallet.bg : 'var(--bg3)', border:`1px solid ${isCrypto ? `${crypto?.color}40` : wallet ? wallet.border : 'var(--border)'}`, display:'flex', alignItems:'center', justifyContent:'center' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={isCrypto ? crypto?.color : wallet?.color || 'var(--g0)'} strokeWidth="2">
                  <rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>
                </svg>
              </div>
              <div>
                <div style={{ fontSize:13, fontWeight:800, color:'var(--t1)' }}>{isCrypto ? crypto?.name : wallet?.name}</div>
                <div style={{ fontSize:11, color:'var(--t4)' }}>Min {minAmount.toLocaleString()} {currency}</div>
              </div>
            </div>

            {/* Name */}
            <div className="auth-field">
              <label>Full Name</label>
              <input className="auth-input" placeholder="Enter your full name" value={fullName} onChange={e => setFullName(e.target.value)} />
            </div>

            {/* Phone (Egyptian only) */}
            {!isCrypto && (
              <div className="auth-field">
                <label>Phone Number</label>
                <input className="auth-input" type="tel" placeholder="+201001234567"
                  value={phone}
                  onChange={e => {
                    let v = e.target.value;
                    if (!v.startsWith('+2')) v = '+2' + v.replace(/^\+2?/, '');
                    setPhone(v);
                  }}
                />
                <div style={{ fontSize:11, color:'var(--t4)', marginTop:2 }}>Must start with +2 (e.g. +201001234567)</div>
              </div>
            )}

            {/* Amount */}
            <div className="auth-field">
              <label>Amount ({currency})</label>
              <input className="dep-input" type="number" min={minAmount}
                placeholder={`Min ${minAmount.toLocaleString()} ${currency}`}
                value={amount} onChange={e => setAmount(e.target.value)} />
              <div className="quick-amount-row">
                {(isCrypto ? [25, 50, 100, 250] : [1000, 2500, 5000, 10000]).map(v => (
                  <button
                    key={v}
                    type="button"
                    className={`quick-amount-chip${amount === String(v) ? ' active' : ''}`}
                    onClick={() => setAmount(String(v))}
                  >
                    {v.toLocaleString()}
                  </button>
                ))}
              </div>
            </div>

            {/* Bonus code */}
            <div className="auth-field">
              <label style={{ display:'flex', alignItems:'center', gap:6 }}>
                Bonus Code
                <span style={{ fontSize:10, color:'var(--t4)', fontWeight:600, background:'var(--bg3)', padding:'2px 6px', borderRadius:4 }}>Optional</span>
              </label>
              <input className="auth-input" placeholder="Enter bonus code (optional)"
                value={bonusCode} onChange={e => setBonusCode(e.target.value)} />
            </div>

            {/* Summary */}
            {amount && parseFloat(amount) >= minAmount && (
              <div style={{ padding:'12px 14px', background:'rgba(0,214,143,.06)', border:'1px solid rgba(0,214,143,.18)', borderRadius:'var(--r2)', fontSize:13 }}>
                <div style={{ color:'var(--t3)', marginBottom:4 }}>You will send:</div>
                <div style={{ fontSize:18, fontWeight:900, color:'var(--g0)', fontFamily:'JetBrains Mono' }}>
                  {parseFloat(amount).toLocaleString()} {currency}
                </div>
                {bonusCode.trim() && (
                  <div style={{ fontSize:11, color:'#F59E0B', marginTop:6, display:'flex', alignItems:'center', gap:5 }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                    Bonus code applied: <strong>{bonusCode}</strong>
                  </div>
                )}
              </div>
            )}

            <button className="auth-btn" onClick={goToPayment} style={{ marginTop:4 }}>
              Continue →
            </button>
          </div>
        )}

        {/* ── STEP 3: PAYMENT DETAILS ──────────────────────────────────────── */}
        {step === 'payment' && (
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            {/* Instruction */}
            <div style={{ padding:'12px 14px', background:'rgba(59,130,246,.06)', border:'1px solid rgba(59,130,246,.18)', borderRadius:'var(--r2)', fontSize:13, color:'var(--t3)', lineHeight:1.7 }}>
              {isCrypto
                ? <>Send <strong style={{ color:'var(--t1)' }}>{amount} {currency}</strong> to the address below, then upload your transfer receipt.</>
                : <>Transfer <strong style={{ color:'var(--t1)' }}>{parseFloat(amount).toLocaleString()} EGP</strong> from <strong style={{ color:wallet?.color }}>{wallet?.name}</strong> to the number below, then upload a screenshot of your receipt.</>
              }
            </div>

            {/* Address / Phone to copy */}
            <div style={{ background:'var(--bg2)', border:'1px solid var(--border2)', borderRadius:'var(--r2)', padding:16 }}>
              <div style={{ fontSize:11, color:'var(--t4)', fontWeight:700, letterSpacing:'.5px', textTransform:'uppercase', marginBottom:10 }}>
                {isCrypto ? 'Wallet Address' : 'Transfer To'}
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:10, background:'var(--bg0)', borderRadius:'var(--r3)', padding:'12px 14px', border:'1px solid var(--border)' }}>
                <div style={{ flex:1, fontFamily:'JetBrains Mono', fontSize: isCrypto ? 11 : 15, fontWeight:700, color:'var(--g0)', wordBreak:'break-all', lineHeight:1.5 }}>
                  {isCrypto ? crypto?.address : (platformNumber || PLATFORM_PHONES[wallet?.id || ''])}
                </div>
                <button onClick={copyAddress} style={{
                  flexShrink:0, padding:'8px 14px', borderRadius:'var(--r3)',
                  background: copied ? 'rgba(0,214,143,.15)' : 'var(--bg3)',
                  border:`1px solid ${copied ? 'rgba(0,214,143,.3)' : 'var(--border2)'}`,
                  color: copied ? 'var(--g0)' : 'var(--t2)', fontSize:12, fontWeight:700,
                  cursor:'pointer', fontFamily:'inherit', transition:'all .2s', whiteSpace:'nowrap',
                }}>
                  {copied ? '✓ Copied' : 'Copy'}
                </button>
              </div>
              {isCrypto && crypto && (
                <div style={{ marginTop:8, fontSize:11, color:'var(--t4)' }}>Network: <strong style={{ color:'var(--t2)' }}>{crypto.network}</strong></div>
              )}
            </div>

            {/* Receipt upload */}
            <div>
              <div style={{ fontSize:11, color:'var(--t4)', fontWeight:700, letterSpacing:'.5px', textTransform:'uppercase', marginBottom:8 }}>
                Upload Receipt
              </div>
              <div
                onClick={() => fileRef.current?.click()}
                style={{
                  border:`2px dashed ${receiptFile ? 'rgba(0,214,143,.4)' : 'var(--border2)'}`,
                  borderRadius:'var(--r2)', padding:24, textAlign:'center',
                  background: receiptFile ? 'rgba(0,214,143,.04)' : 'var(--bg2)',
                  cursor:'pointer', transition:'all .2s',
                }}>
                {receiptPreview ? (
                  <>
                    <img src={receiptPreview} alt="Receipt"
                      style={{ maxWidth:'100%', maxHeight:180, borderRadius:'var(--r3)', objectFit:'contain', marginBottom:8 }} />
                    <div style={{ fontSize:12, color:'var(--g0)', fontWeight:700 }}>{receiptFile?.name}</div>
                    <div style={{ fontSize:11, color:'var(--t4)', marginTop:4 }}>Tap to change</div>
                  </>
                ) : (
                  <>
                    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--t4)" strokeWidth="1.5" style={{ margin:'0 auto 12px' }}>
                      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                    </svg>
                    <div style={{ fontSize:14, fontWeight:700, color:'var(--t2)', marginBottom:4 }}>Tap to upload receipt</div>
                    <div style={{ fontSize:12, color:'var(--t4)' }}>JPG, PNG or PDF · Max 10MB</div>
                  </>
                )}
              </div>
              <input ref={fileRef} type="file" accept="image/*,application/pdf" style={{ display:'none' }} onChange={handleFile} />
            </div>

            <button
              className={`auth-btn ${submitting ? 'loading' : ''}`}
              onClick={confirmDeposit}
              disabled={submitting || !receiptFile}
              style={{ background: receiptFile ? 'linear-gradient(135deg,var(--g0),var(--g1))' : 'var(--bg3)', color: receiptFile ? '#04070E' : 'var(--t4)', fontWeight:900, fontSize:16 }}
            >
              {submitting ? '' : 'Confirm Deposit'}
            </button>

            <div style={{ padding:'10px 14px', background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:'var(--r2)', fontSize:12, color:'var(--t4)', lineHeight:1.7 }}>
              <strong style={{ color:'var(--t2)', display:'block', marginBottom:4 }}>How it works</strong>
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

            <div style={{ fontSize:22, fontWeight:900, color:'var(--t1)', marginBottom:8 }}>Receipt Submitted!</div>
            <div style={{ fontSize:13, color:'var(--t3)', lineHeight:1.8, marginBottom:20 }}>
              Your deposit request is under review by our team.<br/>
              Funds appear within <strong style={{ color:'var(--g0)' }}>15–30 minutes</strong>.
            </div>

            <div style={{ background:'rgba(245,158,11,.08)', border:'1px solid rgba(245,158,11,.25)', borderRadius:'var(--r2)', padding:'14px 16px', marginBottom:16, textAlign:'left' }}>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <div className="spinner" style={{ width:18, height:18, borderColor:'rgba(245,158,11,.2)', borderTopColor:'#F59E0B' }} />
                <div>
                  <div style={{ fontSize:13, fontWeight:700, color:'#F59E0B' }}>Processing your deposit…</div>
                  <div style={{ fontSize:11, color:'var(--t4)', marginTop:2 }}>Funds appear within 15–30 minutes</div>
                </div>
              </div>
            </div>

            {txId && (
              <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:'var(--r2)', padding:'10px 14px', marginBottom:16, textAlign:'left' }}>
                <div style={{ fontSize:10, color:'var(--t4)', fontWeight:700, textTransform:'uppercase', letterSpacing:'.5px' }}>Transaction ID</div>
                <div style={{ fontSize:12, fontFamily:'JetBrains Mono', color:'var(--t2)', marginTop:4, wordBreak:'break-all' }}>{txId}</div>
              </div>
            )}

            <button className="auth-btn" onClick={() => setOverlay('transfers')} style={{ marginBottom:10 }}>
              View Transaction History
            </button>
            <button style={{ background:'none', border:'none', color:'var(--t4)', cursor:'pointer', fontSize:13, fontFamily:'inherit', display:'block', margin:'0 auto' }} onClick={() => setOverlay('none')}>
              Close
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
