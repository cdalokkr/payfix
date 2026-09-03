#!/usr/bin/env bash

# Production release gate for the deployment configured in .replit.
#
# This script deliberately does not start a local server. A local process can
# prove only that the workspace starts; it cannot prove that the published
# revision is healthy. Use:
#   ./scripts/deploy-production.sh preflight
#   <publish using the configured deployment platform>
#   ./scripts/deploy-production.sh verify
#
# A complete automated release can provide DEPLOY_COMMAND. The command is run
# only after preflight and is followed by verification of NEXT_PUBLIC_APP_URL.

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
CONFIG_FILE="$ROOT_DIR/.replit"
DEPLOY_ENV="${DEPLOY_ENV:-production}"
export NODE_ENV="${NODE_ENV:-$DEPLOY_ENV}"
PRODUCTION_URL="${PRODUCTION_URL:-${NEXT_PUBLIC_APP_URL:-}}"
HEALTH_PATH="${PRODUCTION_HEALTH_PATH:-/api/health}"
HEALTH_TIMEOUT_SECONDS="${HEALTH_TIMEOUT_SECONDS:-120}"
HEALTH_RETRY_INTERVAL_SECONDS="${HEALTH_RETRY_INTERVAL_SECONDS:-5}"
DEPLOYMENT_DIR="$ROOT_DIR/deployments/deployment-$(date +%Y%m%d-%H%M%S)"
NEXT_VERSION=""
NODE_VERSION=""
NPM_VERSION=""

log_info() {
    printf '%b[INFO]%b %s\n' "$BLUE" "$NC" "$1"
}

log_success() {
    printf '%b[SUCCESS]%b %s\n' "$GREEN" "$NC" "$1"
}

log_warning() {
    printf '%b[WARNING]%b %s\n' "$YELLOW" "$NC" "$1"
}

log_error() {
    printf '%b[ERROR]%b %s\n' "$RED" "$NC" "$1" >&2
}

log_stage() {
    printf '\n%b========== %s ==========%b\n' "$BLUE" "$1" "$NC"
}

fail() {
    log_error "$1"
    return 1
}

deployment_section() {
    awk '
        /^\[deployment\]$/ { inside = 1; next }
        /^\[/ { inside = 0 }
        inside { print }
    ' "$CONFIG_FILE"
}

configured_deployment_port() {
    sed -nE 's/^[[:space:]]*localPort[[:space:]]*=[[:space:]]*([0-9]+).*$/\1/p' "$CONFIG_FILE" | head -n 1
}

validate_production_url() {
    if [ -z "$PRODUCTION_URL" ]; then
        fail "NEXT_PUBLIC_APP_URL is required; refusing to deploy without the published target URL."
        return 1
    fi

    if ! node - "$PRODUCTION_URL" <<'NODE'
const value = process.argv[2];
let url;
try {
  url = new URL(value);
} catch {
  process.exit(1);
}

const localHostnames = new Set(['localhost', '127.0.0.1', '::1']);
const hostname = url.hostname.toLowerCase();
const isProductionHost =
  url.protocol === 'https:' &&
  !url.username &&
  !url.password &&
  !localHostnames.has(hostname) &&
  !hostname.endsWith('.local') &&
  !hostname.endsWith('.replit.dev');

process.exit(isProductionHost ? 0 : 1);
NODE
    then
        fail "Production target must be a reachable HTTPS URL, not a local or development host."
        return 1
    fi
}

validate_required_production_environment() {
    local missing=0

    for required_var in \
        NEXT_PUBLIC_SUPABASE_URL \
        NEXT_PUBLIC_SUPABASE_ANON_KEY \
        SUPABASE_SERVICE_ROLE_KEY \
        NEXT_PUBLIC_APP_URL; do
        if [ -z "${!required_var:-}" ]; then
            log_error "Missing required production environment variable: $required_var"
            missing=1
        fi
    done

    if [ "$missing" -ne 0 ]; then
        return 1
    fi

    if ! node - "$NEXT_PUBLIC_SUPABASE_URL" <<'NODE'
const value = process.argv[2];
let url;
try {
  url = new URL(value);
} catch {
  process.exit(1);
}
process.exit(url.protocol === 'https:' ? 0 : 1);
NODE
    then
        fail "NEXT_PUBLIC_SUPABASE_URL must be a valid HTTPS URL in production."
        return 1
    fi

    if [ "${NODE_ENV:-production}" != "production" ]; then
        fail "NODE_ENV must be production for a production release."
        return 1
    fi

    validate_production_url
}

validate_deployment_configuration() {
    if [ ! -f "$CONFIG_FILE" ]; then
        fail "Missing $CONFIG_FILE; refusing to deploy without a configured production target."
        return 1
    fi

    local section
    section="$(deployment_section)"

    if ! grep -Eq '^[[:space:]]*deploymentTarget[[:space:]]*=[[:space:]]*"autoscale"[[:space:]]*$' <<< "$section"; then
        fail "The configured deployment target must be autoscale in $CONFIG_FILE."
        return 1
    fi

    if ! grep -Eq '^[[:space:]]*build[[:space:]]*=[[:space:]]*\["npm",[[:space:]]*"run",[[:space:]]*"build"\][[:space:]]*$' <<< "$section"; then
        fail "The production build command in $CONFIG_FILE must be npm run build."
        return 1
    fi

    if ! grep -Eq '^[[:space:]]*run[[:space:]]*=[[:space:]]*\["npm",[[:space:]]*"run",[[:space:]]*"start"\][[:space:]]*$' <<< "$section"; then
        fail "The production run command in $CONFIG_FILE must be npm run start."
        return 1
    fi

    local configured_port
    configured_port="$(configured_deployment_port)"
    if [ "$configured_port" != "8080" ]; then
        fail "The configured production runtime port must be 8080; found ${configured_port:-missing}."
        return 1
    fi

    log_info "Deployment target: Replit autoscale"
    log_info "Configured runtime: npm run start on port $configured_port"
    log_info "Health contract: $PRODUCTION_URL$HEALTH_PATH (HTTPS, HTTP 200, JSON status=healthy)"
}

pre_deployment_checks() {
    log_stage "PREFLIGHT"
    log_info "Validating production configuration and the configured publish target..."

    cd "$ROOT_DIR"

    if [ "$DEPLOY_ENV" != "production" ]; then
        fail "DEPLOY_ENV must be production for this release gate."
        return 1
    fi

    validate_required_production_environment
    validate_deployment_configuration

    if [ ! -f "package.json" ]; then
        fail "package.json not found. Run this script from the project root."
        return 1
    fi

    NODE_VERSION="$(node --version | sed 's/^v//')"
    if ! printf '%s\n' "18.0.0" "$NODE_VERSION" | sort -V -C; then
        fail "Node.js version $NODE_VERSION is below the required 18.0.0."
        return 1
    fi

    NPM_VERSION="$(npm --version)"
    if ! printf '%s\n' "8.0.0" "$NPM_VERSION" | sort -V -C; then
        log_warning "npm version $NPM_VERSION is below the recommended 8.0.0."
    fi

    NEXT_VERSION="$(node -p "require('./package.json').dependencies?.next || require('./package.json').devDependencies?.next || ''")"
    if [[ ! "$NEXT_VERSION" =~ ^\^?16\. ]]; then
        fail "Next.js version $NEXT_VERSION is not 16.x.x."
        return 1
    fi

    log_success "Production preflight passed."
}

create_deployment_backup() {
    log_info "Creating source backup before the release command..."
    mkdir -p "$DEPLOYMENT_DIR"

    cp package.json "$DEPLOYMENT_DIR/"
    cp package-lock.json "$DEPLOYMENT_DIR/"
    cp next.config.ts "$DEPLOYMENT_DIR/"

    cat > "$DEPLOYMENT_DIR/manifest.json" <<EOF
{
  "deployment_id": "$(basename "$DEPLOYMENT_DIR" | sed 's/^deployment-//')",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "environment": "$DEPLOY_ENV",
  "deployment_target": "replit-autoscale",
  "production_url": "$PRODUCTION_URL",
  "health_path": "$HEALTH_PATH",
  "next_version": "$NEXT_VERSION",
  "node_version": "$NODE_VERSION",
  "npm_version": "$NPM_VERSION",
  "git_commit": "$(git rev-parse HEAD 2>/dev/null || echo 'unknown')",
  "git_branch": "$(git branch --show-current 2>/dev/null || echo 'unknown')"
}
EOF

    log_success "Source backup created at $DEPLOYMENT_DIR."
}

build_application() {
    log_info "Building the production artifact..."
    npm ci --production=false
    npm run build

    if [ ! -d ".next" ]; then
        fail "Production build completed without a .next directory."
        return 1
    fi

    log_success "Production artifact built successfully."
}

health_check() {
    local endpoint="${1:?health endpoint is required}"
    local elapsed=0
    local response_file
    local http_status

    response_file="$(mktemp)"

    log_info "Verifying deployed revision at $endpoint..."

    while [ "$elapsed" -le "$HEALTH_TIMEOUT_SECONDS" ]; do
        http_status="$(
            curl \
                --silent \
                --show-error \
                --location \
                --proto '=https' \
                --proto-redir '=https' \
                --connect-timeout 10 \
                --max-time 20 \
                --output "$response_file" \
                --write-out '%{http_code}' \
                "$endpoint" 2>/dev/null || true
        )"

        if [ "$http_status" = "200" ] && node - "$response_file" <<'NODE'
const fs = require('node:fs');

let body;
try {
  body = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
} catch {
  process.exit(1);
}

const checks = body && body.checks;
const checksHealthy =
  checks &&
  typeof checks === 'object' &&
  Object.values(checks).every((check) => check && check.status === 'healthy');

process.exit(
  body &&
  body.status === 'healthy' &&
  body.environment === 'production' &&
  typeof body.version === 'string' &&
  body.version.length > 0 &&
  checksHealthy
    ? 0
    : 1,
);
NODE
        then
            rm -f "$response_file"
            log_success "Post-deploy health verification passed for the published revision."
            return 0
        fi

        if [ "$elapsed" -lt "$HEALTH_TIMEOUT_SECONDS" ]; then
            sleep "$HEALTH_RETRY_INTERVAL_SECONDS"
        fi
        elapsed=$((elapsed + HEALTH_RETRY_INTERVAL_SECONDS))
    done

    rm -f "$response_file"
    fail "Published revision did not satisfy the production health contract within ${HEALTH_TIMEOUT_SECONDS}s."
    return 1
}

deploy_application() {
    log_stage "DEPLOY"

    if [ -z "${DEPLOY_COMMAND:-}" ]; then
        fail "DEPLOY_COMMAND is not configured. Preflight is complete, but this script will not publish implicitly or start a local server."
        log_error "Publish using the configured Replit deployment target, then run: $0 verify"
        return 1
    fi

    log_info "Running the explicitly configured production publisher..."
    bash -lc "$DEPLOY_COMMAND"
    log_success "Production publisher completed."
}

post_deployment_validation() {
    log_stage "POST-DEPLOY VERIFICATION"
    health_check "${PRODUCTION_URL%/}${HEALTH_PATH}"
}

rollback_deployment() {
    log_warning "Restoring the workspace source snapshot after a failed release command..."

    if [ ! -d "$DEPLOYMENT_DIR" ]; then
        log_warning "No source backup was created; nothing to restore."
        return 0
    fi

    cp "$DEPLOYMENT_DIR/package.json" .
    cp "$DEPLOYMENT_DIR/package-lock.json" .
    cp "$DEPLOYMENT_DIR/next.config.ts" .
    log_warning "Workspace source restored. The published service must be republished separately."
}

on_error() {
    local status=$?
    trap - ERR
    log_error "Production release failed."
    if [ -d "$DEPLOYMENT_DIR" ]; then
        rollback_deployment || log_warning "Workspace source rollback was incomplete."
    fi
    exit "$status"
}

run_preflight() {
    pre_deployment_checks
    log_success "Preflight complete. No publish was performed."
}

run_verify() {
    log_stage "POST-DEPLOY VERIFICATION"
    cd "$ROOT_DIR"
    validate_production_url
    health_check "${PRODUCTION_URL%/}${HEALTH_PATH}"
}

main() {
    local action="${1:-release}"

    case "$action" in
        preflight)
            run_preflight
            ;;
        verify)
            run_verify
            ;;
        release)
            trap on_error ERR
            pre_deployment_checks
            create_deployment_backup
            build_application
            deploy_application
            post_deployment_validation
            log_success "Production release completed and the deployed revision is healthy."
            ;;
        rollback)
            rollback_deployment
            ;;
        *)
            log_error "Usage: $0 [preflight|release|verify|rollback]"
            return 2
            ;;
    esac
}

main "$@"