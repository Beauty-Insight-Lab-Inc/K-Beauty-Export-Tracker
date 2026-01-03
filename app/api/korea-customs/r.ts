import { NextResponse } from 'next/server';
import { XMLParser } from 'fast-xml-parser';

export const dynamic = 'force-dynamic';

const API_KEY = process.env.KOREA_CUSTOMS_API_KEY;

// ★ 중요: 국가별(US, CN, JP) 데이터를 얻기 위해 '품목별 국가별(ItemCountryMexp)' 엔드포인트 사용
// (이전 로그의 getNitemtradeList는 '성질별' 통계라 국가 코드가 안 나올 수 있습니다.)
const BASE_URL = 'http://apis.data.go.kr/1220000/ItemCountryMexp/getItemCountryMexpList';

export async function GET(request: Request) {
    if (!API_KEY) {
        return NextResponse.json(
            { error: 'API_KEY_MISSING', message: 'KOREA_CUSTOMS_API_KEY is not configured' },
            { status: 500 }
        );
    }

    // 1. 클라이언트(lib)에서 보낸 파라미터 이름(startDate)으로 받기
    const { searchParams } = new URL(request.url);
    const strtYymm = searchParams.get('startDate'); // ★ 수정됨
    const endYymm = searchParams.get('endDate');    // ★ 수정됨

    // 유효성 검사
    if (!strtYymm || !endYymm) {
        return NextResponse.json(
            { error: 'INVALID_PARAMS', message: 'startDate and endDate are required' },
            { status: 400 }
        );
    }

    // HS Code 3304 (기초화장품) 고정
    const hsCode = '3304';

    try {
        // 2. 인증키 스마트 처리 (Decoding/Encoding 자동 감지)
        let serviceKey = API_KEY;
        const isLikelyDecoded = (k: string) => (k.includes('+') || k.includes('=') || k.includes('/')) && !k.includes('%');

        if (isLikelyDecoded(serviceKey)) {
            console.log('[API Proxy] Decoded Key 감지 -> 인코딩 적용');
            serviceKey = encodeURIComponent(serviceKey);
        } else {
            console.log('[API Proxy] Encoded Key 감지 -> 그대로 사용');
        }

        // 3. 관세청 API 요청 URL 생성 (여기서는 strtYymm 이름 사용)
        const queryString = [
            `serviceKey=${serviceKey}`,
            `strtYymm=${strtYymm}`,
            `endYymm=${endYymm}`,
            `hsSgn=${hsCode}`,
            `numOfRows=100`, // 한 번에 가져올 데이터 수
            `pageNo=1`
        ].join('&');

        const url = `${BASE_URL}?${queryString}`;

        console.log(`[API Proxy] External Request: ${url}`);

        const response = await fetch(url);

        // 4. 응답 처리 및 에러 핸들링
        if (!response.ok) {
            console.error(`[API Proxy] HTTP Error: ${response.status}`);
            return NextResponse.json({ error: 'EXTERNAL_API_ERROR' }, { status: response.status });
        }

        const xmlText = await response.text();

        // XML -> JSON 변환
        const parser = new XMLParser();
        const jsonObj = parser.parse(xmlText);

        // 관세청 에러 메시지 확인 (API Logic Error)
        const resultCode = jsonObj.response?.header?.resultCode;
        if (resultCode && resultCode !== '00') {
            console.error(`[API Proxy] Logic Error:`, jsonObj.response?.header);
            return NextResponse.json({
                error: 'API_LOGIC_ERROR',
                details: jsonObj.response?.header
            }, { status: 502 });
        }

        // 5. 데이터 추출 및 반환
        const items = jsonObj.response?.body?.items?.item || [];

        return NextResponse.json({
            success: true,
            data: Array.isArray(items) ? items : [items], // 항상 배열로 반환
            meta: { strtYymm, endYymm }
        });

    } catch (error) {
        console.error('[API Proxy] Internal Server Error:', error);
        return NextResponse.json(
            { error: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
}