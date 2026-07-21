import { useEffect, useState } from 'react';
import { useStore } from '../lib/store';
import { buildBinanceMarkets } from '../lib/markets';
import { assignInitialPayouts } from '../lib/payoutEngine';

export default function SplashScreen() {
  const setScreen        = useStore(s => s.setScreen);
  const setMarkets       = useStore(s => s.setMarkets);
  const setCurrentMarket = useStore(s => s.setCurrentMarket);
  const userInfo         = useStore(s => s.userInfo);
  const [progress, setProgress] = useState(0);
  const [status, setStatus]     = useState('Connecting to markets...');

  useEffect(() => {
    let p = 0;
    const iv = setInterval(() => {
      p = Math.min(p + Math.random() * 8 + 3, 88);
      setProgress(p);
    }, 100);

    async function load() {
      try {
        setStatus('Loading live Binance pairs...');
        const raw = await buildBinanceMarkets();
        const markets = assignInitialPayouts(raw);

        setStatus('Preparing platform...');
        setProgress(95);
        setMarkets(markets);
        setCurrentMarket(markets[0]);
        clearInterval(iv);
        await new Promise(r => setTimeout(r, 300));
        setProgress(100);
        await new Promise(r => setTimeout(r, 400));
        setScreen(userInfo ? 'trading' : 'landing');
      } catch {
        setStatus('Using demo data...');
        const raw = await buildBinanceMarkets();
        const markets = assignInitialPayouts(raw);
        setMarkets(markets);
        setCurrentMarket(markets[0]);
        clearInterval(iv);
        setProgress(100);
        await new Promise(r => setTimeout(r, 300));
        setScreen(userInfo ? 'trading' : 'landing');
      }
    }

    load();
    return () => clearInterval(iv);
  }, []);

  return (
    <div className="splash">
      <div className="splash-bg" />
      <div className="splash-grid" />

      {/* Animated particle dots */}
      <div className="splash-particles">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="splash-particle" style={{ animationDelay: `${i * 0.2}s`, left: `${10 + i * 7}%` }} />
        ))}
      </div>

      <div className="splash-logo-wrap">
        {/* X-only logo mark */}
        <div className="splash-logo">
          <svg width="42" height="42" viewBox="0 0 42 42" fill="none">
            <rect x="6" y="17.75" width="30" height="6.5" rx="3.25" fill="#fff" fillOpacity="0.95" transform="rotate(45 21 21)"/>
            <rect x="6" y="17.75" width="30" height="6.5" rx="3.25" fill="#fff" fillOpacity="0.7" transform="rotate(-45 21 21)"/>
          </svg>
        </div>
        <div className="splash-logo-text">OXIER</div>
        <div className="splash-tagline">Professional Trading Platform</div>
      </div>

      <div className="splash-progress-wrap">
        <div className="splash-progress-bar">
          <div className="splash-progress-fill" style={{ width: `${progress}%` }} />
        </div>
        <div className="splash-status">{status}</div>
      </div>

      <div className="splash-version">v3.0.0 · Powered by Binance</div>
    </div>
  );
}
