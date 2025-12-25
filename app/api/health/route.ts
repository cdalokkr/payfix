import { NextRequest, NextResponse } from 'next/server';
import { healthChecker } from '../../../monitoring-setup';

export async function GET(request: NextRequest) {
  try {
    const health = await healthChecker.performHealthCheck();

    const statusCode = health.status === 'healthy' ? 200 :
                      health.status === 'degraded' ? 206 : 503;

    return NextResponse.json({
      status: health.status,
      timestamp: health.timestamp,
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      checks: health.checks,
      uptime: process.uptime(),
      memory: process.memoryUsage()
    }, { status: statusCode });
  } catch (error) {
    console.error('Health check failed:', error);
    return NextResponse.json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: 'Health check failed'
    }, { status: 500 });
  }
}