# Multi-Browser Real-Time Testing Framework

A comprehensive testing framework designed to validate three-browser real-time notification scenarios and performance benchmarks for modern web applications.

## 🎯 Overview

This framework provides automated testing for complex real-time dashboard systems, ensuring:

- **Multi-browser synchronization** - Tests cross-browser data consistency and real-time updates
- **Role-based notifications** - Validates admin vs user notification filtering
- **Performance benchmarks** - Measures latency, throughput, and cache effectiveness
- **Integration testing** - End-to-end testing of APIs, databases, and real-time events

## 🏗️ Architecture

```
tests/
├── multi-browser/
│   ├── test-orchestrator.ts      # Main test coordination
│   └── real-time-scenarios.ts    # Specific browser test cases
├── performance/
│   └── benchmark-suite.ts        # Performance testing suite
├── integration/
│   └── event-flow-tests.ts       # End-to-end integration tests
├── utils/
│   └── browser-manager.ts        # Browser automation utilities
├── reporting/
│   └── performance-reporter.ts   # Report generation tools
└── run-tests.js                  # Main test runner
```

## 📋 Test Scenarios

### 1. Multi-Browser Real-Time Scenarios

#### Admin User Creation Test

- **Scenario**: Admin A creates a new user
- **Expected**: Admin A & B receive immediate updates, User C sees activity in feed
- **Validation**:
  - Admin browsers update within 1000ms
  - User browser does not receive direct notification
  - Cross-browser data consistency

#### User Activity Performance Test  

- **Scenario**: User C performs task activity
- **Expected**: All browsers (A, B, C) receive real-time updates
- **Validation**:
  - All updates delivered within 2000ms
  - Activity appears in all browser activity feeds
  - Data consistency across all browsers

#### Concurrent Admin Operations Test

- **Scenario**: Admin A and B simultaneously create users
- **Expected**: Both operations complete successfully with consistent final state
- **Validation**:
  - Operations complete within 30 seconds
  - Final user counts match across both admin browsers
  - No data corruption or race conditions

### 2. Performance Benchmarks

#### Latency Benchmark

- Measures update latency across 100 iterations
- Targets: P95 < 500ms
- Provides percentile distribution analysis

#### Load Test

- Simulates concurrent users performing operations
- Tests system stability under load
- Identifies performance degradation points

#### Cache Performance Test

- Measures cache hit rates across multiple TTL levels
- Validates cache invalidation and refresh mechanisms
- Analyzes memory usage and efficiency

### 3. Integration Tests

#### User Management Flow

- Tests complete flow from login to user creation
- Validates TRPC API integration
- Ensures database consistency

#### Real-Time Notification System

- Tests WebSocket event broadcasting
- Validates role-based event filtering
- Monitors connection health and stability

#### Cache Invalidation

- Tests cache invalidation triggers
- Validates prefetch system compatibility
- Measures performance impact

## 🚀 Usage

### Quick Start

```bash
# Install dependencies
npm install @playwright/test puppeteer

# Run all tests
node tests/run-tests.js

# Run specific test types
node tests/run-tests.js --scenario-only
node tests/run-tests.js --benchmark-only
node tests/run-tests.js --integration-only

# Development mode with visible browsers
node tests/run-tests.js --headful

# CI/CD mode with JSON output
node tests/run-tests.js --ci
```

### Configuration Options

```bash
# Custom target URL
node tests/run-tests.js --url http://localhost:3000

# Custom output directory
node tests/run-tests.js --output ./test-results

# Custom timeout
node tests/run-tests.js --timeout 600000

# Help
node tests/run-tests.js --help
```

### Programmatic Usage

```typescript
import { MultiBrowserTestRunner } from './tests/run-tests.js'

const runner = new MultiBrowserTestRunner({
  baseURL: 'http://localhost:3000',
  headless: true,
  verbose: true
})

const results = await runner.runAllTests()
console.log(`Overall Score: ${results.report.summary.overallScore}/100`)
```

## 📊 Performance Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| Update Latency | < 500ms (P95) | Multi-browser scenario tests |
| Cache Hit Rate | > 85% | Cache performance tests |
| System Reliability | > 95% success rate | All test suites combined |
| Load Test Success Rate | > 95% | Load testing under concurrent users |
| Response Time | < 1000ms (average) | API response measurements |

## 🔧 Framework Components

### Browser Manager (`tests/utils/browser-manager.ts`)

- Multi-browser session management
- Automated browser lifecycle handling
- Performance monitoring integration
- Network condition simulation

### Test Orchestrator (`tests/multi-browser/test-orchestrator.ts`)

- Coordinates multiple browser instances
- Manages test environment setup
- Handles retry policies and error recovery
- Generates comprehensive test results

### Performance Benchmarks (`tests/performance/benchmark-suite.ts`)

- Latency measurement and analysis
- Load testing with configurable parameters
- Cache performance evaluation
- Resource usage monitoring

### Integration Tests (`tests/integration/event-flow-tests.ts`)

- End-to-end API testing
- Database consistency validation
- Real-time event propagation monitoring
- WebSocket connection health checks

### Report Generation (`tests/reporting/performance-reporter.ts`)

- HTML performance reports
- JSON reports for CI/CD integration
- Real-time monitoring dashboard
- Actionable recommendations

## 📈 Metrics and Monitoring

### Key Performance Indicators

- **Latency Distribution**: P50, P95, P99 response times
- **Throughput**: Operations per second under load
- **Error Rates**: Success/failure ratios by operation type
- **Cache Efficiency**: Hit rates and memory usage
- **System Health**: Resource utilization and stability

### Monitoring Dashboard

The framework generates a real-time monitoring dashboard with:

- Live performance metrics
- System health indicators
- Error rate tracking
- Cache performance visualization

## 🎯 Success Criteria

### Test Execution Success

- [x] All multi-browser scenarios pass with role-based notifications working correctly
- [x] Performance metrics meet targets (latency <500ms, cache hit rate >85%)
- [x] Cross-browser data consistency maintained across all tests
- [x] Connection resilience and error recovery validated
- [x] Comprehensive test reporting with actionable insights

### Integration Requirements

- [x] Works with existing real-time system and event broadcasting
- [x] Compatible with current cache management and performance monitoring
- [x] Leverages existing TRPC endpoints and user management components
- [x] Maintains compatibility with current prefetch strategy

## 🔄 Continuous Integration

### CI/CD Integration

```yaml
# GitHub Actions example
- name: Run Multi-Browser Tests
  run: |
    npm install
    node tests/run-tests.js --ci --url ${{ env.TARGET_URL }}
```

### Test Reports

- **HTML Report**: `test-results/test-run-*/performance-report.html`
- **JSON Report**: `test-results/test-run-*/performance-report.json`
- **CI Report**: `test-results/test-run-*/ci-report.json`

### Automation Hooks

The framework integrates with CI/CD pipelines through:

- Exit codes based on overall system score
- JSON output for automated parsing
- Configurable timeout and retry policies
- Headless execution support

## 🛠️ Development

### Adding New Test Scenarios

1. Create a new test class implementing the `TestScenario` interface
2. Add test execution logic with proper validation
3. Include performance metrics and recommendations
4. Register the test in the appropriate test suite

### Extending Performance Benchmarks

1. Add new benchmark methods to `PerformanceBenchmarkSuite`
2. Define target metrics and thresholds
3. Implement result analysis and recommendations
4. Update reporting templates

### Custom Reporting

1. Extend `PerformanceReporter` class
2. Add new report formats or visualizations
3. Define custom metrics and recommendations
4. Integrate with existing report generation pipeline

## 🐛 Troubleshooting

### Common Issues

#### Browser Connection Failures

```bash
# Ensure target application is running
curl http://localhost:3000

# Check browser dependencies
npx playwright install --with-deps
```

#### Performance Test Timeouts

```bash
# Increase timeout for slow systems
node tests/run-tests.js --timeout 600000
```

#### Cache Invalidation Failures

- Verify cache TTL configuration
- Check cache invalidation triggers
- Monitor cache memory usage

### Debug Mode

```bash
# Run with verbose logging
node tests/run-tests.js --verbose --headful
```

## 📚 Dependencies

### Core Testing

- `@playwright/test` - Browser automation
- `jest` - Test framework
- `typescript` - TypeScript support

### Performance & Monitoring

- `puppeteer` - Additional browser automation
- `ws` - WebSocket testing support

### Reporting

- `chart.js` - Performance visualization
- Native filesystem APIs - Report generation

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Add comprehensive tests
4. Ensure all tests pass
5. Submit a pull request with detailed description

## 📄 License

This testing framework is part of the Real-Time Dashboard project and follows the same licensing terms.

---

**Built for Modern Real-Time Applications** 🚀

For questions or support, please refer to the project documentation or contact the development team.
