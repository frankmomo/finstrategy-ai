import { useEffect, useRef } from 'react';
import { createChart, ColorType, type IChartApi } from 'lightweight-charts';
import type { MarketBar } from '../lib/api';

type Props = {
  ticker: string;
  history: MarketBar[];
};

export default function LiveChart({ ticker, history }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      height: 420,
      layout: {
        background: { type: ColorType.Solid, color: '#0b1020' },
        textColor: '#9ca3af',
      },
      grid: {
        vertLines: { color: '#1f2937' },
        horzLines: { color: '#1f2937' },
      },
      rightPriceScale: { borderColor: '#374151' },
      timeScale: { borderColor: '#374151' },
    });

    chartRef.current = chart;
    const series = chart.addCandlestickSeries({
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderVisible: false,
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
    });

    series.setData(
      history.map((bar) => ({
        time: Math.floor(new Date(bar.ts).getTime() / 1000) as never,
        open: Number(bar.open),
        high: Number(bar.high),
        low: Number(bar.low),
        close: Number(bar.close),
      })),
    );
    chart.timeScale().fitContent();

    const resize = () => {
      if (containerRef.current) chart.applyOptions({ width: containerRef.current.clientWidth });
    };
    resize();
    window.addEventListener('resize', resize);

    return () => {
      window.removeEventListener('resize', resize);
      chart.remove();
      chartRef.current = null;
    };
  }, [history, ticker]);

  return (
    <section className="card chart-card">
      <div className="section-header">
        <div>
          <p className="eyebrow">Live chart</p>
          <h2>{ticker} OHLCV</h2>
        </div>
        <span className="pill">{history.length} bars</span>
      </div>
      <div ref={containerRef} className="chart-container" />
    </section>
  );
}
