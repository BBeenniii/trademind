import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import type { DrawdownPoint, EquityPoint } from '../types';
import { dateTime, money, percent } from '../format';

export function EquityCurveChart({ data }: { data: EquityPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }} className="chart-grid">
        <CartesianGrid stroke="#26303d" strokeDasharray="3 3" />
        <XAxis dataKey="timestamp" tickFormatter={dateTime} minTickGap={32} stroke="#506070" />
        <YAxis tickFormatter={(value) => money(Number(value))} stroke="#506070" width={76} />
        <Tooltip
          contentStyle={{ background: '#11151c', border: '1px solid #26303d', borderRadius: 6 }}
          formatter={(value) => money(Number(value))}
          labelFormatter={(value) => dateTime(String(value))}
        />
        <Line type="monotone" dataKey="equity" dot={false} stroke="#38d39f" strokeWidth={2} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function DrawdownChart({ data }: { data: DrawdownPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }} className="chart-grid">
        <CartesianGrid stroke="#26303d" strokeDasharray="3 3" />
        <XAxis dataKey="timestamp" tickFormatter={dateTime} minTickGap={32} stroke="#506070" />
        <YAxis tickFormatter={(value) => percent(Number(value), 0)} stroke="#506070" width={64} />
        <Tooltip
          contentStyle={{ background: '#11151c', border: '1px solid #26303d', borderRadius: 6 }}
          formatter={(value) => percent(Number(value), 2)}
          labelFormatter={(value) => dateTime(String(value))}
        />
        <Line type="monotone" dataKey="drawdown" dot={false} stroke="#ff6876" strokeWidth={2} />
      </LineChart>
    </ResponsiveContainer>
  );
}