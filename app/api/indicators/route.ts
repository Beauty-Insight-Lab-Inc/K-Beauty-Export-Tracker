import { NextResponse } from 'next/server';
import { getAllIndicators } from '@/lib/api/indicators';
import { DashboardData } from '@/lib/types/indicators';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const hsCode = searchParams.get('hsCode') || undefined;
    const hsCode2 = searchParams.get('hsCode2') || undefined;

    const indicators = await getAllIndicators(hsCode, hsCode2);

    const data: DashboardData = {
      indicators,
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching indicators:', error);

    return NextResponse.json(
      {
        error: 'Failed to fetch market indicators',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
