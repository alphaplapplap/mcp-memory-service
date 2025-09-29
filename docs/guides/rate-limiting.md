# Memory Rate Limiting Guide

## Overview

MCP Memory Service now includes comprehensive rate limiting to prevent excessive memory storage and maintain system performance. This guide explains the rate limiting features and how to configure them.

## Key Features

### 1. Time-Based Cooldown
- **Default**: 30 seconds minimum between memory stores
- Prevents rapid-fire memory storage
- Configurable via `MCP_MEMORY_MIN_INTERVAL`

### 2. Volume Limits
- **Hourly limit**: 60 memories per hour (default)
- **Daily limit**: 500 memories per day (default)
- Sliding window implementation for accurate tracking

### 3. Content Length Limits
- **Default maximum**: 10,000 characters per memory
- Automatic truncation with notification
- Preserves most important content when truncating

### 4. Duplicate Detection
- Content-based hashing for similarity detection
- Prevents storing identical or very similar content
- Tracks recent content hashes to avoid near-duplicates

## Configuration

### Environment Variables

```bash
# Minimum seconds between memory stores (5-300 seconds)
export MCP_MEMORY_MIN_INTERVAL=30

# Maximum memories per hour (1-1000)
export MCP_MEMORY_MAX_PER_HOUR=60

# Maximum memories per day (10-10000)
export MCP_MEMORY_MAX_PER_DAY=500

# Maximum content length in characters (100-100000)
export MCP_MEMORY_MAX_LENGTH=10000

# Whether to truncate content exceeding max length (true/false)
export MCP_MEMORY_TRUNCATE=true
```

### Example Configurations

#### Development/Testing
```bash
# More permissive limits for development
export MCP_MEMORY_MIN_INTERVAL=5
export MCP_MEMORY_MAX_PER_HOUR=100
export MCP_MEMORY_MAX_PER_DAY=1000
export MCP_MEMORY_MAX_LENGTH=20000
```

#### Production/Conservative
```bash
# Stricter limits for production
export MCP_MEMORY_MIN_INTERVAL=60
export MCP_MEMORY_MAX_PER_HOUR=30
export MCP_MEMORY_MAX_PER_DAY=200
export MCP_MEMORY_MAX_LENGTH=5000
```

## Usage

### Normal Memory Storage

When storing memories normally, rate limits are enforced:

```python
# Via MCP tool
{
    "tool": "store_memory",
    "content": "Important information to remember",
    "metadata": {
        "tags": "important,reference"
    }
}
```

If rate limited, you'll receive a message like:
```
⏳ Rate limit: Please wait 25.3 seconds before storing another memory

Use 'force: true' to bypass limits for critical information.
```

### Bypassing Rate Limits

For critical information, you can bypass rate limits:

```python
{
    "tool": "store_memory",
    "content": "CRITICAL: System failure detected",
    "metadata": {
        "tags": "critical,urgent"
    },
    "force": true  # Bypasses all rate limiting
}
```

### Checking Rate Limit Status

Use the `check_rate_limit_status` tool to see current usage:

```python
{
    "tool": "check_rate_limit_status"
}
```

Response:
```
📊 Rate Limiter Status:

⚙️ Limits:
  • Minimum interval: 30 seconds
  • Max per hour: 60
  • Max per day: 500
  • Max content length: 10000 characters

📈 Current Usage:
  • Hourly: 12/60 (20.0%)
  • Daily: 45/500 (9.0%)
  • ✅ Ready to store
```

## Rate Limiting Behavior

### What Gets Rate Limited

1. **All memory storage operations** via the `store_memory` tool
2. **Duplicate or near-duplicate content** within recent memory window
3. **Content exceeding length limits** (truncated or rejected based on config)

### What Bypasses Rate Limiting

1. **Force flag**: When `force: true` is explicitly set
2. **System operations**: Internal consolidation and maintenance operations
3. **Memory updates**: Metadata updates don't count against rate limits

### Rate Limit Responses

When rate limited, the system provides helpful feedback:

| Scenario | Message |
|----------|---------|
| Too soon | "Please wait X.X seconds before storing another memory" |
| Duplicate content | "Duplicate content detected (identical to last memory)" |
| Similar content | "Similar content was recently stored" |
| Hourly limit | "Hourly limit reached (60 memories/hour)" |
| Daily limit | "Daily limit reached (500 memories/day)" |
| Content too long | "Content exceeds maximum length (X > 10000)" |

## Memory Content Length

### How Truncation Works

When content exceeds the maximum length and truncation is enabled:

1. Content is truncated to `max_length - 100` characters
2. A notification is appended: `"... [Content truncated from X to Y characters]"`
3. The truncated content is stored normally

### Example

Original: 15,000 character memory
After truncation (10,000 limit):
```
[First 9,900 characters of content]

... [Content truncated from 15000 to 10000 characters]
```

## Monitoring and Debugging

### Checking Current Limits

```bash
# Check current configuration
echo "Min Interval: ${MCP_MEMORY_MIN_INTERVAL:-30}"
echo "Max Per Hour: ${MCP_MEMORY_MAX_PER_HOUR:-60}"
echo "Max Per Day: ${MCP_MEMORY_MAX_PER_DAY:-500}"
echo "Max Length: ${MCP_MEMORY_MAX_LENGTH:-10000}"
```

### Viewing Rate Limiter Logs

Rate limiting events are logged at INFO level:

```bash
# View rate limiting logs
tail -f logs/mcp_memory.log | grep "rate limit"
```

### Reset Rate Limiter State

The rate limiter state resets automatically:
- **Cooldown**: After the minimum interval passes
- **Hourly limit**: Rolling window (entries older than 1 hour expire)
- **Daily limit**: Rolling window (entries older than 24 hours expire)

## Best Practices

### 1. Set Appropriate Limits
- Consider your usage patterns
- Balance between preventing spam and allowing necessary storage
- Start conservative and adjust based on needs

### 2. Use Force Sparingly
- Reserve `force: true` for truly critical information
- Don't bypass limits for routine storage
- Consider why you're hitting limits frequently

### 3. Monitor Usage
- Regularly check rate limit status
- Adjust limits if consistently hitting them
- Watch for patterns in rate limiting

### 4. Content Length Management
- Keep memories concise and focused
- Split large content into multiple related memories
- Use tags to link related memory chunks

## Troubleshooting

### "Rate limit: Please wait X seconds"
- **Cause**: Trying to store too soon after previous memory
- **Solution**: Wait the indicated time or use `force: true` for critical info

### "Hourly/Daily limit reached"
- **Cause**: Exceeded volume limits
- **Solution**: Wait for rolling window to expire or increase limits

### "Content exceeds maximum length"
- **Cause**: Memory content too long
- **Solution**: Enable truncation or increase `MCP_MEMORY_MAX_LENGTH`

### "Duplicate content detected"
- **Cause**: Identical or very similar content recently stored
- **Solution**: Verify if truly different information needs storing

## Advanced Configuration

### Custom Rate Limiter

For advanced use cases, you can programmatically configure the rate limiter:

```python
from mcp_memory_service.utils.rate_limiter import get_rate_limiter

# Get custom rate limiter instance
rate_limiter = get_rate_limiter(
    min_interval=10,       # 10 seconds
    max_per_hour=100,      # 100/hour
    max_per_day=1000,      # 1000/day
    max_content_length=15000  # 15k chars
)
```

### Integration with Natural Memory Triggers

Natural Memory Triggers respect rate limiting by default. Configure interaction:

```json
{
  "naturalTriggers": {
    "enabled": true,
    "respectRateLimits": true,  // Honor rate limits
    "forceOnCritical": true,    // Bypass for critical triggers
    "maxMemoriesPerTrigger": 5
  }
}
```

## Summary

Rate limiting helps maintain a healthy memory system by:

- **Preventing spam**: Stops excessive rapid storage
- **Managing volume**: Limits hourly and daily storage
- **Controlling size**: Enforces content length limits
- **Avoiding duplicates**: Detects and prevents similar content
- **Allowing overrides**: Provides `force` flag for critical information

Configure limits based on your needs and monitor usage to find the right balance between protection and flexibility.