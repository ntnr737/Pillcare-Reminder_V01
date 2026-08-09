"""
Rate Limiting Middleware
Prevents API abuse and DoS attacks
"""
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from fastapi import Request
import logging

logger = logging.getLogger(__name__)

# Create rate limiter
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["100/minute", "1000/hour"],
    storage_uri="memory://",  # Use Redis in production: "redis://localhost:6379"
    strategy="fixed-window",
)


def get_rate_limiter():
    """Get the rate limiter instance"""
    return limiter


def setup_rate_limiting(app):
    """Setup rate limiting on FastAPI app"""
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
    logger.info("Rate limiting enabled: 100 requests/minute per IP")
