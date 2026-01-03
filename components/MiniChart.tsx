'use client';

import { HistoricalDataPoint } from '@/lib/types/indicators';
import { LineChart, Line, ResponsiveContainer, YAxis, Tooltip } from 'recharts';

interface MiniChartProps {
  data: HistoricalDataPoint[];
  isPositive: boolean;
}

export default function MiniChart({ data, isPositive }: MiniChartProps) {
  if (!data || data.length === 0) {
    return null;
  }

  const color = isPositive ? '#16a34a' : '#dc2626';

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <YAxis domain={['auto', 'auto']} hide />
          <Tooltip
            contentStyle={{
              borderRadius: '8px',
              border: 'none',
              boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
              fontSize: '12px'
            }}
            formatter={(value: number) => [`$${value.toFixed(1)}M`, '']}
            labelFormatter={(label, payload) => {
              // Use the date from the actual data point
              if (payload && payload[0] && payload[0].payload.date) {
                const date = new Date(payload[0].payload.date);
                return `${date.getFullYear()}년 ${date.getMonth() + 1}월`;
              }
              return label;
            }}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            dot={false}
            animationDuration={300}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
