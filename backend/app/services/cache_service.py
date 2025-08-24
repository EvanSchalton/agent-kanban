import asyncio
import hashlib
import json
import logging
from functools import wraps
from typing import Any, Dict, Optional

import redis

from app.core.config import settings

logger = logging.getLogger(__name__)


class CacheService:
    """Redis-based caching service for board data and statistics"""

    def __init__(self):
        self.redis_url = getattr(
            settings, "redis_url", "redis://localhost:6379/1"
        )  # Use DB 1 for cache
        self.client = None
        self.default_ttl = 300  # 5 minutes default TTL
        self.board_cache_ttl = 180  # 3 minutes for board data
        self.statistics_cache_ttl = 60  # 1 minute for statistics
        self.connect()

    def connect(self):
        """Connect to Redis with error handling"""
        try:
            self.client = redis.from_url(
                self.redis_url,
                decode_responses=True,
                socket_connect_timeout=5,
                socket_timeout=5,
                retry_on_timeout=True,
            )
            # Test connection
            self.client.ping()
            logger.info("Successfully connected to Redis cache")
        except Exception as e:
            logger.warning(f"Redis cache connection failed: {e}. Caching will be disabled.")
            self.client = None

    def _generate_key(self, prefix: str, *args, **kwargs) -> str:
        """Generate a consistent cache key"""
        key_parts = [prefix]
        key_parts.extend(str(arg) for arg in args)

        # Add sorted kwargs for consistency
        if kwargs:
            sorted_kwargs = sorted(kwargs.items())
            kwargs_str = json.dumps(sorted_kwargs, sort_keys=True)
            key_parts.append(hashlib.md5(kwargs_str.encode()).hexdigest()[:8])

        return ":".join(key_parts)

    def get(self, key: str) -> Optional[Any]:
        """Get value from cache"""
        if not self.client:
            return None

        try:
            cached_data = self.client.get(key)
            if cached_data:
                return json.loads(cached_data)
        except Exception as e:
            logger.warning(f"Cache get failed for key {key}: {e}")

        return None

    def set(self, key: str, value: Any, ttl: Optional[int] = None) -> bool:
        """Set value in cache with TTL"""
        if not self.client:
            return False

        try:
            ttl = ttl or self.default_ttl
            serialized_value = json.dumps(value, default=str)  # Handle datetime serialization
            self.client.setex(key, ttl, serialized_value)
            return True
        except Exception as e:
            logger.warning(f"Cache set failed for key {key}: {e}")
            return False

    def delete(self, key: str) -> bool:
        """Delete key from cache"""
        if not self.client:
            return False

        try:
            self.client.delete(key)
            return True
        except Exception as e:
            logger.warning(f"Cache delete failed for key {key}: {e}")
            return False

    def delete_pattern(self, pattern: str) -> int:
        """Delete keys matching pattern"""
        if not self.client:
            return 0

        try:
            keys = self.client.keys(pattern)
            if keys:
                return self.client.delete(*keys)
            return 0
        except Exception as e:
            logger.warning(f"Cache pattern delete failed for {pattern}: {e}")
            return 0

    def invalidate_board_cache(self, board_id: int):
        """Invalidate all cache entries for a specific board"""
        patterns_to_clear = [
            f"board:{board_id}:*",
            f"board_tickets:{board_id}:*",
            f"board_statistics:{board_id}:*",
            f"ticket_colors:{board_id}:*",
        ]

        for pattern in patterns_to_clear:
            deleted = self.delete_pattern(pattern)
            if deleted > 0:
                logger.info(f"Invalidated {deleted} cache entries for pattern: {pattern}")

    def get_board_with_tickets(self, board_id: int) -> Optional[Dict[str, Any]]:
        """Get cached board data with tickets"""
        key = self._generate_key("board_tickets", board_id)
        return self.get(key)

    def cache_board_with_tickets(self, board_id: int, board_data: Dict[str, Any]) -> bool:
        """Cache board data with tickets"""
        key = self._generate_key("board_tickets", board_id)
        return self.set(key, board_data, self.board_cache_ttl)

    def get_board_statistics(self, board_id: int) -> Optional[Dict[str, Any]]:
        """Get cached board statistics"""
        key = self._generate_key("board_statistics", board_id)
        return self.get(key)

    def cache_board_statistics(self, board_id: int, statistics: Dict[str, Any]) -> bool:
        """Cache board statistics"""
        key = self._generate_key("board_statistics", board_id)
        return self.set(key, statistics, self.statistics_cache_ttl)

    def get_ticket_colors(
        self, board_id: int, column: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """Get cached ticket color classifications"""
        key = self._generate_key("ticket_colors", board_id, column=column)
        return self.get(key)

    def cache_ticket_colors(
        self, board_id: int, colors_data: Dict[str, Any], column: Optional[str] = None
    ) -> bool:
        """Cache ticket color classifications"""
        key = self._generate_key("ticket_colors", board_id, column=column)
        return self.set(key, colors_data, self.statistics_cache_ttl)

    def get_health_status(self) -> Dict[str, Any]:
        """Get cache service health status"""
        if not self.client:
            return {
                "status": "disconnected",
                "redis_connected": False,
                "error": "Redis client not available",
            }

        try:
            info = self.client.info()
            memory_info = self.client.info("memory")

            return {
                "status": "healthy",
                "redis_connected": True,
                "redis_version": info.get("redis_version"),
                "connected_clients": info.get("connected_clients"),
                "used_memory_human": memory_info.get("used_memory_human"),
                "keyspace": info.get("db1", {}),  # Our cache DB
            }
        except Exception as e:
            return {"status": "unhealthy", "redis_connected": False, "error": str(e)}

    def clear_all_cache(self) -> int:
        """Clear all cache entries (use with caution)"""
        if not self.client:
            return 0

        try:
            return self.client.flushdb()
        except Exception as e:
            logger.error(f"Failed to clear cache: {e}")
            return 0


def cache_result(ttl: int = None, key_prefix: str = "cache"):
    """Decorator to cache function results"""

    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            # Skip caching if Redis not available
            if not cache_service.client:
                return func(*args, **kwargs)

            # Generate cache key
            cache_key = cache_service._generate_key(key_prefix, func.__name__, *args, **kwargs)

            # Try to get from cache
            cached_result = cache_service.get(cache_key)
            if cached_result is not None:
                logger.debug(f"Cache hit for {cache_key}")
                return cached_result

            # Execute function and cache result
            result = func(*args, **kwargs)
            if result is not None:
                cache_service.set(cache_key, result, ttl)
                logger.debug(f"Cached result for {cache_key}")

            return result

        return wrapper

    return decorator


def invalidate_cache_on_change(board_id_param: str = "board_id"):
    """Decorator to invalidate board cache when data changes"""

    def decorator(func):
        @wraps(func)
        async def async_wrapper(*args, **kwargs):
            result = await func(*args, **kwargs)

            # Extract board_id from kwargs or by parameter name
            board_id = kwargs.get(board_id_param)
            if board_id:
                cache_service.invalidate_board_cache(board_id)
                logger.debug(f"Invalidated cache for board {board_id}")

            return result

        def sync_wrapper(*args, **kwargs):
            result = func(*args, **kwargs)

            # Extract board_id from kwargs or by parameter name
            board_id = kwargs.get(board_id_param)
            if board_id:
                cache_service.invalidate_board_cache(board_id)
                logger.debug(f"Invalidated cache for board {board_id}")

            return result

        # Return appropriate wrapper based on whether function is async
        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        else:
            return sync_wrapper

    return decorator


# Global cache service instance
cache_service = CacheService()


# Cache warming functions
def warm_board_cache(board_id: int, board_data: Dict[str, Any]):
    """Warm the cache with fresh board data"""
    cache_service.cache_board_with_tickets(board_id, board_data)
    logger.info(f"Warmed cache for board {board_id}")


def warm_statistics_cache(board_id: int, statistics: Dict[str, Any]):
    """Warm the cache with fresh statistics"""
    cache_service.cache_board_statistics(board_id, statistics)
    logger.info(f"Warmed statistics cache for board {board_id}")


# Cache metrics for monitoring
def get_cache_metrics() -> Dict[str, Any]:
    """Get cache performance metrics"""
    if not cache_service.client:
        return {"error": "Redis not connected"}

    try:
        info = cache_service.client.info()
        stats = {
            "cache_hits": info.get("keyspace_hits", 0),
            "cache_misses": info.get("keyspace_misses", 0),
            "total_commands": info.get("total_commands_processed", 0),
            "connected_clients": info.get("connected_clients", 0),
            "used_memory": info.get("used_memory", 0),
            "hit_rate": 0,
        }

        # Calculate hit rate
        total_requests = stats["cache_hits"] + stats["cache_misses"]
        if total_requests > 0:
            stats["hit_rate"] = (stats["cache_hits"] / total_requests) * 100

        return stats
    except Exception as e:
        return {"error": str(e)}
