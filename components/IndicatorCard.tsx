import { IndicatorData } from '@/lib/types/indicators';
import MiniChart from './MiniChart';
import { Globe } from 'lucide-react';

interface IndicatorCardProps {
  indicator: IndicatorData;
}



export default function IndicatorCard({ indicator }: IndicatorCardProps) {
  const getChangeColor = (change: number) => {
    return change >= 0 ? 'text-report-teal-600 dark:text-report-teal-50' : 'text-report-rose-600 dark:text-report-rose-50';
  };

  const getBgColor = (change: number) => {
    return change >= 0 ? 'bg-report-teal-50 dark:bg-report-teal-600/20' : 'bg-report-rose-50 dark:bg-report-rose-600/20';
  };

  // Data Status Logic (Provisional vs Final)
  // Korea Customs: Current month is provisional. Prev month is provisional until ~15th.
  const isProvisional = () => {
    if (!indicator.history || indicator.history.length === 0) return false;

    // Safety check for date formatting
    const lastDateStr = indicator.history[indicator.history.length - 1].date;
    const lastDate = new Date(lastDateStr);
    if (isNaN(lastDate.getTime())) return false;

    const now = new Date();
    const monthsAgo = (now.getFullYear() - lastDate.getFullYear()) * 12 + (now.getMonth() - lastDate.getMonth());

    if (monthsAgo <= 0) return true; // Current month or future
    if (monthsAgo === 1) {
      return now.getDate() < 15; // Provided before 15th of next month
    }
    return false; // Older than 1 month, definitely final
  };

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-6 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
      {/* Decorative background glow for top performers */}
      {indicator.changePercent30d && indicator.changePercent30d > 10 && (
        <div className="absolute top-0 right-0 w-24 h-24 bg-report-teal-400/10 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none"></div>
      )}

      <div className="flex flex-col gap-4 relative z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {indicator.countryCode && (
              <div className="relative w-12 h-12 rounded-full overflow-hidden shadow-sm border border-zinc-100 dark:border-zinc-700 flex-shrink-0 bg-zinc-50 dark:bg-zinc-800 flex items-center justify-center">
                {indicator.countryCode === 'OT' ? (
                  <Globe className="w-7 h-7 text-zinc-400 dark:text-zinc-500" strokeWidth={1.5} />
                ) : (
                  <img
                    src={`https://flagcdn.com/w160/${indicator.countryCode.toLowerCase()}.png`}
                    alt={indicator.countryCode}
                    className="w-full h-full object-cover"
                  />
                )}
              </div>
            )}
            <div>
              <h3 className="text-sm font-medium text-zinc-500 dark:text-zinc-300">
                {indicator.name.split('(')[0].trim()}
              </h3>
              <p className="text-xs text-zinc-400 dark:text-zinc-500 font-mono">
                {indicator.symbol}
              </p>
            </div>
          </div>

          {/* Status Badge (Provisional/Final) */}
          {isProvisional() && (
            <span className="px-2 py-0.5 text-[10px] font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-500 rounded-full border border-amber-200 dark:border-amber-800">
              잠정치
            </span>
          )}
        </div>

        <div>
          <p className="text-3xl font-bold text-zinc-900 dark:text-zinc-50 tracking-tight">
            ${indicator.value.toLocaleString()}
            <span className="text-sm font-normal text-zinc-500 dark:text-zinc-400 ml-1">
              Million
            </span>
          </p>
        </div>

        {/* Change Metrics: MoM & YoY */}
        <div className="grid grid-cols-2 gap-3">
          {/* MoM (1 Month) */}
          <div className="flex flex-col">
            <span className="text-xs text-zinc-400 mb-1">MoM (전월비)</span>
            <div className={`flex items-center gap-1.5 px-2 py-1.5 rounded-md ${getBgColor(indicator.changePercent)}`}>
              <span className={`text-xs font-bold ${getChangeColor(indicator.changePercent)}`}>
                {indicator.changePercent >= 0 ? '▲' : '▼'} {Math.abs(indicator.changePercent).toFixed(1)}%
              </span>
            </div>
          </div>

          {/* YoY (Year over Year) - Mapped to changePercent30d */}
          {indicator.changePercent30d !== undefined && (
            <div className="flex flex-col">
              <span className="text-xs text-zinc-400 mb-1">YoY (전년비)</span>
              <div className={`flex items-center gap-1.5 px-2 py-1.5 rounded-md ${getBgColor(indicator.changePercent30d)}`}>
                <span className={`text-xs font-bold ${getChangeColor(indicator.changePercent30d)}`}>
                  {indicator.changePercent30d >= 0 ? '▲' : '▼'} {Math.abs(indicator.changePercent30d).toFixed(1)}%
                </span>
              </div>
            </div>
          )}
        </div>

        {indicator.history && indicator.history.length > 0 && (
          <div className="pt-4 mt-2 border-t border-zinc-100 dark:border-zinc-800/50 h-20 w-full" style={{ height: 80, width: '100%' }}>
            <MiniChart
              data={indicator.history}
              isPositive={indicator.changePercent30d !== undefined ? indicator.changePercent30d >= 0 : indicator.change >= 0}
            />
          </div>
        )}
      </div>
    </div>
  );
}
