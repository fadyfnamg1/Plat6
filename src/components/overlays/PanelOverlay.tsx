import { useStore } from '../../lib/store';
import { playClick, resumeAudio } from '../../lib/sounds';
import LanguageSwitcher from '../LanguageSwitcher';
import { useI18n } from '../../lib/i18n';

function IconDeposit() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20M17 7l-5-5-5 5M17 17l-5 5-5-5"/></svg>;
}
function IconWithdraw() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>;
}
function IconHistory() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>;
}
function IconProfile() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>;
}
function IconSignals() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>;
}
function IconEvents() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>;
}
function IconSupport() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>;
}
function IconLogout() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>;
}

export default function PanelOverlay() {
  const { t } = useI18n();
  const setOverlay  = useStore(s => s.setOverlay);
  const userInfo    = useStore(s => s.userInfo);
  const setUserInfo = useStore(s => s.setUserInfo);
  const setScreen   = useStore(s => s.setScreen);
  const demoBalance = useStore(s => s.demoBalance);
  const realBalance = useStore(s => s.realBalance);
  const trades      = useStore(s => s.trades);
  const showConfirm = useStore(s => s.showConfirm);
  const theme       = useStore(s => s.theme);
  const setTheme    = useStore(s => s.setTheme);
  const setTransfersTab = useStore(s => s.setTransfersTab);

  const resolved    = trades.filter(t => t.resolved);
  const wins        = resolved.filter(t => t.won);
  const totalProfit = wins.reduce((a, t) => a + (t.profit || 0), 0);
  const winRate     = resolved.length ? ((wins.length / resolved.length) * 100).toFixed(0) : '0';
  const name        = userInfo?.name || 'Trader';
  const email       = userInfo?.email || '';
  const initials    = name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();

  function go(ov: string) { resumeAudio(); playClick(); setOverlay(ov as any); }
  function goWithdraw() { resumeAudio(); playClick(); setTransfersTab('withdraw'); setOverlay('transfers'); }
  function logout() {
    showConfirm(t('app.panel.signOut'), 'Are you sure you want to sign out?', () => {
      setUserInfo(null); setScreen('landing');
    });
  }

  const MENU = [
    { icon: <IconDeposit />,    color: '#00D68F', bg: 'rgba(0,214,143,.12)',  title: t('app.panel.deposit'),    sub: t('app.panel.depositSub'),    action: () => go('deposit') },
    { icon: <IconWithdraw />,   color: '#3B82F6', bg: 'rgba(59,130,246,.12)', title: t('app.panel.withdrawal'), sub: t('app.panel.withdrawalSub'), action: goWithdraw },
    { icon: <IconHistory />,    color: '#F59E0B', bg: 'rgba(245,158,11,.12)', title: t('app.panel.history'),    sub: t('app.panel.historySub'),    action: () => go('history') },
    { icon: <IconProfile />,    color: '#8B5CF6', bg: 'rgba(139,92,246,.12)', title: t('app.panel.profile'),    sub: t('app.panel.profileSub'),    action: () => go('profile') },
    { icon: <IconSignals />,    color: '#EC4899', bg: 'rgba(236,72,153,.12)', title: t('app.panel.signals'),    sub: t('app.panel.signalsSub'),    action: () => go('signals') },
    { icon: <IconEvents />,     color: '#F97316', bg: 'rgba(249,115,22,.12)', title: t('app.panel.events'),     sub: t('app.panel.eventsSub'),     action: () => go('events') },
    { icon: <IconSupport />,    color: '#10B981', bg: 'rgba(16,185,129,.12)', title: t('app.panel.support'),    sub: t('app.panel.supportSub'),    action: () => go('events') },
  ];

  return (
    <div className="overlay-bg" onClick={() => setOverlay('none')}>
      <div className="overlay-sheet" style={{ maxHeight: '92vh' }} onClick={e => e.stopPropagation()}>
        <div className="overlay-handle" />

        {/* Header */}
        <div className="overlay-header">
          <span className="overlay-title">{t('app.panel.title')}</span>
          <button className="overlay-close" onClick={() => setOverlay('none')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div className="overlay-body">
          {/* ── Avatar + name ── */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, marginBottom: 20, paddingTop: 4 }}>
            {/* Outer glow ring */}
            <div style={{
              width: 80, height: 80, borderRadius: '50%',
              background: 'linear-gradient(135deg, rgba(0,214,143,.4) 0%, rgba(0,100,255,.3) 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 32px rgba(0,214,143,.2)',
              animation: 'glowPulse 3s infinite',
            }}>
              <div style={{
                width: 72, height: 72, borderRadius: '50%',
                background: 'linear-gradient(135deg, #00D68F 0%, #0055EE 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 26, fontWeight: 900, color: '#fff',
                letterSpacing: -1, userSelect: 'none',
              }}>{initials}</div>
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--t1)', marginTop: 2 }}>{name}</div>
            <div style={{ fontSize: 12, color: 'var(--t4)', fontWeight: 500 }}>{email}</div>

            {/* Stats row */}
            <div style={{ display: 'flex', gap: 0, marginTop: 8, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--r2)', overflow: 'hidden', width: '100%' }}>
              {[
                { val: resolved.length, lbl: t('app.panel.trades') },
                { val: `${winRate}%`,   lbl: t('app.panel.winRate') },
                { val: `${totalProfit >= 0 ? '+' : ''}$${Math.abs(totalProfit).toFixed(0)}`, lbl: t('app.panel.pnl'), color: totalProfit >= 0 ? 'var(--g0)' : 'var(--red)' },
              ].map((s, i) => (
                <div key={i} style={{
                  flex: 1, padding: '12px 4px', textAlign: 'center',
                  borderRight: i < 2 ? '1px solid var(--border)' : 'none',
                }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: (s as any).color || 'var(--t1)', fontFamily: 'JetBrains Mono' }}>{s.val}</div>
                  <div style={{ fontSize: 9, color: 'var(--t4)', fontWeight: 600, marginTop: 3, textTransform: 'uppercase', letterSpacing: .5 }}>{s.lbl}</div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Balance cards ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 20 }}>
            <div style={{
              background: 'linear-gradient(135deg, rgba(245,158,11,.1) 0%, rgba(245,158,11,.05) 100%)',
              border: '1px solid rgba(245,158,11,.2)', borderRadius: 'var(--r2)', padding: '14px 16px',
            }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#F59E0B', letterSpacing: .5, marginBottom: 4, textTransform: 'uppercase' }}>{t('app.panel.demoBalance')}</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: '#F59E0B', fontFamily: 'JetBrains Mono' }}>${demoBalance.toFixed(2)}</div>
            </div>
            <div style={{
              background: 'linear-gradient(135deg, rgba(0,214,143,.1) 0%, rgba(0,214,143,.05) 100%)',
              border: '1px solid rgba(0,214,143,.2)', borderRadius: 'var(--r2)', padding: '14px 16px',
            }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--g0)', letterSpacing: .5, marginBottom: 4, textTransform: 'uppercase' }}>{t('app.panel.realBalance')}</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--g0)', fontFamily: 'JetBrains Mono' }}>${realBalance.toFixed(2)}</div>
            </div>
          </div>

          {/* ── Menu ── */}
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--t4)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>{t('app.panel.quickActions')}</div>
          <div className="panel-menu">
            {MENU.map((item, i) => (
              <div key={i} className="panel-menu-item" onClick={item.action} style={{ animationDelay: `${i * 0.04}s` }}>
                <div className="panel-menu-ico" style={{ background: item.bg, color: item.color }}>{item.icon}</div>
                <div className="panel-menu-info">
                  <div className="panel-menu-title">{item.title}</div>
                  <div className="panel-menu-sub">{item.sub}</div>
                </div>
                <svg className="panel-menu-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
              </div>
            ))}
          </div>

          {/* ── Preferences ── */}
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--t4)', letterSpacing: 1, textTransform: 'uppercase', margin: '18px 0 8px' }}>{t('app.panel.preferences')}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 8 }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--r2)',
              padding: '10px 12px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(6,182,212,.12)', color: '#06B6D4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="5"/>
                    <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
                    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                    <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
                    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                  </svg>
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--t1)' }}>{t('app.panel.appearance')}</div>
              </div>
              <div style={{ display: 'flex', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 999, padding: 3, gap: 2 }}>
                {(['dark', 'light'] as const).map(m => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => { resumeAudio(); playClick(); setTheme(m); }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 5,
                      padding: '6px 12px', borderRadius: 999, border: 'none', cursor: 'pointer',
                      fontSize: 11.5, fontWeight: 700, fontFamily: 'inherit',
                      background: theme === m ? 'var(--g0)' : 'transparent',
                      color: theme === m ? '#04070E' : 'var(--t3)',
                      transition: 'all .15s',
                    }}
                  >
                    {m === 'dark'
                      ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>
                      : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><circle cx="12" cy="12" r="4.5"/><line x1="12" y1="1.5" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="22.5"/><line x1="4.2" y1="4.2" x2="6" y2="6"/><line x1="18" y1="18" x2="19.8" y2="19.8"/><line x1="1.5" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="22.5" y2="12"/><line x1="4.2" y1="19.8" x2="6" y2="18"/><line x1="18" y1="6" x2="19.8" y2="4.2"/></svg>
                    }
                    {m === 'dark' ? t('app.panel.dark') : t('app.panel.light')}
                  </button>
                ))}
              </div>
            </div>

            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--r2)',
              padding: '10px 12px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(139,92,246,.12)', color: '#8B5CF6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="2" y1="12" x2="22" y2="12"/>
                    <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/>
                  </svg>
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--t1)' }}>{t('app.panel.language')}</div>
              </div>
              <LanguageSwitcher className="panel" />
            </div>
          </div>

          {/* ── Logout ── */}
          <button
            onClick={logout}
            style={{
              width: '100%', marginTop: 8, padding: '13px',
              background: 'rgba(255,58,78,.07)', border: '1px solid rgba(255,58,78,.18)',
              borderRadius: 'var(--r2)', color: 'var(--red)',
              fontWeight: 700, fontSize: 14, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              fontFamily: 'inherit', transition: 'background .2s',
            }}
          >
            <IconLogout /> {t('app.panel.signOut')}
          </button>
        </div>
      </div>
    </div>
  );
}
