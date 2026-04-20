'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { format } from 'date-fns';
import type { DaySummary } from '@/lib/sleepLogic';

interface NightWakingsChartProps {
  data: DaySummary[];
}

export function NightWakingsChart({ data }: NightWakingsChartProps) {
  const chartData = data.map((d) => ({
    date: format(new Date(d.date + 'T00:00:00'), 'M/d'),
    Wakings: d.nightWakingCount,
  }));

  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
        <Tooltip />
        <Bar dataKey="Wakings" fill="#818cf8" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
