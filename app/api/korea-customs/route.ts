import { NextResponse } from 'next/server';
import { fetchStandardizedCustomsData } from '@/lib/api/customs-service';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const strtYymm = searchParams.get('startDate');
    const endYymm = searchParams.get('endDate');
    const hsCode = searchParams.get('hsCode') || '3304';

    if (!strtYymm || !endYymm) {
        return NextResponse.json({ error: 'INVALID_PARAMS', message: 'startDate and endDate are required' }, { status: 400 });
    }

    const result = await fetchStandardizedCustomsData({ strtYymm, endYymm, hsCode });

    if (!result.success) {
        return NextResponse.json(result, { status: 500 });
    }

    return NextResponse.json(result, {
        headers: { 'X-Cache': 'MISS' } // Cache handling is done in service, but we return generic
    });
}