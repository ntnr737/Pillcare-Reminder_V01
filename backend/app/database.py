from motor.motor_asyncio import AsyncIOMotorClient
from app.config import MONGO_URL, DB_NAME, logger

client = None
db = None

if MONGO_URL:
    try:
        client = AsyncIOMotorClient(MONGO_URL)
        db = client[DB_NAME]
    except Exception as e:
        logger.warning(f"Failed to initialize MongoDB client: {e}")
else:
    logger.warning("MONGO_URL environment variable is not set. Database operations will return 503 until configured.")

def get_db():
    return db
