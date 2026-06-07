import type { Alert } from '../lib/api';

export default function AlertsPanel({ alerts }: { alerts: Alert[] }) {
  return (
    <section className="card">
      <div className="section-header">
        <div>
          <p className="eyebrow">Signals</p>
          <h2>Recent Alerts</h2>
        </div>
        <span className="pill">{alerts.length}</span>
      </div>

      <div className="stack">
        {alerts.length === 0 && <p className="muted">No alerts triggered yet.</p>}
        {alerts.slice(0, 12).map((alert) => (
          <article key={alert.id} className="alert-item">
            <div className="row">
              <strong>{alert.ticker}</strong>
              <span>${Number(alert.price).toFixed(2)}</span>
            </div>
            <p>{alert.strategy_name || 'Strategy matched'}</p>
            <small>{new Date(alert.triggered_at).toLocaleString()}</small>
          </article>
        ))}
      </div>
    </section>
  );
}
