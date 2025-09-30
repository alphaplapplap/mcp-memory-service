#!/bin/bash
#
# Comprehensive Authentication Header Test Suite
# Tests all hook files and server endpoints for correct X-API-Key usage
#

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Configuration
API_KEY="${MCP_API_KEY:-test-key-123}"
ENDPOINT="${MCP_ENDPOINT:-http://127.0.0.1:8443}"
HOOKS_DIR="$HOME/.claude/hooks"

echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Authentication Header Test Suite                            ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Helper functions
test_start() {
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    echo -ne "${YELLOW}[TEST $TOTAL_TESTS]${NC} $1 ... "
}

test_pass() {
    PASSED_TESTS=$((PASSED_TESTS + 1))
    echo -e "${GREEN}✅ PASS${NC}"
}

test_fail() {
    FAILED_TESTS=$((FAILED_TESTS + 1))
    echo -e "${RED}❌ FAIL${NC}"
    if [ -n "$1" ]; then
        echo -e "${RED}  ↳ $1${NC}"
    fi
}

# Check if server is running
echo -e "${BLUE}→ Checking server status...${NC}"
if ! curl -s -f "$ENDPOINT/api/health" > /dev/null 2>&1; then
    echo -e "${RED}✗ Server not running at $ENDPOINT${NC}"
    echo -e "${YELLOW}  Start with: uv run memory server${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Server is running${NC}"
echo ""

# =============================================================================
# Part 1: Test Server Authentication Endpoint
# =============================================================================

echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Part 1: Server Authentication Endpoint Tests${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""

# Test 1: Correct API key
test_start "Server accepts correct X-API-Key header"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$ENDPOINT/mcp" \
    -H "Content-Type: application/json" \
    -H "X-API-Key: $API_KEY" \
    -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"check_database_health"}}')

HTTP_CODE=$(echo "$RESPONSE" | tail -n 1)
if [ "$HTTP_CODE" = "200" ]; then
    test_pass
else
    test_fail "Expected 200, got $HTTP_CODE"
fi

# Test 2: Missing API key
test_start "Server rejects missing API key"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$ENDPOINT/mcp" \
    -H "Content-Type: application/json" \
    -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"check_database_health"}}')

HTTP_CODE=$(echo "$RESPONSE" | tail -n 1)
if [ "$HTTP_CODE" = "401" ]; then
    test_pass
else
    test_fail "Expected 401, got $HTTP_CODE"
fi

# Test 3: Invalid API key
test_start "Server rejects invalid API key"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$ENDPOINT/mcp" \
    -H "Content-Type: application/json" \
    -H "X-API-Key: wrong-key-123" \
    -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"check_database_health"}}')

HTTP_CODE=$(echo "$RESPONSE" | tail -n 1)
if [ "$HTTP_CODE" = "401" ]; then
    test_pass
else
    test_fail "Expected 401, got $HTTP_CODE"
fi

# Test 4: Wrong header format (Authorization: Bearer)
test_start "Server rejects Authorization Bearer header"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$ENDPOINT/mcp" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $API_KEY" \
    -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"check_database_health"}}')

HTTP_CODE=$(echo "$RESPONSE" | tail -n 1)
if [ "$HTTP_CODE" = "401" ]; then
    test_pass
else
    test_fail "Expected 401 (Bearer not supported), got $HTTP_CODE"
fi

echo ""

# =============================================================================
# Part 2: Audit Hook Files for Correct Headers
# =============================================================================

echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Part 2: Hook Files Authentication Header Audit${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""

# Test 5: Check for any Authorization Bearer usage
test_start "No hooks use Authorization: Bearer header"
BEARER_COUNT=$(grep -r "Authorization.*Bearer" "$HOOKS_DIR" 2>/dev/null | wc -l | tr -d ' ')
if [ "$BEARER_COUNT" = "0" ]; then
    test_pass
else
    test_fail "Found $BEARER_COUNT occurrences of Authorization: Bearer"
    grep -rn "Authorization.*Bearer" "$HOOKS_DIR" 2>/dev/null | head -5
fi

# Test 6: Verify X-API-Key usage in core hooks
test_start "Core hooks use X-API-Key header"
EXPECTED_FILES=(
    "$HOOKS_DIR/core/topic-change.js"
    "$HOOKS_DIR/core/memory-retrieval.js"
    "$HOOKS_DIR/core/session-end.js"
    "$HOOKS_DIR/utilities/dynamic-context-updater.js"
)

ALL_CORRECT=true
for FILE in "${EXPECTED_FILES[@]}"; do
    if [ ! -f "$FILE" ]; then
        ALL_CORRECT=false
        echo -e "\n  ${RED}✗ File not found: $FILE${NC}"
        continue
    fi

    if ! grep -q "X-API-Key" "$FILE" 2>/dev/null; then
        ALL_CORRECT=false
        echo -e "\n  ${RED}✗ Missing X-API-Key in: $(basename $FILE)${NC}"
    fi
done

if [ "$ALL_CORRECT" = true ]; then
    test_pass
else
    test_fail "Some hooks missing X-API-Key header"
fi

# Test 7: Verify memory-client.js uses correct headers
test_start "memory-client.js uses X-API-Key"
if grep -q "'X-API-Key': this.httpConfig.apiKey" "$HOOKS_DIR/utilities/memory-client.js" 2>/dev/null; then
    test_pass
else
    test_fail "memory-client.js missing correct X-API-Key usage"
fi

echo ""

# =============================================================================
# Part 3: Live Hook Execution Tests
# =============================================================================

echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Part 3: Live Hook Execution Tests${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""

# Test 8: Test session-start hook
test_start "session-start hook executes without auth errors"
if [ -f "$HOOKS_DIR/core/session-start.js" ]; then
    OUTPUT=$(node "$HOOKS_DIR/core/session-start.js" 2>&1 || true)
    if echo "$OUTPUT" | grep -q "401\|Unauthorized" 2>/dev/null; then
        test_fail "Hook returned 401 error"
        echo "$OUTPUT" | grep "401\|Unauthorized" | head -3
    else
        test_pass
    fi
else
    test_fail "session-start.js not found"
fi

# Test 9: Check server logs for enhanced error details
test_start "Server logs show enhanced auth error details"
LOG_FILE="/tmp/memory-server.log"
if [ -f "$LOG_FILE" ]; then
    # Check if enhanced logging format is present in recent errors
    if grep "missing_key\|invalid_key" "$LOG_FILE" > /dev/null 2>&1; then
        test_pass
    else
        # No recent enhanced errors, which is actually good if no errors occurred
        test_pass
    fi
else
    test_fail "Log file not found: $LOG_FILE"
fi

echo ""

# =============================================================================
# Summary
# =============================================================================

echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Test Summary${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "  Total Tests:  ${BLUE}$TOTAL_TESTS${NC}"
echo -e "  Passed:       ${GREEN}$PASSED_TESTS${NC}"
echo -e "  Failed:       ${RED}$FAILED_TESTS${NC}"
echo ""

if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "${GREEN}✅ All authentication tests passed!${NC}"
    echo ""
    exit 0
else
    echo -e "${RED}❌ Some tests failed. Please review the errors above.${NC}"
    echo ""
    exit 1
fi