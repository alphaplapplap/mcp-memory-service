#!/usr/bin/env python3
# Copyright 2024 Heinrich Krupp
# Licensed under the Apache License, Version 2.0

"""
Rate limiting utilities for memory storage operations.
Prevents excessive memory storage and implements cooldown periods.
"""

import time
import hashlib
from collections import deque
from typing import Dict, Optional, Tuple, Any
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)


class MemoryRateLimiter:
    """
    Rate limiter for memory storage operations with multiple strategies:
    - Time-based cooldown between stores
    - Content similarity detection
    - Per-session and global limits
    - Sliding window rate limiting
    """

    def __init__(
        self,
        min_interval_seconds: int = 30,
        similarity_threshold: float = 0.85,
        max_per_hour: int = 60,
        max_per_day: int = 500,
        max_content_length: int = 500,
        truncate_content: bool = True
    ):
        """
        Initialize the rate limiter.

        Args:
            min_interval_seconds: Minimum seconds between memory stores (default: 30)
            similarity_threshold: Similarity threshold for duplicate detection (0-1)
            max_per_hour: Maximum memories per hour (default: 60)
            max_per_day: Maximum memories per day (default: 500)
            max_content_length: Maximum content length in characters (default: 500 ~100 words)
            truncate_content: Whether to truncate content exceeding max length
        """
        self.min_interval = min_interval_seconds
        self.similarity_threshold = similarity_threshold
        self.max_per_hour = max_per_hour
        self.max_per_day = max_per_day
        self.max_content_length = max_content_length
        self.truncate_content = truncate_content

        # Tracking structures
        self.last_store_time = 0
        self.last_content_hash = None
        self.hourly_stores = deque(maxlen=max_per_hour)
        self.daily_stores = deque(maxlen=max_per_day)
        self.recent_hashes = deque(maxlen=10)  # Track recent content hashes

    def check_rate_limit(self, content: str, force: bool = False) -> Tuple[bool, str]:
        """
        Check if a memory can be stored based on rate limiting rules.

        Args:
            content: The memory content to store
            force: Bypass rate limiting if True

        Returns:
            Tuple of (allowed, reason_if_denied)
        """
        if force:
            logger.info("Rate limiting bypassed (force=True)")
            return True, "Forced storage"

        current_time = time.time()

        # Check minimum interval
        time_since_last = current_time - self.last_store_time
        if time_since_last < self.min_interval:
            remaining = self.min_interval - time_since_last
            return False, f"Please wait {remaining:.1f} seconds before storing another memory"

        # Check content length
        if len(content) > self.max_content_length:
            if not self.truncate_content:
                return False, f"Content exceeds maximum length ({len(content)} > {self.max_content_length})"

        # Check for duplicate/similar content
        content_hash = self._compute_content_hash(content)
        if content_hash == self.last_content_hash:
            return False, "Duplicate content detected (identical to last memory)"

        if content_hash in self.recent_hashes:
            return False, "Similar content was recently stored"

        # Check hourly rate limit
        now = datetime.now()
        hour_ago = now - timedelta(hours=1)

        # Clean old entries from hourly window
        while self.hourly_stores and self.hourly_stores[0] < hour_ago:
            self.hourly_stores.popleft()

        if len(self.hourly_stores) >= self.max_per_hour:
            return False, f"Hourly limit reached ({self.max_per_hour} memories/hour)"

        # Check daily rate limit
        day_ago = now - timedelta(days=1)

        # Clean old entries from daily window
        while self.daily_stores and self.daily_stores[0] < day_ago:
            self.daily_stores.popleft()

        if len(self.daily_stores) >= self.max_per_day:
            return False, f"Daily limit reached ({self.max_per_day} memories/day)"

        return True, "OK"

    def record_store(self, content: str) -> str:
        """
        Record that a memory was stored, updating rate limiting state.

        Args:
            content: The content that was stored

        Returns:
            Potentially truncated content
        """
        current_time = time.time()
        now = datetime.now()

        # Update tracking
        self.last_store_time = current_time
        self.last_content_hash = self._compute_content_hash(content)
        self.recent_hashes.append(self.last_content_hash)
        self.hourly_stores.append(now)
        self.daily_stores.append(now)

        # Truncate content if needed
        if self.truncate_content and len(content) > self.max_content_length:
            truncated = content[:self.max_content_length - 50]
            truncated += f" ... [truncated from {len(content)} chars]"
            logger.info(f"Content truncated from {len(content)} to {len(truncated)} characters")
            return truncated

        return content

    def _compute_content_hash(self, content: str) -> str:
        """
        Compute a hash of the content for similarity detection.

        Args:
            content: The content to hash

        Returns:
            Hash string
        """
        # Normalize content for better duplicate detection
        normalized = content.lower().strip()
        # Take first 500 chars for quick similarity check
        preview = normalized[:500]
        return hashlib.sha256(preview.encode()).hexdigest()[:16]

    def get_status(self) -> Dict[str, Any]:
        """
        Get current rate limiter status.

        Returns:
            Dictionary with status information
        """
        now = datetime.now()
        hour_ago = now - timedelta(hours=1)
        day_ago = now - timedelta(days=1)

        # Count recent stores
        hourly_count = sum(1 for t in self.hourly_stores if t > hour_ago)
        daily_count = sum(1 for t in self.daily_stores if t > day_ago)

        # Calculate time until next allowed
        time_since_last = time.time() - self.last_store_time
        cooldown_remaining = max(0, self.min_interval - time_since_last)

        return {
            "limits": {
                "min_interval_seconds": self.min_interval,
                "max_per_hour": self.max_per_hour,
                "max_per_day": self.max_per_day,
                "max_content_length": self.max_content_length
            },
            "current": {
                "hourly_count": hourly_count,
                "daily_count": daily_count,
                "cooldown_remaining": round(cooldown_remaining, 1),
                "can_store": cooldown_remaining == 0
            },
            "usage": {
                "hourly_usage_percent": round((hourly_count / self.max_per_hour) * 100, 1),
                "daily_usage_percent": round((daily_count / self.max_per_day) * 100, 1)
            }
        }

    def reset(self):
        """Reset all rate limiting state."""
        self.last_store_time = 0
        self.last_content_hash = None
        self.hourly_stores.clear()
        self.daily_stores.clear()
        self.recent_hashes.clear()
        logger.info("Rate limiter state reset")


# Global rate limiter instance
_global_rate_limiter = None


def get_rate_limiter(
    min_interval: Optional[int] = None,
    max_per_hour: Optional[int] = None,
    max_per_day: Optional[int] = None,
    max_content_length: Optional[int] = None
) -> MemoryRateLimiter:
    """
    Get or create the global rate limiter instance.

    Args:
        min_interval: Override minimum interval between stores
        max_per_hour: Override maximum memories per hour
        max_per_day: Override maximum memories per day
        max_content_length: Override maximum content length

    Returns:
        MemoryRateLimiter instance
    """
    global _global_rate_limiter

    if _global_rate_limiter is None:
        # Get from environment or use defaults
        import os

        min_interval = min_interval or int(os.getenv('MCP_MEMORY_MIN_INTERVAL', '30'))
        max_per_hour = max_per_hour or int(os.getenv('MCP_MEMORY_MAX_PER_HOUR', '60'))
        max_per_day = max_per_day or int(os.getenv('MCP_MEMORY_MAX_PER_DAY', '500'))
        max_content_length = max_content_length or int(os.getenv('MCP_MEMORY_MAX_LENGTH', '500'))

        _global_rate_limiter = MemoryRateLimiter(
            min_interval_seconds=min_interval,
            max_per_hour=max_per_hour,
            max_per_day=max_per_day,
            max_content_length=max_content_length,
            truncate_content=True
        )

        logger.info(f"Rate limiter initialized: interval={min_interval}s, "
                   f"hourly={max_per_hour}, daily={max_per_day}, "
                   f"max_length={max_content_length}")

    return _global_rate_limiter