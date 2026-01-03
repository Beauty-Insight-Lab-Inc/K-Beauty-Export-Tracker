'use client';

import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    BarChart, Bar, Cell
} from 'recharts';
import { IndicatorData } from '@/lib/types/indicators';
import { useMemo } from 'react';

interface TrendsChartProps {
    cn: IndicatorData;
    us: IndicatorData;
    jp: IndicatorData;
    fr: IndicatorData;
    mx: IndicatorData;
    ae: IndicatorData;
    others: IndicatorData;
}

export default function TrendsChart({ cn, us, jp, fr, mx, ae, others }: TrendsChartProps) {
    // Merge histories into a single array
    const chartData = useMemo(() => {
        if (!cn.history || !us.history || !jp.history || !fr.history || !mx.history || !ae.history || !others.history) return [];

        const merged = cn.history.map((h, i) => {
            // Helper to get weight from val/price
            const getWgt = (val: number, price: number) => (price > 0 ? (val * 1_000_000) / price : 0);

            const usVal = us.history?.[i]?.value || 0;
            const jpVal = jp.history?.[i]?.value || 0;
            const frVal = fr.history?.[i]?.value || 0;
            const mxVal = mx.history?.[i]?.value || 0;
            const aeVal = ae.history?.[i]?.value || 0;
            const othersVal = others.history?.[i]?.value || 0;
            const cnVal = h.value;

            const usUnit = us.history?.[i]?.unitPrice || 0;
            const jpUnit = jp.history?.[i]?.unitPrice || 0;
            const frUnit = fr.history?.[i]?.unitPrice || 0;
            const mxUnit = mx.history?.[i]?.unitPrice || 0;
            const aeUnit = ae.history?.[i]?.unitPrice || 0;
            const othersUnit = others.history?.[i]?.unitPrice || 0;
            const cnUnit = h.unitPrice || 0;

            const nonChinaVal = usVal + jpVal + frVal + mxVal + aeVal + othersVal;
            const totalVal = nonChinaVal + cnVal;

            // Calculate Non-China Aggregate Unit Price
            const nonChinaWgt = getWgt(usVal, usUnit) + getWgt(jpVal, jpUnit) + getWgt(frVal, frUnit) +
                getWgt(mxVal, mxUnit) + getWgt(aeVal, aeUnit) + getWgt(othersVal, othersUnit);

            const nonChinaUnit = nonChinaWgt > 0 ? (nonChinaVal * 1_000_000) / nonChinaWgt : 0;

            return {
                // Format: "1월" - Use numeric month to avoid skipping
                date: `${new Date(h.date).getMonth() + 1}월`,
                fullDate: h.date,
                China: parseFloat(cnVal.toFixed(1)),
                'Non-China': parseFloat(nonChinaVal.toFixed(1)),
                US: usVal,
                Japan: jpVal,
                France: frVal,
                Mexico: mxVal,
                UAE: aeVal,
                Others: othersVal,

                // Unit Prices for Tooltip
                unitChina: parseFloat(cnUnit.toFixed(1)),
                unitNonChina: parseFloat(nonChinaUnit.toFixed(1)),
                unitUS: parseFloat(usUnit.toFixed(1)),
                unitJapan: parseFloat(jpUnit.toFixed(1)),
                unitFrance: parseFloat(frUnit.toFixed(1)),
                unitMexico: parseFloat(mxUnit.toFixed(1)),
                unitUAE: parseFloat(aeUnit.toFixed(1)),
                unitOthers: parseFloat(othersUnit.toFixed(1)),

                // Calculate percentages for Stacked Bar
                pctChina: (cnVal / totalVal) * 100,
                pctUS: (usVal / totalVal) * 100,
                pctJapan: (jpVal / totalVal) * 100,
                pctFrance: (frVal / totalVal) * 100,
                pctMexico: (mxVal / totalVal) * 100,
                pctUAE: (aeVal / totalVal) * 100,
                pctOthers: (othersVal / totalVal) * 100,
            };
        });

        const result = merged;
        console.log('[TrendsChart] Chart data dates:', result.map(d => `${d.fullDate} -> ${d.date}`));
        return result;
    }, [cn, us, jp, fr, mx, ae, others]);

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Main Chart: China vs Non-China (Structural Shift) */}
            <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-6 shadow-sm">
                <div className="mb-6">
                    <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
                        📊 Structural Shift: China vs Non-China
                    </h3>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
                        탈중국(Ex-China) 현상이 가속화되며 비중국 수출액이 중국을 추월하는 골든크로스(Golden Cross) 관찰
                    </p>
                </div>

                <div className="w-full h-[300px]" style={{ width: '100%', height: 300 }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E4E4E7" />
                            <XAxis
                                dataKey="date"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fontSize: 12, fill: '#71717A' }}
                                dy={10}
                            />
                            <YAxis
                                axisLine={false}
                                tickLine={false}
                                tick={{ fontSize: 12, fill: '#71717A' }}
                                tickFormatter={(val) => `$${val}`}
                            />
                            <Tooltip
                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                formatter={(value: any, name: any, props: any) => {
                                    const unitKey = name === 'China' ? 'unitChina' : 'unitNonChina';
                                    const unitPrice = props.payload[unitKey];
                                    return [`$${value.toFixed(1)}M${unitPrice ? ` ($${unitPrice}/kg)` : ''}`, name];
                                }}
                                labelFormatter={(label) => {
                                    const item = chartData.find(d => d.date === label);
                                    if (item?.fullDate) {
                                        const date = new Date(item.fullDate);
                                        return `${date.getFullYear()}년 ${date.getMonth() + 1}월`;
                                    }
                                    return label;
                                }}
                            />
                            <Legend verticalAlign="top" height={36} iconType="circle" />
                            <Line
                                type="monotone"
                                dataKey="China"
                                stroke="#e11d48" // Report Rose
                                strokeWidth={3}
                                dot={{ r: 4, strokeWidth: 2 }}
                                activeDot={{ r: 6 }}
                            />
                            <Line
                                type="monotone"
                                dataKey="Non-China"
                                stroke="#1e3a8a" // Report Navy
                                strokeWidth={3}
                                dot={{ r: 4, strokeWidth: 2 }}
                                activeDot={{ r: 6 }}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Sub Chart: Regional Portfolio (Stacked Bar) */}
            <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-6 shadow-sm">
                <div className="mb-6">
                    <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
                        🌎 Regional Portfolio (M/S)
                    </h3>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
                        국가별 수출 비중 변화 (100% Stacked)
                    </p>
                </div>

                <div className="w-full h-[300px]" style={{ width: '100%', height: 300 }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }} stackOffset="expand">
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E4E4E7" />
                            <XAxis
                                dataKey="date"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fontSize: 12, fill: '#71717A' }}
                                dy={10}
                            />
                            <YAxis
                                axisLine={false}
                                tickLine={false}
                                tick={{ fontSize: 12, fill: '#71717A' }}
                                tickFormatter={(val) => `${(val * 100).toFixed(0)}%`}
                            />
                            <Tooltip
                                cursor={{ fill: 'transparent' }}
                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                formatter={(value: any, name: any, props: any) => {
                                    const unitKey = `unit${name}`;
                                    const unitPrice = props.payload[unitKey];
                                    return [`${value.toFixed(1)}%${unitPrice ? ` ($${unitPrice}/kg)` : ''}`, name];
                                }}
                                labelFormatter={(label) => {
                                    const item = chartData.find(d => d.date === label);
                                    if (item?.fullDate) {
                                        const date = new Date(item.fullDate);
                                        return `${date.getFullYear()}년 ${date.getMonth() + 1}월`;
                                    }
                                    return label;
                                }}
                            />
                            <Legend verticalAlign="top" height={36} iconType="circle" />
                            <Bar dataKey="pctOthers" name="Others" stackId="a" fill="#0d9488" />
                            <Bar dataKey="pctUAE" name="UAE" stackId="a" fill="#8b5cf6" />
                            <Bar dataKey="pctMexico" name="Mexico" stackId="a" fill="#10b981" />
                            <Bar dataKey="pctFrance" name="France" stackId="a" fill="#3b82f6" />
                            <Bar dataKey="pctJapan" name="Japan" stackId="a" fill="#f59e0b" />
                            <Bar dataKey="pctUS" name="US" stackId="a" fill="#1e3a8a" />
                            <Bar dataKey="pctChina" name="China" stackId="a" fill="#e11d48" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
}
