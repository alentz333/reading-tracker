'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { format } from 'date-fns';
import type { DaySummary } from '@/lib/sleepLogic';

interface DailySleepChartProps {
  data: DaySummary[];
}

function minutesToHours(m: number) {
  return Math.round((m / 60) * 10) / 10;
}

export function DailySleepChart({ data }: DailySleepChartProps) {
  const chartData = data.map((d) => ({
    date: format(new Date(d.date + 'T00:00:00'), 'M/d'),
    'Day sleep': minutesToHours(d.napMinutes),
    'Night sleep': minutesToHours(d.nightMinutes),
  }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
        <YAxis unit="h" tick={{ fontSize: 11 }} />
        <Tooltip formatter={(v) => [`${v}h`, '']} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="Day sleep" stackId="a" fill="#fbbf24" radius={[0, 0, 0, 0]} />
        <Bar dataKey="Night sleep" stackId="a" fill="#6366f1" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
