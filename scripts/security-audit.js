#!/usr/bin/env node

// ============================================
// Comprehensive Security Audit Script for Next.js 16
// ============================================
// This script performs comprehensive security audit for Next.js 16 application

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

console.log('🔒 Starting comprehensive security audit for Next.js 16...\n');

// Configuration
const CONFIG = {
  baseUrl: process.env.SECURITY_AUDIT_URL || 'http://localhost:3000',
  timeout: 30000,
  severityLevels: {
    CRITICAL: '🔴',
    HIGH: '🟠',
    MEDIUM: '🟡',
    LOW: '🟢',
    INFO: 'ℹ️'
  }
};

class SecurityAuditor {
  constructor(config) {
    this.config = config;
    this.findings = {
      critical: [],
      high: [],
      medium: [],
      low: [],
      info: []
    };
    this.score = 100;
  }

  addFinding(severity, title, description, recommendation, evidence = null) {
    const finding = {
      title,
      description,
      recommendation,
      evidence,
      timestamp: new Date().toISOString()
    };

    this.findings[severity.toLowerCase()].push(finding);

    // Deduct points based on severity
    const deductions = {
      critical: 25,
      high: 15,
      medium: 8,
      low: 3,
      info: 0
    };

    this.score -= deductions[severity.toLowerCase()] || 0;
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
              data: data ? JSON.parse(data) : null,
              rawData: data
            };
            resolve(result);
          } catch (e) {
            resolve({ status: res.statusCode, headers: res.headers, data: null, rawData: data });
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

  async auditSecurityHeaders() {
    console.log('🔍 Auditing security headers...');

    try {
      const result = await this.makeRequest(this.config.baseUrl);

      // Required security headers for Next.js 16
      const requiredHeaders = {
        'strict-transport-security': {
          present: false,
          value: null,
          checks: ['max-age=31536000', 'includesubdomains', 'preload']
        },
        'content-security-policy': {
          present: false,
          value: null,
          checks: ['default-src', 'script-src', 'style-src']
        },
        'x-frame-options': {
          present: false,
          value: null,
          checks: ['DENY', 'SAMEORIGIN']
        },
        'x-content-type-options': {
          present: false,
          value: null,
          checks: ['nosniff']
        },
        'x-xss-protection': {
          present: false,
          value: null,
          checks: ['1', 'mode=block']
        },
        'referrer-policy': {
          present: false,
          value: null,
          checks: ['strict-origin-when-cross-origin', 'no-referrer-when-downgrade']
        },
        'permissions-policy': {
          present: false,
          value: null,
          checks: ['camera=()', 'microphone=()', 'geolocation=()']
        }
      };

      // Check each header
      Object.keys(requiredHeaders).forEach(headerName => {
        const headerValue = result.headers[headerName] || result.headers[headerName.toLowerCase()];
        if (headerValue) {
          requiredHeaders[headerName].present = true;
          requiredHeaders[headerName].value = headerValue;
        }
      });

      // Evaluate findings
      Object.entries(requiredHeaders).forEach(([header, config]) => {
        if (!config.present) {
          this.addFinding('HIGH', `Missing Security Header: ${header}`,
            `The ${header} security header is not present in HTTP responses.`,
            `Add the ${header} header to your next.config.ts security headers configuration.`,
            `Header: ${header}`
          );
        } else {
          // Check header values
          const value = config.value.toLowerCase();
          const missingChecks = config.checks.filter(check => !value.includes(check.toLowerCase()));

          if (missingChecks.length > 0) {
            this.addFinding('MEDIUM', `Incomplete Security Header: ${header}`,
              `The ${header} header is present but missing recommended security directives.`,
              `Enhance the ${header} header with: ${missingChecks.join(', ')}`,
              `Current: ${config.value}`
            );
          }
        }
      });

    } catch (error) {
      this.addFinding('CRITICAL', 'Security Headers Audit Failed',
        'Unable to retrieve security headers from the application.',
        'Ensure the application is running and accessible for security auditing.',
        error.message
      );
    }
  }

  async auditCSP() {
    console.log('🔍 Auditing Content Security Policy...');

    try {
      const result = await this.makeRequest(this.config.baseUrl);
      const csp = result.headers['content-security-policy'] || result.headers['content-security-policy-report-only'];

      if (!csp) {
        this.addFinding('HIGH', 'Missing Content Security Policy',
          'No CSP header found in HTTP responses.',
          'Implement a comprehensive CSP in next.config.ts',
          'CSP header not present'
        );
        return;
      }

      // Parse CSP directives
      const directives = csp.split(';').map(d => d.trim());
      const cspMap = {};

      directives.forEach(directive => {
        const [key, ...values] = directive.split(' ');
        if (key) cspMap[key.toLowerCase()] = values.join(' ');
      });

      // Check for dangerous patterns
      const dangerousPatterns = [
        "'unsafe-inline'",
        "'unsafe-eval'",
        "data:",
        "*"
      ];

      Object.entries(cspMap).forEach(([directive, value]) => {
        dangerousPatterns.forEach(pattern => {
          if (value.includes(pattern) && directive !== 'style-src' && directive !== 'script-src') {
            this.addFinding('MEDIUM', `Potentially Dangerous CSP: ${directive}`,
              `CSP directive ${directive} contains potentially dangerous pattern: ${pattern}`,
              'Review and restrict CSP directives to minimum required permissions.',
              `${directive}: ${value}`
            );
          }
        });
      });

      // Check for required directives
      const requiredDirectives = ['default-src', 'script-src', 'style-src', 'img-src', 'connect-src'];
      requiredDirectives.forEach(directive => {
        if (!cspMap[directive]) {
          this.addFinding('LOW', `Missing CSP Directive: ${directive}`,
            `Recommended CSP directive ${directive} is not present.`,
            `Add ${directive} directive to your CSP configuration.`,
            `CSP: ${csp}`
          );
        }
      });

    } catch (error) {
      this.addFinding('HIGH', 'CSP Audit Failed',
        'Unable to analyze Content Security Policy.',
        'Ensure CSP is properly configured and the application is accessible.',
        error.message
      );
    }
  }

  async auditDependencies() {
    console.log('🔍 Auditing dependencies for vulnerabilities...');

    try {
      const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf-8'));

      // Check for known vulnerable packages
      const vulnerablePackages = [
        { name: 'next', minVersion: '16.0.0' },
        { name: 'react', minVersion: '18.0.0' },
        { name: 'react-dom', minVersion: '18.0.0' }
      ];

      vulnerablePackages.forEach(pkg => {
        const currentVersion = packageJson.dependencies[pkg.name];
        if (currentVersion) {
          const version = currentVersion.replace(/[\^~]/, '');
          if (version < pkg.minVersion) {
            this.addFinding('HIGH', `Outdated Package: ${pkg.name}`,
              `Package ${pkg.name} version ${version} is below recommended minimum ${pkg.minVersion}`,
              `Update ${pkg.name} to version ${pkg.minVersion} or later.`,
              `Current: ${currentVersion}`
            );
          }
        }
      });

      // Check for development dependencies in production
      const devDeps = Object.keys(packageJson.devDependencies || {});
      const prodDeps = Object.keys(packageJson.dependencies || {});

      const devDepsInProd = devDeps.filter(dep => prodDeps.includes(dep));
      if (devDepsInProd.length > 0) {
        this.addFinding('MEDIUM', 'Development Dependencies in Production',
          'Development dependencies found in production dependencies.',
          'Move development-only packages to devDependencies.',
          `Packages: ${devDepsInProd.join(', ')}`
        );
      }

    } catch (error) {
      this.addFinding('MEDIUM', 'Dependency Audit Failed',
        'Unable to analyze package.json for security issues.',
        'Ensure package.json exists and is properly formatted.',
        error.message
      );
    }
  }

  async auditConfiguration() {
    console.log('🔍 Auditing Next.js configuration...');

    try {
      const nextConfig = fs.readFileSync('next.config.ts', 'utf-8');

      // Check for security-related configurations
      const securityChecks = [
        {
          pattern: /reactStrictMode:\s*true/,
          name: 'React Strict Mode',
          severity: 'MEDIUM',
          message: 'React Strict Mode is not enabled'
        },
        {
          pattern: /poweredByHeader:\s*false/,
          name: 'Powered By Header',
          severity: 'LOW',
          message: 'X-Powered-By header is not disabled'
        },
        {
          pattern: /compress:\s*true/,
          name: 'Compression',
          severity: 'LOW',
          message: 'Response compression is not enabled'
        }
      ];

      securityChecks.forEach(check => {
        if (!check.pattern.test(nextConfig)) {
          this.addFinding(check.severity, `Configuration Issue: ${check.name}`,
            check.message,
            `Add \`${check.pattern.source.replace(/\\s*/g, ' ')}\` to next.config.ts`,
            'Configuration check'
          );
        }
      });

      // Check for experimental features that might be security risks
      const experimentalFeatures = [
        'serverComponentsExternalPackages',
        'esmExternals'
      ];

      experimentalFeatures.forEach(feature => {
        if (nextConfig.includes(feature)) {
          this.addFinding('INFO', `Experimental Feature: ${feature}`,
            `Experimental feature ${feature} is enabled.`,
            'Monitor for stability and security implications.',
            `Feature: ${feature}`
          );
        }
      });

    } catch (error) {
      this.addFinding('MEDIUM', 'Configuration Audit Failed',
        'Unable to analyze next.config.ts for security issues.',
        'Ensure next.config.ts exists and is properly configured.',
        error.message
      );
    }
  }

  async auditAPIEndpoints() {
    console.log('🔍 Auditing API endpoints...');

    const endpoints = [
      '/api/health',
      '/api/trpc/health',
      '/api/auth/session'
    ];

    for (const endpoint of endpoints) {
      try {
        const result = await this.makeRequest(`${this.config.baseUrl}${endpoint}`);

        // Check for sensitive data leakage
        if (result.rawData && result.rawData.length > 0) {
          const sensitivePatterns = [
            /password/i,
            /secret/i,
            /token/i,
            /key/i,
            /private/i
          ];

          sensitivePatterns.forEach(pattern => {
            if (pattern.test(result.rawData)) {
              this.addFinding('HIGH', 'Potential Data Leakage',
                `API endpoint ${endpoint} may be leaking sensitive information.`,
                'Review API responses and ensure sensitive data is not exposed.',
                `Endpoint: ${endpoint}, Pattern: ${pattern.source}`
              );
            }
          });
        }

        // Check for proper error handling
        if (result.status >= 400 && !result.rawData.includes('error')) {
          this.addFinding('LOW', 'API Error Handling',
            `API endpoint ${endpoint} returns error status without proper error message.`,
            'Implement proper error responses for API endpoints.',
            `Status: ${result.status}, Endpoint: ${endpoint}`
          );
        }

      } catch (error) {
        // Endpoint doesn't exist or is not accessible - this might be okay
        this.addFinding('INFO', 'API Endpoint Not Accessible',
          `API endpoint ${endpoint} is not accessible or does not exist.`,
          'Verify if this endpoint should be accessible or if it needs authentication.',
          `Endpoint: ${endpoint}, Error: ${error.message}`
        );
      }
    }
  }

  generateReport() {
    console.log('\n📊 Security Audit Report');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const totalFindings = Object.values(this.findings).reduce((sum, arr) => sum + arr.length, 0);
    const securityScore = Math.max(0, this.score);

    console.log(`   Security Score: ${securityScore}/100`);
    console.log(`   Total Findings: ${totalFindings}`);
    console.log(`   Critical: ${this.findings.critical.length}`);
    console.log(`   High: ${this.findings.high.length}`);
    console.log(`   Medium: ${this.findings.medium.length}`);
    console.log(`   Low: ${this.findings.low.length}`);
    console.log(`   Info: ${this.findings.info.length}`);

    // Grade the security posture
    let grade = 'F';
    if (securityScore >= 90) grade = 'A';
    else if (securityScore >= 80) grade = 'B';
    else if (securityScore >= 70) grade = 'C';
    else if (securityScore >= 60) grade = 'D';

    console.log(`   Security Grade: ${grade}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // Display findings by severity
    const severities = ['critical', 'high', 'medium', 'low', 'info'];
    severities.forEach(severity => {
      if (this.findings[severity].length > 0) {
        console.log(`\n${this.config.severityLevels[severity.toUpperCase()]} ${severity.toUpperCase()} SEVERITY FINDINGS:`);
        this.findings[severity].forEach((finding, index) => {
          console.log(`   ${index + 1}. ${finding.title}`);
          console.log(`      ${finding.description}`);
          console.log(`      💡 ${finding.recommendation}`);
          if (finding.evidence) {
            console.log(`      📋 Evidence: ${finding.evidence}`);
          }
          console.log('');
        });
      }
    });

    console.log('\n🔒 Security Recommendations:');
    if (securityScore >= 90) {
      console.log('   ✅ Excellent security posture! Continue monitoring.');
    } else if (securityScore >= 80) {
      console.log('   ⚠️  Good security posture with minor issues to address.');
    } else if (securityScore >= 70) {
      console.log('   🟠 Moderate security posture. Address high-priority findings.');
    } else {
      console.log('   🔴 Critical security issues require immediate attention.');
    }

    console.log('\n📈 Next Steps:');
    console.log('   1. Address critical and high-severity findings immediately');
    console.log('   2. Implement recommended security measures');
    console.log('   3. Re-run security audit after fixes');
    console.log('   4. Set up continuous security monitoring');
    console.log('   5. Document security improvements and compliance');

    return {
      score: securityScore,
      grade,
      findings: this.findings,
      totalFindings
    };
  }
}

// Main execution
async function main() {
  const auditor = new SecurityAuditor(CONFIG);

  try {
    await auditor.auditSecurityHeaders();
    await auditor.auditCSP();
    await auditor.auditDependencies();
    await auditor.auditConfiguration();
    await auditor.auditAPIEndpoints();

    const report = auditor.generateReport();

    // Exit with appropriate code based on findings
    if (report.findings.critical.length > 0) {
      process.exit(1);
    } else if (report.findings.high.length > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }

  } catch (error) {
    console.error('❌ Security audit failed with error:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = SecurityAuditor;