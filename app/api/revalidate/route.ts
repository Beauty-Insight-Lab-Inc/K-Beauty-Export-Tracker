import { NextResponse } from 'next/server';
import { redis } from '@/lib/redis';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        // Find all keys related to Korea Customs API
        const keys = await redis.keys('korea-customs:*');

        if (keys.length > 0) {
            await redis.del(...keys);
            return NextResponse.json({
                success: true,
                message: `Deleted ${keys.length} cache keys.`,
                deletedKeys: keys
            });
        }

        return NextResponse.json({
            success: true,
            message: 'No cache keys found to delete.'
        });

    } catch (error) {
        console.error('[API Revalidate] Error:', error);
        return NextResponse.json({ error: 'INTERNAL_ERROR', details: error }, { status: 500 });
    }
}
