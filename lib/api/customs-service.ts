import { XMLParser } from 'fast-xml-parser';
import { redis } from '@/lib/redis';

interface FetchParams {
    strtYymm: string;
    endYymm: string;
    hsCode: string;
}

export async function fetchStandardizedCustomsData({ strtYymm, endYymm, hsCode }: FetchParams) {
    // 1. Check Cache
    const cacheKey = `korea-customs-v2:${strtYymm}:${endYymm}:${hsCode}`;
    try {
        const cachedData = await redis.get(cacheKey);
        if (cachedData) {
            console.log(`[Service] Cache HIT: ${cacheKey}`);
            return cachedData as { success: boolean, data: any[] };
        }
    } catch (error) {
        console.warn('[Service] Redis Error (Skipping cache):', error);
    }

    // 2. Prepare API Request
    const API_KEY = process.env.KOREA_CUSTOMS_API_KEY;
    if (!API_KEY) {
        console.error('[Service] Missing API Key');
        return { success: false, data: [], error: 'API_KEY_MISSING' };
    }

    const baseUrl = 'http://apis.data.go.kr/1220000/nitemtrade/getNitemtradeList';
    const serviceKey = API_KEY.includes('%') ? API_KEY : encodeURIComponent(API_KEY);
    const queryString = `serviceKey=${serviceKey}&strtYymm=${strtYymm}&endYymm=${endYymm}&hsSgn=${hsCode}&numOfRows=10000&pageNo=1`;
    const url = `${baseUrl}?${queryString}`;

    console.log(`[Service] Request URL: ${url}`);

    try {
        const response = await fetch(url);
        if (!response.ok) {
            console.error(`[Service] External API Error: ${response.status}`);
            return { success: false, data: [], error: `EXTERNAL_API_ERROR_${response.status}` };
        }

        const xmlText = await response.text();
        const parser = new XMLParser({ parseTagValue: false });
        const jsonObj = parser.parse(xmlText);

        const resultCode = jsonObj.response?.header?.resultCode;
        if (resultCode !== '00' && resultCode !== 0) {
            console.error(`[Service] Logic Error:`, jsonObj.response?.header);
            return { success: false, data: [], error: 'API_LOGIC_ERROR' };
        }

        const items = jsonObj.response?.body?.items?.item || [];
        const responseData = {
            success: true,
            data: Array.isArray(items) ? items : [items],
            meta: { strtYymm, endYymm }
        };

        // 3. Set Cache
        try {
            await redis.set(cacheKey, responseData, { ex: 86400 });
        } catch (error) {
            console.warn('[Service] Redis Set Error:', error);
        }

        return responseData;

    } catch (error) {
        console.error('[Service] Internal Error:', error);
        return { success: false, data: [], error: 'INTERNAL_ERROR' };
    }
}
