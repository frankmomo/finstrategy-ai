type NewsItem = {
  title?: string;
  text?: string;
  site?: string;
  url?: string;
  publishedDate?: string;
};

export default function NewsFeed({ ticker, news }: { ticker: string; news: NewsItem[] }) {
  return (
    <section className="card">
      <div className="section-header">
        <div>
          <p className="eyebrow">Filtered news</p>
          <h2>{ticker}</h2>
        </div>
      </div>

      <div className="stack">
        {news.length === 0 && <p className="muted">No news provider configured yet.</p>}
        {news.slice(0, 8).map((item, index) => (
          <a key={`${item.url}-${index}`} className="news-item" href={item.url || '#'} target="_blank" rel="noreferrer">
            <strong>{item.title || 'Untitled market update'}</strong>
            <span>{item.site || 'Financial Modeling Prep'}</span>
            <p>{(item.text || '').slice(0, 140)}</p>
          </a>
        ))}
      </div>
    </section>
  );
}
