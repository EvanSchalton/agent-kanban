import logging

import redis

from app.core.config import settings

logger = logging.getLogger(__name__)


class RedisClient:
    def __init__(self):
        self.redis_url = getattr(settings, "redis_url", "redis://localhost:6379/0")
        self.client = None
        self.connect()

    def connect(self):
        try:
            self.client = redis.from_url(
                self.redis_url, decode_responses=True, socket_connect_timeout=5, socket_timeout=5
            )
            self.client.ping()
            logger.info("Successfully connected to Redis")
        except (redis.ConnectionError, redis.TimeoutError) as e:
            logger.warning(f"Redis connection failed: {e}. Token blacklist will not be available.")
            self.client = None

    def add_to_blacklist(self, token: str, expire_seconds: int = 86400) -> bool:
        """Add a token to the blacklist with expiration"""
        if not self.client:
            return False
        try:
            self.client.setex(f"blacklist:{token}", expire_seconds, "1")
            return True
        except Exception as e:
            logger.error(f"Failed to add token to blacklist: {e}")
            return False

    def is_blacklisted(self, token: str) -> bool:
        """Check if a token is blacklisted"""
        if not self.client:
            return False
        try:
            return self.client.exists(f"blacklist:{token}") > 0
        except Exception as e:
            logger.error(f"Failed to check blacklist: {e}")
            return False

    def remove_from_blacklist(self, token: str) -> bool:
        """Remove a token from the blacklist"""
        if not self.client:
            return False
        try:
            self.client.delete(f"blacklist:{token}")
            return True
        except Exception as e:
            logger.error(f"Failed to remove token from blacklist: {e}")
            return False


redis_client = RedisClient()
