"""
Authentication and Authorization Middleware
Handles Firebase token verification and user context management
"""
from fastapi import HTTPException, Security, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional, Dict
import firebase_admin
from firebase_admin import credentials, auth
import os
import logging

logger = logging.getLogger(__name__)
security = HTTPBearer(auto_error=False)

# Initialize Firebase Admin SDK
_firebase_initialized = False

def init_firebase_admin():
    """Initialize Firebase Admin SDK for token verification"""
    global _firebase_initialized

    if _firebase_initialized:
        return

    try:
        # Try to initialize with service account
        cred_path = os.environ.get("FIREBASE_SERVICE_ACCOUNT_PATH")
        if cred_path and os.path.exists(cred_path):
            cred = credentials.Certificate(cred_path)
            firebase_admin.initialize_app(cred)
        else:
            # Initialize with default credentials (for Cloud Run, GKE)
            firebase_admin.initialize_app()

        _firebase_initialized = True
        logger.info("Firebase Admin SDK initialized successfully")
    except Exception as e:
        logger.warning(f"Firebase Admin SDK initialization failed: {e}")
        logger.warning("Authentication will be disabled. Set FIREBASE_SERVICE_ACCOUNT_PATH for production.")


async def verify_token(credentials: Optional[HTTPAuthorizationCredentials] = Security(security)) -> Optional[Dict]:
    """
    Verify Firebase ID token and return user claims

    Returns:
        User claims dict with 'uid', 'email', etc.
        None if auth is disabled (development mode)

    Raises:
        HTTPException: 401 if token is invalid
    """
    # Allow bypass in development if auth not configured
    auth_required = os.environ.get("AUTH_REQUIRED", "false").lower() == "true"

    if not credentials:
        if auth_required:
            raise HTTPException(
                status_code=401,
                detail="Missing authentication token",
                headers={"WWW-Authenticate": "Bearer"},
            )
        # Development mode - return mock user
        return {"uid": "dev-user", "email": "dev@pillcare.local"}

    token = credentials.credentials

    try:
        # Verify the token
        decoded_token = auth.verify_id_token(token)
        return decoded_token
    except auth.InvalidIdTokenError:
        raise HTTPException(
            status_code=401,
            detail="Invalid authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except auth.ExpiredIdTokenError:
        raise HTTPException(
            status_code=401,
            detail="Authentication token has expired",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except Exception as e:
        logger.error(f"Token verification error: {e}")
        raise HTTPException(
            status_code=401,
            detail="Authentication failed",
            headers={"WWW-Authenticate": "Bearer"},
        )


async def get_current_user(token_data: Dict = Depends(verify_token)) -> str:
    """
    Extract user ID from verified token

    Returns:
        user_id (uid from Firebase)
    """
    if not token_data:
        # Development mode
        return "dev-user"

    return token_data.get("uid")


async def optional_user(credentials: Optional[HTTPAuthorizationCredentials] = Security(security)) -> Optional[str]:
    """
    Optional authentication - returns user ID if authenticated, None otherwise
    Useful for endpoints that work differently for authenticated vs anonymous users
    """
    if not credentials:
        return None

    try:
        token_data = await verify_token(credentials)
        return token_data.get("uid") if token_data else None
    except HTTPException:
        return None


def require_user(user_id: str = Depends(get_current_user)):
    """
    Dependency to require authenticated user
    Usage: user_id: str = Depends(require_user)
    """
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")
    return user_id
