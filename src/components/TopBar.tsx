import { useState, useRef, useEffect } from 'react';
import { useStore } from '../lib/store';
import { playClick, resumeAudio } from '../lib/sounds';
import { useI18n } from '../lib/i18n';

export default function TopBar() {
  const walType       = useStore(s => s.walType);
  const setWalType    = useStore(s => s.setWalType);
  const demoBalance   = useStore(s => s.demoBalance);
  const realBalance   = useStore(s => s.realBalance);
  const theme         = useStore(s => s.theme);
  const toggleTheme   = useStore(s => s.toggleTheme);
  const setOverlay    = useStore(s => s.setOverlay);
  const soundEnabled  = useStore(s => s.soundEnabled);
  const setSoundEnabled = useStore(s => s.setSoundEnabled);

  const [dropOpen, setDropOpen] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);
  const { t } = useI18n();

  const bal = walType === 'demo' ? demoBalance : realBalance;

  useEffect(() => {
    function close(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setDropOpen(false);
    }
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  function switchWallet(type: 'demo' | 'real') {
    resumeAudio(); playClick();
    setWalType(type); setDropOpen(false);
  }

  return (
    <div className="topbar">
      {/* Logo — faceted X mark + OXIER wordmark */}
      <div className="tb-logo">
        <div className="tb-logo-ico">
          <svg width="15" height="15" viewBox="0 0 32 32" fill="none">
            <defs>
              <linearGradient id="oxXA" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#fff" stopOpacity="0.98"/>
                <stop offset="1" stopColor="#eafff5" stopOpacity="0.65"/>
              </linearGradient>
              <linearGradient id="oxXB" x1="0" y1="1" x2="1" y2="0">
                <stop offset="0" stopColor="#fff" stopOpacity="0.5"/>
                <stop offset="1" stopColor="#fff" stopOpacity="0.92"/>
              </linearGradient>
            </defs>
            <rect x="5" y="13.5" width="22" height="5" rx="2.5" fill="url(#oxXA)" transform="rotate(45 16 16)"/>
            <rect x="5" y="13.5" width="22" height="5" rx="2.5" fill="url(#oxXB)" transform="rotate(-45 16 16)"/>
          </svg>
        </div>
        <div className="tb-logo-text">OXIER</div>
      </div>

      <div className="tb-center" />

      <div className="tb-right">
        {/* Wallet selector */}
        <div style={{ position: 'relative' }} ref={dropRef}>
          <div
            className={`tb-wallet ${dropOpen ? 'open' : ''}`}
            onClick={() => { resumeAudio(); playClick(); setDropOpen(v => !v); }}
          >
            <div className={`tb-wallet-dot ${walType}`} />
            <div style={{ display: 'flex', alignItems: 'baseline' }}>
              <span className="tb-wallet-label">{walType === 'demo' ? t('app.wallet.demo') : t('app.wallet.real')}</span>
              <span className="tb-balance">
                ${bal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <svg className="tb-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </div>

          {dropOpen && (
            <div className="acc-drop">
              <div className={`acc-opt ${walType === 'demo' ? 'active' : ''}`} onClick={() => switchWallet('demo')}>
                <div className="acc-opt-dot demo" />
                <div style={{ flex: 1 }}>
                  <div className="acc-opt-name">Demo Account</div>
                  <div style={{ fontSize: 10, color: 'var(--t4)' }}>Practice trading</div>
                </div>
                <span className="acc-opt-bal">${demoBalance.toFixed(2)}</span>
              </div>
              <div style={{ height: 1, background: 'var(--border)', margin: '0 12px' }} />
              <div className={`acc-opt ${walType === 'real' ? 'active' : ''}`} onClick={() => switchWallet('real')}>
                <div className="acc-opt-dot real" />
                <div style={{ flex: 1 }}>
                  <div className="acc-opt-name">Real Account</div>
                  <div style={{ fontSize: 10, color: 'var(--t4)' }}>Live trading</div>
                </div>
                <span className="acc-opt-bal">${realBalance.toFixed(2)}</span>
              </div>
              <div style={{ height: 1, background: 'var(--border)', margin: '0 12px' }} />
              <div className="acc-opt" onClick={() => { setOverlay('deposit'); setDropOpen(false); }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--g0)', boxShadow: '0 0 6px var(--g0)' }} />
                <div style={{ flex: 1 }}>
                  <div className="acc-opt-name" style={{ color: 'var(--g0)' }}>Deposit Funds</div>
                  <div style={{ fontSize: 10, color: 'var(--t4)' }}>Add balance to trade</div>
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--g0)" strokeWidth="2">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </div>
            </div>
          )}
        </div>

        {/* Sound toggle */}
        <button
          className={`tb-icon-btn ${soundEnabled ? 'active' : ''}`}
          onClick={() => { resumeAudio(); setSoundEnabled(!soundEnabled); }}
          title="Toggle Sound"
        >
          {soundEnabled
            ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                <path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07"/>
              </svg>
            : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                <line x1="23" y1="9" x2="17" y2="15"/>
                <line x1="17" y1="9" x2="23" y2="15"/>
              </svg>
          }
        </button>

        {/* Theme toggle */}
        <button className="tb-icon-btn" onClick={() => { resumeAudio(); toggleTheme(); }} title="Toggle Theme">
          {theme === 'dark'
            ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="5"/>
                <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
              </svg>
            : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>
              </svg>
          }
        </button>
      </div>
    </div>
  );
}
