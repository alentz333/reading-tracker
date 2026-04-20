'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { format } from 'date-fns';
import type { SleepSession } from '@/lib/sleepLogic';
import { longestNightStretch, groupByDay } from '@/lib/sleepLogic';

interface LongestStretchChartProps {
  sessions: SleepSession[];
}

export function LongestStretchChart({ sessions }: LongestStretchChartProps) {
  const nightSessions = sessions.filter((s) => s.type === 'night');
  const byDay = groupByDay(nightSessions);

  const chartData = Array.from(byDay.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, daySessions]) => {
      const best = daySessions.reduce<number | null>((max, s) => {
        const v = longestNightStretch(s);
        if (v === null) return max;
        return max === null ? v : Math.max(max, v);
      }, null);

      return {
        date: format(new Date(date + 'T00:00:00'), 'M/d'),
        'Longest stretch (h)': best !== null ? Math.round((best / 60) * 10) / 10 : null,
      };
    });

  return (
    <ResponsiveContainer width="100%" height={180}>
      <LineChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
        <YAxis unit="h" tick={{ fontSize: 11 }} />
        <Tooltip formatter={(v) => [`${v}h`, '']} />
        <Line
          type="monotone"
          dataKey="Longest stretch (h)"
          stroke="#6366f1"
          strokeWidth={2}
          dot={{ r: 3 }}
          connectNulls
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
