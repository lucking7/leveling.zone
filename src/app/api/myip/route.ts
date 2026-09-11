import { NextRequest, NextResponse } from 'next/server';

import { observeRequestIp, resolveRequestIp } from '@/modules/observation';

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

export async function GET(request: NextRequest) {
  try {
    const runtimeIp = (request as NextRequest & { ip?: string }).ip;
    const requestIp = resolveRequestIp(request.headers, runtimeIp);

    if (requestIp.source === 'unavailable') {
      return NextResponse.json(
        {
          error: '无法从访问请求中确定 IP 地址',
          ip: requestIp.ip,
          ipSource: requestIp.source,
        },
        { status: 400 },
      );
    }

    const result = await observeRequestIp(requestIp.ip);
    const response = {
      ip: requestIp.ip,
      ipSource: requestIp.source,
      ...result,
      timestamp: new Date().toISOString(),
      ...(Object.keys(result.sources).length === 0 && { error: '所有外部观测数据源均不可用' }),
    };
    return NextResponse.json(response, {
      status: Object.keys(result.sources).length === 0 ? 503 : 200,
    });
  } catch (error) {
    console.error('MyIP 查询失败:', error instanceof Error ? error.message : 'unknown error');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
