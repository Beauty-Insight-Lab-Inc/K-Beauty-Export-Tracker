'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { DashboardData } from '@/lib/types/indicators';
import IndicatorCard from './IndicatorCard';
import AIPrediction from './AIPrediction';
import TrendsChart from './TrendsChart';
import { HSK_MAPPING, HSKItem, GROUP_LABELS } from '@/lib/constants/hsk';

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<6 | 12 | 18 | 24>(12);
  const [selectedItem, setSelectedItem] = useState<HSKItem>(HSK_MAPPING[0]);

  const filteredData = useMemo(() => {
    if (!data) return null;

    const sliceHistory = (history: any[]) => {
      if (!history) return [];
      // Ensure we don't slice if data is undefined, though it should be handled
      return history.slice(-timeRange);
    };

    const filterIndicator = (indicator: any) => {
      if (!indicator) return indicator;
      return {
        ...indicator,
        history: sliceHistory(indicator.history),
        // Recalculate change based on new range? 
        // MoM should stay same (last month). YoY depends. 
        // We only change 'history' for chart display as requested.
      };
    };

    return {
      ...data,
      indicators: {
        totalExport: filterIndicator(data.indicators.totalExport),
        usExport: filterIndicator(data.indicators.usExport),
        cnExport: filterIndicator(data.indicators.cnExport),
        jpExport: filterIndicator(data.indicators.jpExport),
        frExport: filterIndicator(data.indicators.frExport),
        mxExport: filterIndicator(data.indicators.mxExport),
        aeExport: filterIndicator(data.indicators.aeExport),
        othersExport: filterIndicator(data.indicators.othersExport),
      }
    };
  }, [data, timeRange]);

  const fetchIndicators = useCallback(async () => {
    try {
      console.log('========================================');
      console.log(`[Dashboard] 데이터 조회 시작 (Item: ${selectedItem.label})`);
      console.log('========================================');

      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      params.append('hsCode', selectedItem.hsCode);
      if (selectedItem.hsCode2) params.append('hsCode2', selectedItem.hsCode2);

      const response = await fetch(`/api/indicators?${params}`);
      console.log('[Dashboard] API 응답 상태:', response.status, response.statusText);

      if (!response.ok) {
        throw new Error('Failed to fetch indicators');
      }

      const dashboardData: DashboardData = await response.json();
      console.log('[Dashboard] 받은 데이터:', dashboardData);

      setData(dashboardData);
      console.log('[Dashboard] ✅ 데이터 설정 완료');
    } catch (err) {
      console.error('[Dashboard] ❌ 에러 발생:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [selectedItem]);

  useEffect(() => {
    fetchIndicators();

    const interval = setInterval(() => {
      fetchIndicators();
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [fetchIndicators]);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-zinc-200 dark:border-zinc-700 border-t-zinc-900 dark:border-t-zinc-50 rounded-full animate-spin"></div>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading market data...</p>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="text-red-500 text-5xl mb-4">⚠️</div>
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-2">
            Failed to load data
          </h3>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">{error}</p>
          <button
            onClick={fetchIndicators}
            className="px-4 py-2 bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 rounded-lg hover:bg-zinc-700 dark:hover:bg-zinc-200 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <div className="w-full">
      <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50 font-sans tracking-tight">
              K-Beauty Export Tracker
            </h1>

            {/* Live/Sim Badge */}
            {data && (
              <span className={`px-2.5 py-0.5 text-xs font-bold rounded-full border ${data.indicators.totalExport.isLive
                ? 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800'
                : 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800'
                }`}>
                {data.indicators.totalExport.isLive ? 'LIVE DATA' : 'SIMULATION'}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
            <span>
              Data Source:{' '}
              <a
                href="https://www.data.go.kr/data/15100475/openapi.do"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-zinc-800 dark:hover:text-zinc-200 hover:underline transition-colors"
              >
                Korea Customs Service via Public Data Portal (Open API)
              </a>
            </span>
            <span>•</span>
            <span>Updated: {data ? new Date(data.timestamp).toLocaleDateString() : '-'}</span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Item Selector */}
          <div className="relative group">
            <select
              value={selectedItem.id}
              onChange={(e) => {
                const item = HSK_MAPPING.find(i => i.id === e.target.value);
                if (item) setSelectedItem(item);
              }}
              className="w-full sm:w-[240px] appearance-none bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 pl-4 pr-10 py-2 rounded-lg text-sm font-medium hover:border-zinc-300 dark:hover:border-zinc-600 focus:outline-none focus:ring-2 focus:ring-zinc-500 transition-all shadow-sm cursor-pointer"
            >
              {Object.entries(GROUP_LABELS).map(([key, label]) => (
                <optgroup key={key} label={label}>
                  {HSK_MAPPING.filter(item => item.group === key).map(item => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-300 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </div>
          </div>

          {/* Time Range Filter */}
          <div className="flex bg-zinc-100 dark:bg-zinc-800 rounded-lg p-1 self-start sm:self-auto">
            {[6, 12, 18, 24].map((months) => (
              <button
                key={months}
                onClick={() => setTimeRange(months as any)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${timeRange === months
                  ? 'bg-white dark:bg-zinc-600 text-zinc-900 dark:text-zinc-50 shadow-sm'
                  : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                  }`}
              >
                {months}M
              </button>
            ))}
          </div>

          {/* About Button */}
          <button
            onClick={() => (document.getElementById('about-modal') as HTMLDialogElement)?.showModal()}
            className="px-4 py-2 text-sm font-medium text-zinc-600 bg-white border border-zinc-200 rounded-lg hover:bg-zinc-50 hover:text-zinc-900 transition-colors dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-700 whitespace-nowrap"
          >
            About
          </button>
        </div>
      </div>

      {/* 3401 Disclaimer */}
      {selectedItem.hsCode.startsWith('3401') && (
        <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg flex items-start gap-3">
          <span className="text-amber-500 mt-0.5">ⓘ</span>
          <p className="text-sm text-amber-800 dark:text-amber-200">
            본 데이터는 <strong>피부세척용 유기계면활성제품(3401.30)</strong> 통계를 기반으로 합니다.
            이는 폼 클렌저, 바디워시 등을 포함하나, 고형 비누 등은 제외될 수 있습니다.
          </p>
        </div>
      )}

      {/* About Modal */}
      <dialog id="about-modal" className="modal p-0 rounded-xl shadow-2xl backdrop:bg-black/50 w-full max-w-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
        <div className="p-6">
          <div className="flex justify-between items-start mb-4">
            <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">About K-Beauty Export Tracker (Beta)</h2>
            <form method="dialog">
              <button className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </form>
          </div>

          <div className="space-y-4 text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">
            <div>
              <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-1">🎯 기획 의도</h3>
              <p>본 대시보드는 2026년 화장품 산업의 핵심 키워드인 <strong>'수출 구조의 질적 성장'</strong>과 <strong>'글로벌 시장 다변화'</strong>를 실시간 데이터로 추적하기 위해 개발되었습니다.</p>
            </div>

            <div>
              <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-1">📊 핵심 차별점 및 지표</h3>
              <ul className="list-disc list-inside space-y-1 ml-1">
                <li><strong>HSK 2025 최신 분류 적용</strong>: 4자리(3304) 통계의 한계를 극복하기 위해, <strong>10자리 세부 품목 코드(HSK)</strong>를 기반으로 기초·색조·두발·세정류 데이터를 개별 호출합니다.</li>
                <li><strong>데이터 정합성 강화</strong>: 재질에 따라 분류가 나뉘는 마스크팩(3304/3307)과 세정제 특화 코드(3401) 등을 전문가 기준에 맞춰 정확히 매핑했습니다.</li>
                <li><strong>Structural Shift (Non-China Index)</strong>: 중국 의존도 축소와 북미·일본·유럽 등 신규 시장의 성장세(Golden Cross)를 시각화했습니다.</li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-1">💡 데이터 및 AI 활용 가이드</h3>
              <ul className="list-disc list-inside space-y-1 ml-1">
                <li><strong>데이터 출처</strong>: 공공데이터포털(관세청 품목별 국가별 수출입실적 API)의 공식 데이터를 실시간으로 연동합니다.</li>
                <li><strong>업데이트 주기</strong>: 매월 15일경 전월 확정치를 반영하여 현행화합니다.</li>
                <li><strong>AI 마켓 분석</strong>: 대규모 언어 모델(LLM)이 수치 데이터의 이상 징후와 트렌드를 요약합니다.</li>
              </ul>
            </div>

            <div className="bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg border border-amber-100 dark:border-amber-800">
              <h3 className="font-semibold text-amber-800 dark:text-amber-200 mb-1 text-xs">⚠️ 주의사항 (Disclaimer)</h3>
              <p className="text-xs text-amber-700 dark:text-amber-300">
                본 대시보드는 공공데이터포털의 관세청 API 데이터를 기반으로 AI가 분석한 참고용 정보입니다. 잠정치 데이터가 포함되어 있을 수 있으며, 최종 수치는 관세청 공식 통계 자료와 대조하시기 바랍니다.
              </p>
            </div>

            <div className="pt-2">
              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Developed by 박용락
              </p>

              <a href="mailto:yongrak@beautyinsightlab.com" className="text-blue-600 hover:underline dark:text-blue-400">yongrak@beautyinsightlab.com</a>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                데이터 분석 제휴 및 비즈니스 관련 문의는 메일로 부탁드립니다.
              </p>

            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-zinc-100 dark:border-zinc-800 text-xs text-zinc-400 flex justify-between items-center">
            <span>© 2026 Beauty Insight Lab Inc.
            </span>
            <form method="dialog">
              <button className="px-4 py-2 bg-zinc-900 text-white rounded-lg hover:bg-zinc-800 transition-colors">Close</button>
            </form>
          </div>
        </div>
      </dialog>


      {/* Top Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8 mt-6">
        <IndicatorCard indicator={filteredData!.indicators.totalExport} />
        <IndicatorCard indicator={filteredData!.indicators.usExport} />
        <IndicatorCard indicator={filteredData!.indicators.cnExport} />
        <IndicatorCard indicator={filteredData!.indicators.jpExport} />
        <IndicatorCard indicator={filteredData!.indicators.frExport} />
        <IndicatorCard indicator={filteredData!.indicators.mxExport} />
        <IndicatorCard indicator={filteredData!.indicators.aeExport} />
        <IndicatorCard indicator={filteredData!.indicators.othersExport} />
      </div>

      <TrendsChart
        cn={filteredData!.indicators.cnExport}
        us={filteredData!.indicators.usExport}
        jp={filteredData!.indicators.jpExport}
        fr={filteredData!.indicators.frExport}
        mx={filteredData!.indicators.mxExport}
        ae={filteredData!.indicators.aeExport}
        others={filteredData!.indicators.othersExport}
      />

      <AIPrediction
        dashboardData={filteredData!}
        itemLabel={selectedItem.label}
        hsCode={selectedItem.hsCode}
      />

      {loading && (
        <div className="mt-4 text-center">
          <p className="text-xs text-zinc-400 dark:text-zinc-500">Refreshing...</p>
        </div>
      )}

      {/* GitHub Repository Link */}
      <div className="mt-12 pt-8 border-t border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center justify-center gap-2">
          <a
            href="https://github.com/Beauty-Insight-Lab-Inc/K-Beauty-Export-Tracker/tree/main"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:underline transition-colors"
          >
            <svg
              className="w-5 h-5"
              fill="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                clipRule="evenodd"
              />
            </svg>
            <span>View on GitHub</span>
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
              />
            </svg>
          </a>
        </div>
      </div>
    </div>
  );
}
