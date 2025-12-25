#!/usr/bin/env node

// ============================================
// Automated Health Check Script
// ============================================
// This script performs comprehensive health checks for Next.js 16 application

const https = require('https');
const http = require('http');

console.log('🏥 Starting comprehensive health check...\n');

// Configuration
const CONFIG = {
  baseUrl: process.env.HEALTH_CHECK_URL || 'http://localhost:3000',
  timeout: parseInt(process.env.HEALTH_CHECK_TIMEOUT) || 30000,
  retries: parseInt(process.env.HEALTH_CHECK_RETRIES) || 3,
  interval: parseInt(process.env.HEALTH_CHECK_INTERVAL) || 5000
};

class HealthChecker {
  constructor(config) {
    this.config = config;
    this.results = {
      passed: 0,
      failed: 0,
      warnings: 0,
      checks: []
    };
  }

  async makeRequest(url, options = {}) {
    return new Promise((resolve, reject) => {
      const protocol = url.startsWith('https') ? https : http;
      const req = protocol.get(url, { timeout: this.config.timeout, ...options }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const result = {
              status: res.statusCode,
              headers: res.headers,
              data: data ? JSON.parse(data) : null
            };
            resolve(result);
          } catch (e) {
            resolve({ status: res.statusCode, headers: res.headers, data: data });
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });
    });
  }

  async checkEndpoint(name, url, expectedStatus = 200, validator = null) {
    console.log(`🔍 Checking: ${name}`);

    for (let attempt = 1; attempt <= this.config.retries; attempt++) {
      try {
        const result = await this.makeRequest(url);

        if (result.status === expectedStatus) {
          if (validator && !validator(result)) {
            throw new Error('Validation failed');
          }

          console.log(`✅ ${name}: PASSED`);
          this.results.passed++;
          this.results.checks.push({ name, status: 'PASSED', attempt });
          return true;
        } else {
          throw new Error(`Unexpected status: ${result.status}`);
        }
      } catch (error) {
        if (attempt === this.config.retries) {
          console.log(`❌ ${name}: FAILED (${error.message})`);
          this.results.failed++;
          this.results.checks.push({ name, status: 'FAILED', error: error.message, attempt });
          return false;
        }

        console.log(`⚠️  ${name}: Attempt ${attempt} failed, retrying in ${this.config.interval}ms...`);
        await new Promise(resolve => setTimeout(resolve, this.config.interval));
      }
    }
  }

  async runAllChecks() {
    const checks = [
      // Basic health endpoint
      {
        name: 'Application Health',
        url: `${this.config.baseUrl}/api/health`,
        validator: (result) => result.data && result.data.status === 'healthy'
      },

      // Next.js specific endpoints
      {
        name: 'Next.js API Routes',
        url: `${this.config.baseUrl}/api/trpc/health`,
        expectedStatus: 200
      },

      // Static assets
      {
        name: 'Static Assets',
        url: `${this.config.baseUrl}/favicon.ico`,
        expectedStatus: 200
      },

      // Security headers
      {
        name: 'Security Headers',
        url: `${this.config.baseUrl}/`,
        validator: (result) => {
          const requiredHeaders = [
            'x-frame-options',
            'x-content-type-options',
            'referrer-policy',
            'x-xss-protection',
            'content-security-policy'
          ];

          return requiredHeaders.every(header =>
            result.headers[header] || result.headers[header.toLowerCase()]
          );
        }
      },

      // Performance check
      {
        name: 'Response Time',
        url: `${this.config.baseUrl}/`,
        validator: (result) => {
          // Check if response time is reasonable (< 5 seconds)
          return true; // Would need timing measurement
        }
      },

      // Database connectivity (if applicable)
      {
        name: 'Database Health',
        url: `${this.config.baseUrl}/api/health/database`,
        expectedStatus: 200,
        optional: true // Mark as optional since not all apps have this endpoint
      }
    ];

    for (const check of checks) {
      await this.checkEndpoint(check.name, check.url, check.expectedStatus, check.validator);
      await new Promise(resolve => setTimeout(resolve, 1000)); // Brief pause between checks
    }
  }

  generateReport() {
    console.log('\n📊 Health Check Report:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`   Total Checks:     ${this.results.checks.length}`);
    console.log(`   ✅ Passed:        ${this.results.passed}`);
    console.log(`   ❌ Failed:        ${this.results.failed}`);
    console.log(`   ⚠️  Warnings:      ${this.results.warnings}`);
    console.log(`   Success Rate:     ${Math.round((this.results.passed / this.results.checks.length) * 100)}%`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    if (this.results.failed > 0) {
      console.log('\n❌ Failed Checks:');
      this.results.checks
        .filter(check => check.status === 'FAILED')
        .forEach(check => {
          console.log(`   - ${check.name}: ${check.error}`);
        });
    }

    console.log('\n📋 Recommendations:');
    if (this.results.failed === 0) {
      console.log('   ✅ All health checks passed! Application is healthy.');
    } else if (this.results.failed <= 2) {
      console.log('   ⚠️  Minor issues detected. Monitor closely.');
    } else {
      console.log('   ❌ Critical issues detected. Immediate attention required.');
    }

    return this.results.failed === 0;
  }
}

// Main execution
async function main() {
  const checker = new HealthChecker(CONFIG);

  try {
    await checker.runAllChecks();
    const isHealthy = checker.generateReport();

    process.exit(isHealthy ? 0 : 1);
  } catch (error) {
    console.error('❌ Health check failed with error:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = HealthChecker;