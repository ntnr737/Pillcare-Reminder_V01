from fastapi import FastAPI, APIRouter, HTTPException, Depends
from fastapi.responses import Response
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import io
import csv
import uuid
import httpx
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Literal
from datetime import datetime, date, timezone, timedelta

# Import security modules
try:
    from auth import init_firebase_admin, get_current_user, optional_user
    from security_headers import SecurityHeadersMiddleware
    from rate_limiter import setup_rate_limiting, limiter
    from db_security import SecureCollection, sanitize_user_id
    SECURITY_ENABLED = True
except ImportError as e:
    logging.warning(f"Security modules not fully loaded: {e}")
    SECURITY_ENABLED = False

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

# Environment variables with validation
mongo_url = os.environ.get("MONGO_URL")
if not mongo_url:
    raise ValueError("MONGO_URL environment variable is required")

db_name = os.environ.get("DB_NAME", "pillcare")
GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")
GROQ_TEXT_MODEL = "llama-3.1-8b-instant"
GROQ_VISION_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct"
OPENWA_ENABLED = os.environ.get("OPENWA_ENABLED", "false").lower() == "true"

# CORS configuration - restrict origins in production
ALLOWED_ORIGINS = os.environ.get("ALLOWED_ORIGINS", "*").split(",")
ENV = os.environ.get("ENV", "development")

client = AsyncIOMotorClient(mongo_url)
db = client[db_name]

# Initialize Firebase for authentication
if SECURITY_ENABLED:
    init_firebase_admin()


async def _groq_chat(system_message: str, user_text: str, image_base64: str = None) -> str:
    """Call Groq's OpenAI-compatible chat completions endpoint."""
    if not GROQ_API_KEY:
        raise HTTPException(status_code=503, detail="AI service not configured")

    if image_base64:
        # Validate base64 length to prevent DoS
        if len(image_base64) > 10_000_000:  # ~7.5MB base64
            raise HTTPException(status_code=400, detail="Image too large (max 7.5MB)")

        user_content = [
            {"type": "text", "text": user_text},
            {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{image_base64}"}},
        ]
        model = GROQ_VISION_MODEL
    else:
        user_content = user_text
        model = GROQ_TEXT_MODEL

    try:
        async with httpx.AsyncClient(timeout=30.0) as http_client:
            resp = await http_client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={"Authorization": f"Bearer {GROQ_API_KEY}"},
                json={
                    "model": model,
                    "messages": [
                        {"role": "system", "content": system_message},
                        {"role": "user", "content": user_content},
                    ],
                },
            )
            resp.raise_for_status()
            data = resp.json()
            return data["choices"][0]["message"]["content"]
    except httpx.HTTPError as e:
        logging.error(f"Groq API error: {str(e)}")
        raise HTTPException(status_code=503, detail="AI service temporarily unavailable")


app = FastAPI(
    title="PillCare API",
    description="Secure medication management and health tracking API",
    version="2.0.0",
    docs_url="/docs" if ENV == "development" else None,  # Disable docs in production
    redoc_url="/redoc" if ENV == "development" else None,
)

# Setup security middleware
if SECURITY_ENABLED:
    app.add_middleware(SecurityHeadersMiddleware)
    setup_rate_limiting(app)
    logging.info("Security features enabled: rate limiting, security headers, authentication")

api = APIRouter(prefix="/api")


# Helper to get user-specific collection
def get_user_collection(collection_name: str, user_id: str):
    """Get a SecureCollection instance for user-isolated queries"""
    if SECURITY_ENABLED:
        return SecureCollection(db[collection_name], user_id)
    # Fallback for development
    return db[collection_name]
