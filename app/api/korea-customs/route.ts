import { NextResponse } from 'next/server';
import { XMLParser } from 'fast-xml-parser';
import { redis } from '@/lib/redis'; // Using alias, or use '../../../lib/redis' if alias fails

// 이 줄이 있어야 배포 후에도 항상 최신 데이터를 가져옵니다.
export const dynamic = 'force-dynamic';

// ★ 중요: export default는 절대 사용하지 마세요!
// 오직 export async function GET 처럼 이름이 지정된 함수만 있어야 합니다.
export async function GET(request: Request) {
    // 1. 환경변수 로드
    const API_KEY = process.env.KOREA_CUSTOMS_API_KEY;

    if (!API_KEY) {
        return NextResponse.json(
            { error: 'API_KEY_MISSING', message: 'KOREA_CUSTOMS_API_KEY is not configured' },
            { status: 500 }
        );
    }

    // 2. 파라미터 추출
    const { searchParams } = new URL(request.url);
    const strtYymm = searchParams.get('startDate');
    const endYymm = searchParams.get('endDate');
    const hsCode = searchParams.get('hsCode') || '3304';

    if (!strtYymm || !endYymm) {
        return NextResponse.json({ error: 'INVALID_PARAMS', message: 'startDate and endDate are required' }, { status: 400 });
    }

    // [CACHE] Check Redis first - Bumping version to v2 to enforce fresh fetch with fixed parsing
    const cacheKey = `korea-customs-v2:${strtYymm}:${endYymm}:${hsCode}`;
    try {
        const cachedData = await redis.get(cacheKey);
        if (cachedData) {
            console.log(`[API Proxy] Cache HIT: ${cacheKey}`);
            return NextResponse.json(cachedData, {
                headers: { 'X-Cache': 'HIT' }
            });
        }
    } catch (error) {
        console.warn('[API Proxy] Redis Error (Skipping cache):', error);
    }

    // [FIX] User's screenshot shows 'nitemtrade/getNitemtradeList', not 'ItemCountryMexp'
    const baseUrl = 'http://apis.data.go.kr/1220000/nitemtrade/getNitemtradeList';

    // 3. 인증키 스마트 처리 (Encoding 키는 그대로, Decoding 키는 인코딩)
    const serviceKey = API_KEY.includes('%') ? API_KEY : encodeURIComponent(API_KEY);

    // 4. URL 생성 (수동 조합하여 이중 인코딩 방지)
    // [FIX] Increase rows to ensure we get all countries/months (estimated 200 countries * 6 HS codes * 12 months = ~15k items worst case, but usually less for specific HS)
    // Try max items.
    const queryString = `serviceKey=${serviceKey}&strtYymm=${strtYymm}&endYymm=${endYymm}&hsSgn=${hsCode}&numOfRows=10000&pageNo=1`;
    const url = `${baseUrl}?${queryString}`;

    console.log(`[API Proxy] Request URL: ${url}`);

    try {
        const response = await fetch(url);

        if (!response.ok) {
            console.error(`[API Proxy] HTTP Error: ${response.status}`);
            return NextResponse.json({ error: 'EXTERNAL_API_ERROR' }, { status: response.status });
        }

        const xmlText = await response.text();
        // [FIX] Disable number parsing to strictly preserve "2025.10" as "2025.10" instead of 2025.1
        const parser = new XMLParser({ parseTagValue: false });
        const jsonObj = parser.parse(xmlText);

        // 관세청 에러 체크 (00 or 0 means success)
        const resultCode = jsonObj.response?.header?.resultCode;
        if (resultCode !== '00' && resultCode !== 0) {
            console.error(`[API Proxy] Logic Error:`, jsonObj.response?.header);
            return NextResponse.json({ error: 'API_LOGIC_ERROR', details: jsonObj.response?.header }, { status: 502 });
        }

        const items = jsonObj.response?.body?.items?.item || [];

        const responseData = {
            success: true,
            data: Array.isArray(items) ? items : [items],
            meta: { strtYymm, endYymm }
        };

        // [CACHE] Store in Redis (TTL: 24h = 86400s)
        try {
            await redis.set(cacheKey, responseData, { ex: 86400 });
            console.log(`[API Proxy] Cache SET: ${cacheKey}`);
        } catch (error) {
            console.warn('[API Proxy] Redis Set Error:', error);
        }

        return NextResponse.json(responseData, {
            headers: { 'X-Cache': 'MISS' }
        });

    } catch (error) {
        console.error('[API Proxy] Error:', error);
        return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
    }
}