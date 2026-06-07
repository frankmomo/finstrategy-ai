import { useEffect, useMemo, useState } from 'react';
import ActiveStrategies from '../components/ActiveStrategies';
import AlertsPanel from '../components/AlertsPanel';
import ChatPanel from '../components/ChatPanel';
import LiveChart from '../components/LiveChart';
import NewsFeed from '../components/NewsFeed';
import { apiGet, TICKERS, uploadStrategyImage, type Alert, type MarketBar, type Strategy } from '../lib/api';

export default function Dashboard() {
  const [ticker, setTicker] = useState('SPY');
  const [latest, setLatest] = useState<Record<string, MarketBar>>({});
  const [history, setHistory] = useState<MarketBar[]>([]);
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [news, setNews] = useState<Array<Record<string, string>>>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refreshCore() {
    const [latestData, strategiesData, alertsData] = await Promise.all([
      apiGet<Record<string, MarketBar>>('/market/latest'),
      apiGet<Strategy[]>('/strategies'),
      apiGet<Alert[]>('/alerts'),
    ]);
    setLatest(latestData);
    setStrategies(strategiesData);
    setAlerts(alertsData);
  }

  useEffect(() => {
    refreshCore().catch((err) => setError(err.message));
    const timer = window.setInterval(() => {
      refreshCore().catch(() => undefined);
    }, 5000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    apiGet<MarketBar[]>(`/market/history/${ticker}`).then(setHistory).catch(() => setHistory([]));
    apiGet<Array<Record<string, string>>>(`/news/${ticker}`).then(setNews).catch(() => setNews([]));
  }, [ticker]);

  const activeCount = useMemo(() => strategies.filter((strategy) => strategy.status === 'active').length, [strategies]);

  async function handleUpload(file: File) {
    setUploading(true);
    setError(null);
    try {
      await uploadStrategyImage(file, `Strategy ${new Date().toLocaleDateString()}`);
      await refreshCore();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  return (
    <main>
      <header className="hero">
        <div>
          <p className="eyebrow">FinStrategy Engine</p>
          <h1>Real-time strategy intelligence for liquid US equities.</h1>
          <p className="muted">
            Polygon OHLCV ingestion, GPT-4o strategy digitization, deterministic rule evaluation, and alert audit trail.
          </p>
        </div>
        <div className="metrics">
          <div>
            <span>{TICKERS.length}</span>
            <small>tickers</small>
          </div>
          <div>
            <span>{activeCount}</span>
            <small>active</small>
          </div>
          <div>
            <span>{alerts.length}</span>
            <small>alerts</small>
          </div>
        </div>
      </header>

      {error && <div className="error">{error}</div>}

      <nav className="ticker-strip">
        {TICKERS.map((symbol) => (
          <button key={symbol} className={symbol === ticker ? 'selected' : ''} onClick={() => setTicker(symbol)}>
            <strong>{symbol}</strong>
            <span>{latest[symbol]?.close ? `$${Number(latest[symbol].close).toFixed(2)}` : '--'}</span>
          </button>
        ))}
      </nav>

      <div className="layout">
        <div className="main-column">
          <LiveChart ticker={ticker} history={history} />
          <AlertsPanel alerts={alerts} />
        </div>
        <aside className="side-column">
          <ChatPanel />
          <ActiveStrategies strategies={strategies} onUpload={handleUpload} uploading={uploading} />
          <NewsFeed ticker={ticker} news={news} />
        </aside>
      </div>

      <footer>Analysis only. No automatic order execution. Signals require human review.</footer>
    </main>
  );
}
