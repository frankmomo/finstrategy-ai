import type { Strategy } from '../lib/api';

type Props = {
  strategies: Strategy[];
  onUpload: (file: File) => void;
  uploading: boolean;
};

export default function ActiveStrategies({ strategies, onUpload, uploading }: Props) {
  return (
    <section className="card">
      <div className="section-header">
        <div>
          <p className="eyebrow">Strategies</p>
          <h2>Active Strategies</h2>
        </div>
        <label className="button">
          {uploading ? 'Parsing...' : 'Upload Image'}
          <input
            hidden
            type="file"
            accept="image/*"
            disabled={uploading}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) onUpload(file);
            }}
          />
        </label>
      </div>

      <div className="stack">
        {strategies.length === 0 && <p className="muted">No strategies yet. Upload a screenshot to digitize one.</p>}
        {strategies.map((strategy) => (
          <article key={strategy.id} className="strategy-item">
            <div className="row">
              <strong>{strategy.name}</strong>
              <span className={`status ${strategy.status}`}>{strategy.status}</span>
            </div>
            <p className="muted">
              {strategy.tickers.join(', ')} · {strategy.timeframe} · {strategy.rules.conditions?.length || 0} conditions
            </p>
            <div className="conditions">
              {(strategy.rules.conditions || []).slice(0, 4).map((condition, index) => (
                <code key={index}>
                  {String(condition.indicator)} {String(condition.operator)}{' '}
                  {condition.value ? String(condition.value) : 'indicator'}
                </code>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
