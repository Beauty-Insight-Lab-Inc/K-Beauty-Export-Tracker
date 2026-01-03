import { CustomsExportData, IndicatorData, HistoricalDataPoint } from '../types/indicators';

// Valid Data.go.kr Country Codes
const COUNTRY_CODES: Record<string, string> = {
    'US': 'US',
    'CN': 'CN',
    'JP': 'JP',
};

// Interface for API Response Item
interface TradeItem {
    balIp: string;
    statCd: string;
    expDlr: string; // API returns string
    expWgt: string; // API returns string
    year: string;
    month: string;
}

// ==========================================
// Main Data Fetcher
// ==========================================

export async function getKBeautyExportData(hsCode: string = '3304', hsCode2?: string): Promise<CustomsExportData[]> {
    console.log(`[KoreaCustoms] getKBeautyExportData 호출 (HS: ${hsCode}${hsCode2 ? '+' + hsCode2 : ''})`);

    // 1. Try Real Data
    if (process.env.KOREA_CUSTOMS_API_KEY) {
        // console.log('[KoreaCustoms] API 키 발견 - 실제 데이터 조회 시도');
        const realData = await fetchFromProxy(hsCode, hsCode2);

        if (realData && realData.length > 0) {
            return realData;
        }
    }

    // 2. Fallback (Only if API Key missing or fatal error)
    // If specific HS code requested and failed, return empty to avoid misleading generic mock data
    if (hsCode !== '3304') {
        console.warn('[KoreaCustoms] 특정 HS Code 조회 실패, 빈 데이터 반환');
        return createEmptyData();
    }

    console.log('[KoreaCustoms] API 키 없음 또는 조회 실패 - Mock 데이터 사용');
    // Simulator latency
    await new Promise(resolve => setTimeout(resolve, 800));
    return getMockData();
}

// ==========================================
// Proxy / Aggregation Logic
// ==========================================

async function fetchFromProxy(hsCode: string, hsCode2?: string): Promise<CustomsExportData[] | null> {
    try {
        const today = new Date();
        const lastMonth = new Date(today);
        lastMonth.setDate(1);
        lastMonth.setMonth(lastMonth.getMonth() - 1);

        const toYYYYMM = (date: Date) => {
            const y = date.getFullYear();
            const m = (date.getMonth() + 1).toString().padStart(2, '0');
            return `${y}${m}`;
        };

        const period2End = new Date(lastMonth);
        const period2Start = new Date(lastMonth);
        period2Start.setMonth(period2Start.getMonth() - 11);

        const period1End = new Date(period2Start);
        period1End.setMonth(period1End.getMonth() - 1);
        const period1Start = new Date(period1End);
        period1Start.setMonth(period1Start.getMonth() - 11);

        // Helper to fetch for one period and one code
        const fetchPeriod = async (start: Date, end: Date, code: string) => {
            // Import dynamically or use directly if valid context
            try {
                // If we are strictly server-side, we can call the service directly.
                // However, we need to handle the import.
                // Since this runs in Next.js API Routes, we can use the service.
                const { fetchStandardizedCustomsData } = await import('./customs-service');
                const result = await fetchStandardizedCustomsData({
                    strtYymm: toYYYYMM(start),
                    endYymm: toYYYYMM(end),
                    hsCode: code
                });
                return (result.success && result.data) ? result.data : [];
            } catch (e) {
                console.error('[KoreaCustoms] Direct Service Call Error:', e);
                return [];
            }
        };

        // Fetch Data
        // Always 24 months (2 periods)
        const p1 = await fetchPeriod(period1Start, period1End, hsCode);
        const p2 = await fetchPeriod(period2Start, period2End, hsCode);
        let items = [...p1, ...p2];

        // If 2nd code exists (Matrix aggregation)
        if (hsCode2) {
            const p1_2 = await fetchPeriod(period1Start, period1End, hsCode2);
            const p2_2 = await fetchPeriod(period2Start, period2End, hsCode2);
            items = [...items, ...p1_2, ...p2_2];
        }

        // console.log(`[KoreaCustoms] 병합된 데이터: ${items.length}개 항목`);

        // Aggregation: Month -> Country -> { val, wgt }
        const monthlyData: Record<string, { [key: string]: { val: number, wgt: number } }> = {};
        const allMonths = new Set<string>();

        items.forEach((item: any) => {
            const yearStr = String(item.year || '');
            if (yearStr.includes('총계') || yearStr === '총계') return;

            let year = item.year;
            let month = item.month;

            // Flex parsing
            if (!month && year) {
                if (yearStr.includes('.')) {
                    const parts = yearStr.split('.');
                    year = parts[0];
                    month = parts[1];
                } else if (yearStr.length === 6) {
                    year = yearStr.substring(0, 4);
                    month = yearStr.substring(4, 6);
                }
            }
            if (!month) month = '01';

            const dateStr = `${year}-${String(month).padStart(2, '0')}-01`;
            allMonths.add(dateStr);

            if (!monthlyData[dateStr]) monthlyData[dateStr] = {
                total: { val: 0, wgt: 0 },
                others: { val: 0, wgt: 0 }
            };

            const val = parseFloat(item.expDlr || '0') / 1_000_000; // Million USD
            const wgt = parseFloat(item.expWgt || '0'); // kg

            // Accumulate Total
            monthlyData[dateStr].total.val += val;
            monthlyData[dateStr].total.wgt += wgt;

            const code = item.statCd ? item.statCd.toString().trim().toUpperCase() : 'OTHER';
            const target = ['US', 'CN', 'JP', 'FR', 'MX', 'AE'].includes(code) ? code : 'others';

            if (target === 'others') {
                monthlyData[dateStr].others.val += val;
                monthlyData[dateStr].others.wgt += wgt;
            } else {
                if (!monthlyData[dateStr][target]) monthlyData[dateStr][target] = { val: 0, wgt: 0 };
                monthlyData[dateStr][target].val += val;
                monthlyData[dateStr][target].wgt += wgt;
            }
        });

        const sortedMonths = Array.from(allMonths).sort();

        // Check for incomplete current month (20th rule)
        // If current month & date < 20 & value very low compared to 3-month avg -> drop it
        if (sortedMonths.length >= 4) {
            const lastDateStr = sortedMonths[sortedMonths.length - 1];
            const lastDate = new Date(lastDateStr);
            const now = new Date();

            if (lastDate.getMonth() === now.getMonth() && lastDate.getFullYear() === now.getFullYear() && now.getDate() < 20) {
                const d = monthlyData[lastDateStr]?.total?.val || 0;
                // Calc avg of prev 3 months
                let sum = 0;
                for (let i = 2; i <= 4; i++) {
                    const prevDate = sortedMonths[sortedMonths.length - i];
                    if (prevDate) sum += (monthlyData[prevDate]?.total?.val || 0);
                }
                const avg = sum / 3;

                // If less than 1% of average, it's likely incomplete start of month
                if (d < avg * 0.01) {
                    console.log(`[KoreaCustoms] Dropping incomplete month ${lastDateStr}`);
                    sortedMonths.pop();
                }
            }
        }

        // Helper to format history point with Unit Price
        const formatHistory = (target: string, date: string): HistoricalDataPoint => {
            const d = monthlyData[date][target] || { val: 0, wgt: 0 };
            let unitPrice = 0;
            if (d.wgt > 0) {
                // Value (M$) * 1,000,000 / Weight (kg) = $/kg
                unitPrice = (d.val * 1_000_000) / d.wgt;
            }
            return {
                date,
                value: parseFloat(d.val.toFixed(2)),
                unitPrice: parseFloat(unitPrice.toFixed(2))
            };
        };

        // Construct Country History
        const countryHistory: Record<string, HistoricalDataPoint[]> = {
            'Total': [], 'US': [], 'CN': [], 'JP': [], 'FR': [], 'MX': [], 'AE': [], 'Others': []
        };

        sortedMonths.forEach(date => {
            countryHistory['Total'].push(formatHistory('total', date));
            countryHistory['Others'].push(formatHistory('others', date));
            const countries = ['US', 'CN', 'JP', 'FR', 'MX', 'AE'];
            countries.forEach(c => countryHistory[c].push(formatHistory(c, date)));
        });

        // Format Output
        const format = (code: string, name: string): CustomsExportData => {
            const hist = countryHistory[code === 'KR' ? 'Total' : (code === 'OT' ? 'Others' : code)];
            const last = hist[hist.length - 1];
            return {
                countryName: name,
                countryCode: code,
                currentValue: last ? last.value : 0,
                history: hist,
                lastUpdated: new Date().toISOString(),
                isLive: true
            };
        };

        return [
            format('KR', 'Total Export (총수출)'),
            format('US', 'USA (미국)'),
            format('CN', 'China (중국)'),
            format('JP', 'Japan (일본)'),
            format('FR', 'France (프랑스)'),
            format('MX', 'Mexico (멕시코)'),
            format('AE', 'UAE (아랍에미리트)'),
            format('OT', 'Others (기타)')
        ];

    } catch (error) {
        console.error('[KoreaCustoms] Proxy Fetch Error:', error);
        return null;
    }
}

// ==========================================
// Converter
// ==========================================

export function convertToIndicator(data: CustomsExportData): IndicatorData {
    // Filter out invalid "총계" rows (legacy check)
    const validHistory = data.history.filter(h => !h.date.includes('총계'));

    // Use the last valid data point as current value
    const current = validHistory.length > 0 ? validHistory[validHistory.length - 1].value : data.currentValue;
    const history = validHistory;

    // 1 Month Change (MoM)
    const prev1M = history[history.length - 2]?.value || current;
    const change = current - prev1M;
    const changePercent = prev1M !== 0 ? (change / prev1M) * 100 : 0;

    // YoY Change
    let yoyChange = 0;
    let yoyPercent = 0;

    if (history.length >= 13) {
        const currentDate = new Date(history[history.length - 1].date);
        const yoyDate = new Date(currentDate);
        yoyDate.setFullYear(yoyDate.getFullYear() - 1);
        const yoyDateStr = `${yoyDate.getFullYear()}-${String(yoyDate.getMonth() + 1).padStart(2, '0')}`;
        const yoyData = history.find(h => h.date.startsWith(yoyDateStr));

        if (yoyData) {
            yoyChange = current - yoyData.value;
            yoyPercent = yoyData.value !== 0 ? (yoyChange / yoyData.value) * 100 : 0;
        } else {
            const prev12M = history[history.length - 13]?.value || current;
            yoyChange = current - prev12M;
            yoyPercent = prev12M !== 0 ? (yoyChange / prev12M) * 100 : 0;
        }
    }

    return {
        name: data.countryName,
        symbol: data.countryCode,
        value: current,
        change,
        changePercent: parseFloat(changePercent.toFixed(1)),
        change30d: yoyChange,
        changePercent30d: parseFloat(yoyPercent.toFixed(1)), // YoY %

        lastUpdated: data.lastUpdated,
        unit: 'M$',
        history: history.slice(-24), // Keep last 24 months
        countryCode: data.countryCode,
        isExportData: true,
        isLive: data.isLive
    };
}


// ==========================================
// Mocks & Helpers
// ==========================================

function createEmptyData(): CustomsExportData[] {
    const emptyHist = [{ date: new Date().toISOString().slice(0, 7), value: 0 }];
    const empty = (code: string, name: string) => ({
        countryName: name, countryCode: code, currentValue: 0, history: emptyHist, lastUpdated: new Date().toISOString()
    });
    return [
        empty('KR', 'Total Export (총수출)'), empty('US', 'USA (미국)'), empty('CN', 'China (중국)'), empty('JP', 'Japan (일본)'),
        empty('FR', 'France (프랑스)'), empty('MX', 'Mexico (멕시코)'), empty('AE', 'UAE (아랍에미리트)'), empty('OT', 'Others (기타)')
    ];
}

function getMockData(): CustomsExportData[] {
    const getHist = (base: number, volatility: number) => {
        const h = [];
        let v = base;
        for (let i = 0; i < 24; i++) {
            const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - (23 - i));
            v = v * (1 + (Math.random() * volatility - (volatility / 2)));
            h.push({ date: d.toISOString().slice(0, 10), value: parseFloat(v.toFixed(1)) });
        }
        return h;
    };

    const format = (code: string, name: string, base: number) => ({
        countryName: name, countryCode: code, currentValue: base, history: getHist(base, 0.1), lastUpdated: new Date().toISOString()
    });

    return [
        format('KR', 'Total Export (총수출)', 300),
        format('US', 'USA (미국)', 60),
        format('CN', 'China (중국)', 100),
        format('JP', 'Japan (일본)', 40),
        format('FR', 'France (프랑스)', 10),
        format('MX', 'Mexico (멕시코)', 5),
        format('AE', 'UAE (아랍에미리트)', 8),
        format('OT', 'Others (기타)', 70)
    ];
}
