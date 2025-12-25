import { NextRequest, NextResponse } from 'next/server';
import { metricsCollector } from '../../../monitoring-setup';

export async function GET(request: NextRequest) {
  try {
    const metrics = metricsCollector.getMetricsSummary();

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
      version: process.env.npm_package_version || '1.0.0',
      metrics
    });
  } catch (error) {
    console.error('Metrics collection failed:', error);
    return NextResponse.json({
      error: 'Metrics collection failed',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}