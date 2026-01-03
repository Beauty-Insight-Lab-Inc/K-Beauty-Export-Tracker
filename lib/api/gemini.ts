import { GoogleGenerativeAI } from '@google/generative-ai';
import { DashboardData } from '../types/indicators';
import { GeminiModelName, DEFAULT_GEMINI_MODEL } from '../constants/gemini-models';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export interface MarketPrediction {
  sentiment: 'bullish' | 'bearish' | 'neutral';
  reasoning: string;
  risks: string[];
  report_summary: string; // New field for "Copy for Report"
  timestamp: string;
  isFallback?: boolean;
  fallbackMessage?: string;
}

export async function generateMarketPrediction(
  dashboardData: DashboardData,
  modelName: GeminiModelName = DEFAULT_GEMINI_MODEL,
  meta?: { itemLabel?: string; hsCode?: string }
): Promise<MarketPrediction> {
  const model = genAI.getGenerativeModel({ model: modelName });

  const {
    totalExport,
    usExport,
    cnExport,
    jpExport,
    othersExport
  } = dashboardData.indicators;

  const formatChange = (ind: typeof totalExport) => {
    // Priority: YoY (30d field in our mock) > MoM (changePercent)
    const yoy = ind.changePercent30d;
    const mom = ind.changePercent;

    let str = `$${ind.value.toLocaleString()}M`;
    if (yoy !== undefined) str += ` (YoY ${yoy >= 0 ? '+' : ''}${yoy.toFixed(1)}%)`;
    if (mom !== undefined) str += ` (MoM ${mom >= 0 ? '+' : ''}${mom.toFixed(1)}%)`;
    return str;
  };

  const itemContext = meta?.itemLabel
    ? `\n**Target Item Analysis:**\nCurrently analyzing: ${meta.itemLabel} (HS ${meta.hsCode || '-'})\nNote: The export data below represents this specific item category, not the entire cosmetics industry. Please adjust your insights accordingly.`
    : '';

  let prompt = `You are a "K-Beauty Export Strategist" analyzing Korea's Cosmetic Exports (HS Code 3304).
Current Date: ${new Date().toLocaleDateString()}${itemContext}

**Data Source Context:**
This data is collected via the official Open API of the Korea Customs Service.
The current month's data is "Provisional", and previous months' data are "Final".
Please prioritize factual numbers and official trends in your analysis.`;

  if (meta?.itemLabel?.includes('마스크팩')) {
    prompt += `\n\n[Special Analysis Hint] Please specifically mention the HS Code classification dynamics for Mask Packs (3304 vs 3307) and recent growth trends in key markets like US and Japan.`;
  }

  prompt += `
**Export Data:**
    1. Total Export: ${formatChange(totalExport)}
  2. USA(Driver): ${formatChange(usExport)}
  3. China(Risk): ${formatChange(cnExport)}
  4. Japan(Cash Cow): ${formatChange(jpExport)}
  5. Others(Diversification): ${formatChange(othersExport)}

** Context & Logic:**
- ** USA **: Growth driven by Indie Brands, Amazon Prime Day, Ulta / Sephora / Costco expansion.
- ** China **: Structural decline due to "Guochao"(patriotic spending) and consumption downgrade.But look for signs of "bottoming out".
- ** Japan **: Steady market, focus on LPs(low - mid price) and offline channels(Don Quijote).
- ** Non - China vs China **: Emphasize the "Structural Shift" where non - China exports outweigh China.

** Task:**
    Analyze the data and provide a strategic outlook.Specifically, generate a "3-Line Executive Summary" for the user to report to their boss.

Please provide your analysis in the following JSON format:
  {
    "sentiment": "bullish" | "bearish" | "neutral",
      "reasoning": "Detailed analysis (3-4 sentences) explaining the export trends, focusing on the shift from China to US/Global.",
        "risks": ["Risk 1 (e.g., US Tariff)", "Risk 2 (e.g., China slowdown)", "Risk 3"],
          "report_summary": "1. [Performance] ...\n2. [US/China] ...\n3. [Action] ..."
  }

** Requirements for 'report_summary':**
    - Must be exactly 3 bullet points numbered 1, 2, 3.
      - Tone: Professional, concise, suitable for executive reporting.
- Content:
    1. Overall Performance(Total Export & YoY)
  2. Structural Change(US vs China dynamic)
  3. Strategic Implication(e.g., "Overweight US", "Monitor China recovery")
    - Language: Korean(Formal / Business).

      IMPORTANT: Respond ONLY with the JSON object.`;

  try {
    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Invalid response format from Gemini API');
    }

    // Sanitize the JSON string: handle unescaped newlines and control characters
    const jsonString = jsonMatch[0]
      .replace(/[\x00-\x1F\x7F]/g, (char) => {
        // Allow valid whitespace
        if (char === '\n' || char === '\t' || char === '\r') return char;
        return '';
      })
    // Specific fix for "Bad control character" (often literal newlines in strings)
    // This regex attempts to escape newlines that are NOT between valid JSON tokens
    // But simple newline escaping is safer as a fallback.

    let prediction: any;
    try {
      prediction = JSON.parse(jsonString);
    } catch (e) {
      // Emergency cleanup: Escape newlines in the string if parse failed
      // This often fixes the issue where models put real newlines in the "report_summary" string
      const cleaned = jsonString.replace(/\n/g, '\\n').replace(/\r/g, '');
      try {
        prediction = JSON.parse(cleaned);
      } catch (e2) {
        console.error('JSON Parse Failed:', e);
        // Fallback manual construction if desperate, but throw for now
        throw new Error('AI Response parsing failed');
      }
    }

    return {
      sentiment: prediction.sentiment,
      reasoning: prediction.reasoning,
      risks: prediction.risks || [],
      report_summary: prediction.report_summary || "요약 생성 실패",
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Error generating market prediction:', error);
    // Error handling re-throw pattern
    if (error instanceof Error) {
      const msg = error.message.toLowerCase();
      if (msg.includes('quota') || msg.includes('429')) {
        const qErr = new Error('API Quota Exceeded');
        (qErr as any).isQuotaError = true;
        throw qErr;
      }
    }
    throw error;
  }
}
