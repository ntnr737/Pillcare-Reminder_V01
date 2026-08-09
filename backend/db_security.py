"""
Database Security Utilities
Query sanitization and secure database operations
"""
from typing import Dict, Any, Optional
import re
import logging
from bson.objectid import ObjectId

logger = logging.getLogger(__name__)

# Dangerous MongoDB operators that could be used for injection
DANGEROUS_OPERATORS = {
    "$where", "$function", "$accumulator", "$expr",
}

# Allowed query operators
ALLOWED_OPERATORS = {
    "$eq", "$ne", "$gt", "$gte", "$lt", "$lte",
    "$in", "$nin", "$exists", "$type",
    "$and", "$or", "$not", "$nor",
    "$regex", "$options",
}


def sanitize_query(query: Dict[str, Any]) -> Dict[str, Any]:
    """
    Sanitize MongoDB query to prevent NoSQL injection

    Args:
        query: MongoDB query dict

    Returns:
        Sanitized query dict

    Raises:
        ValueError: If dangerous operators detected
    """
    if not isinstance(query, dict):
        return query

    for key, value in query.items():
        # Check for dangerous operators
        if key in DANGEROUS_OPERATORS:
            logger.warning(f"Blocked dangerous MongoDB operator: {key}")
            raise ValueError(f"Operator {key} is not allowed for security reasons")

        # Recursively sanitize nested dicts
        if isinstance(value, dict):
            query[key] = sanitize_query(value)

        # Sanitize arrays
        elif isinstance(value, list):
            query[key] = [sanitize_query(item) if isinstance(item, dict) else item for item in value]

    return query


def validate_object_id(id_str: str) -> bool:
    """
    Validate that a string is a valid MongoDB ObjectId

    Args:
        id_str: String to validate

    Returns:
        True if valid ObjectId format
    """
    return ObjectId.is_valid(id_str)


def sanitize_user_id(user_id: str) -> str:
    """
    Sanitize user ID to prevent injection

    Args:
        user_id: User ID from authentication

    Returns:
        Sanitized user ID

    Raises:
        ValueError: If user_id is invalid
    """
    if not user_id or not isinstance(user_id, str):
        raise ValueError("Invalid user ID")

    # Allow alphanumeric, hyphens, underscores only
    if not re.match(r'^[a-zA-Z0-9_-]+$', user_id):
        raise ValueError("User ID contains invalid characters")

    if len(user_id) > 128:
        raise ValueError("User ID too long")

    return user_id


def build_user_query(user_id: str, additional_filters: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    Build a secure query that includes user isolation

    Args:
        user_id: Authenticated user ID
        additional_filters: Additional query filters

    Returns:
        Query dict with user isolation
    """
    # Sanitize user ID
    safe_user_id = sanitize_user_id(user_id)

    # Base query with user isolation
    query = {"user_id": safe_user_id}

    # Add additional filters
    if additional_filters:
        sanitized_filters = sanitize_query(additional_filters)
        query.update(sanitized_filters)

    return query


def escape_regex(pattern: str) -> str:
    """
    Escape special regex characters in user input

    Args:
        pattern: User-provided regex pattern

    Returns:
        Escaped pattern safe for MongoDB $regex
    """
    return re.escape(pattern)


class SecureCollection:
    """
    Wrapper around MongoDB collection with automatic user isolation
    """

    def __init__(self, collection, user_id: str):
        self.collection = collection
        self.user_id = sanitize_user_id(user_id)

    async def find_one(self, filter_dict: Dict[str, Any] = None, **kwargs):
        """Find one document with user isolation"""
        query = build_user_query(self.user_id, filter_dict or {})
        return await self.collection.find_one(query, **kwargs)

    async def find(self, filter_dict: Dict[str, Any] = None, **kwargs):
        """Find documents with user isolation"""
        query = build_user_query(self.user_id, filter_dict or {})
        return self.collection.find(query, **kwargs)

    async def insert_one(self, document: Dict[str, Any], **kwargs):
        """Insert document with user_id"""
        document["user_id"] = self.user_id
        return await self.collection.insert_one(document, **kwargs)

    async def update_one(self, filter_dict: Dict[str, Any], update: Dict[str, Any], **kwargs):
        """Update one document with user isolation"""
        query = build_user_query(self.user_id, filter_dict)
        return await self.collection.update_one(query, update, **kwargs)

    async def delete_one(self, filter_dict: Dict[str, Any], **kwargs):
        """Delete one document with user isolation"""
        query = build_user_query(self.user_id, filter_dict)
        return await self.collection.delete_one(query, **kwargs)

    async def count_documents(self, filter_dict: Dict[str, Any] = None, **kwargs):
        """Count documents with user isolation"""
        query = build_user_query(self.user_id, filter_dict or {})
        return await self.collection.count_documents(query, **kwargs)
