import {
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import type { EquityPoint, MarketData } from '../types';
import { dateTime } from '../format';

type ChartPoint = {
  timestamp: string;
  close: number;
  buy?: number;
  sell?: number;
};

export function PriceChart({ marketData, equityCurve = [] }: { marketData: MarketData[]; equityCurve?: EquityPoint[] }) {
  const signalsByTime = new Map(equityCurve.map((point) => [point.timestamp, point.signal]));
  const points: ChartPoint[] = marketData.slice(-160).map((row) => {
    const signal = signalsByTime.get(row.timestamp);
    return {
      timestamp: row.timestamp,
      close: row.close,
      buy: signal === 'BUY' ? row.close : undefined,
      sell: signal === 'SELL' ? row.close : undefined
    };
  });

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={points} margin={{ top: 8, right: 12, bottom: 0, left: 0 }} className="chart-grid">
        <CartesianGrid stroke="#26303d" strokeDasharray="3 3" />
        <XAxis dataKey="timestamp" tickFormatter={dateTime} minTickGap={32} stroke="#506070" />
        <YAxis domain={['dataMin - 0.003', 'dataMax + 0.003']} stroke="#506070" width={56} />
        <Tooltip
          contentStyle={{ background: '#11151c', border: '1px solid #26303d', borderRadius: 6 }}
          labelFormatter={(value) => dateTime(String(value))}
        />
        <Line type="monotone" dataKey="close" dot={false} stroke="#d6e2f0" strokeWidth={2} />
        <Scatter dataKey="buy" fill="#38d39f" />
        <Scatter dataKey="sell" fill="#ff6876" />
      </ComposedChart>
    </ResponsiveContainer>
  );
}