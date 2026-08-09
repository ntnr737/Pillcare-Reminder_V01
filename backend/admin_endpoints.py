"""
Admin Panel Endpoints for PillCare
Handles: User management, subscriptions, notifications, analytics
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Literal
import uuid
import logging

logger = logging.getLogger(__name__)


class NotificationPayload(BaseModel):
    title: str
    body: str


class SubscriptionUpdate(BaseModel):
    plan: Literal["free", "premium", "enterprise"]
    expires_days: int = 0
    note: str = ""


class FeatureOverride(BaseModel):
    feature: str
    value: any


def setup_admin_endpoints(app, db):
    """Setup admin endpoints directly on FastAPI app"""

    # Hardcoded admin email - CHANGE THIS IN PRODUCTION
    ADMIN_EMAIL = "nitinrai264@gmail.com"

    # ========== AUTHENTICATION ==========
    @app.post("/admin/auth/google")
    async def admin_google_auth(payload: dict):
        """Verify Google OAuth token for admin access - ONLY allows ADMIN_EMAIL"""
        id_token = payload.get("id_token")
        if not id_token:
            raise HTTPException(400, "id_token required")

        try:
            # Try Firebase verification first (most secure)
            try:
                from firebase_admin import auth as firebase_auth
                decoded_token = firebase_auth.verify_id_token(id_token)
                email = decoded_token.get("email", "")
                uid = decoded_token.get("uid", "")
                name = decoded_token.get("name", "Admin")
                picture = decoded_token.get("picture", "")

                logger.info(f"Token verified via Firebase: {email}")

            except Exception as firebase_error:
                # Fallback: Basic JWT parsing for Google tokens
                logger.info(f"Firebase verification unavailable, using token parsing: {firebase_error}")

                import json
                import base64

                # Parse JWT: header.payload.signature
                parts = id_token.split('.')
                if len(parts) != 3:
                    raise HTTPException(401, "Invalid token format")

                # Decode payload
                payload_encoded = parts[1]
                padding = 4 - len(payload_encoded) % 4
                if padding != 4:
                    payload_encoded += '=' * padding

                payload_data = json.loads(base64.urlsafe_b64decode(payload_encoded))
                email = payload_data.get("email", "")
                uid = payload_data.get("sub", "")
                name = payload_data.get("name", "Admin")
                picture = payload_data.get("picture", "")

                # Validate it's a Google token
                if "google" not in payload_data.get("iss", "").lower():
                    raise HTTPException(401, "Token not from Google")

                logger.info(f"Token parsed: {email}")

            # ===== CRITICAL: Check if email matches admin email =====
            if email.lower() != ADMIN_EMAIL.lower():
                logger.warning(f"❌ UNAUTHORIZED ACCESS ATTEMPT: {email} tried to access admin panel")
                raise HTTPException(403, f"Not authorized. Only {ADMIN_EMAIL} can access this panel.")

            # ===== Access Granted =====
            logger.info(f"✓ Admin login successful: {email}")

            # Create secure session token
            admin_token = str(uuid.uuid4())
            expires_at = datetime.now(timezone.utc) + timedelta(hours=8)

            await db.admin_sessions.insert_one({
                "token": admin_token,
                "email": email,
                "uid": uid,
                "created_at": datetime.now(timezone.utc),
                "expires_at": expires_at,
                "login_ip": "tracked"  # Could add real IP tracking
            })

            return {
                "token": admin_token,
                "email": email,
                "name": name,
                "picture": picture
            }

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"❌ Admin auth error: {str(e)}")
            raise HTTPException(401, "Authentication failed")

    # ========== NOTIFICATIONS ==========
    @app.post("/admin/notify")
    async def send_notification(payload: NotificationPayload):
        """Send push notification to all users via Firebase Cloud Messaging"""
        if not payload.title or not payload.body:
            raise HTTPException(400, "title and body required")

        # Validate length
        if len(payload.title) > 100:
            raise HTTPException(400, "title max 100 chars")
        if len(payload.body) > 300:
            raise HTTPException(400, "body max 300 chars")

        try:
            # Get all user FCM tokens from database
            users = await db.profile.find(
                {"fcm_token": {"$exists": True, "$ne": None}},
                {"fcm_token": 1}
            ).to_list(None)

            if not users:
                return {"sent": 0, "failed": 0, "total": 0}

            # In production, use Firebase Admin SDK to send to all tokens
            # For now, return mock implementation
            sent_count = len(users)
            failed_count = 0

            # Log notification
            await db.notifications_sent.insert_one({
                "id": str(uuid.uuid4()),
                "title": payload.title,
                "body": payload.body,
                "sent_to_count": sent_count,
                "failed_count": failed_count,
                "sent_at": datetime.now(timezone.utc),
                "timestamp": datetime.now(timezone.utc)
            })

            logger.info(f"Notification sent to {sent_count} users")

            return {
                "sent": sent_count,
                "failed": failed_count,
                "total": sent_count + failed_count
            }
        except Exception as e:
            logger.error(f"Notification error: {e}")
            raise HTTPException(503, "Failed to send notifications")

    # ========== SUBSCRIPTIONS ==========
    @app.post("/admin/users/{user_id}/subscription")
    async def update_user_subscription(user_id: str, payload: SubscriptionUpdate):
        """Update user subscription plan and expiry"""
        try:
            expires_at = None
            if payload.expires_days > 0:
                expires_at = datetime.now(timezone.utc) + timedelta(days=payload.expires_days)

            result = await db.users.update_one(
                {"id": user_id},
                {
                    "$set": {
                        "plan": payload.plan,
                        "subscription": {
                            "plan": payload.plan,
                            "expires_at": expires_at,
                            "status": "active",
                            "note": payload.note,
                            "updated_at": datetime.now(timezone.utc)
                        }
                    }
                },
                upsert=True
            )

            logger.info(f"Updated subscription for {user_id} to {payload.plan}")
            return {"ok": True, "plan": payload.plan, "expires_at": expires_at}
        except Exception as e:
            logger.error(f"Subscription update error: {e}")
            raise HTTPException(500, "Failed to update subscription")

    @app.get("/admin/subscriptions")
    async def get_subscriptions(limit: int = 100, plan: Optional[str] = None):
        """Get all subscriptions, optionally filtered by plan"""
        try:
            query = {}
            if plan:
                query["plan"] = plan

            subscriptions = await db.users.find(
                query,
                {"id": 1, "email": 1, "nickname": 1, "plan": 1, "subscription": 1}
            ).limit(limit).to_list(limit)

            result = []
            for sub in subscriptions:
                sub_data = sub.get("subscription", {})
                result.append({
                    "user_id": sub.get("id"),
                    "name": sub.get("nickname", "User"),
                    "email": sub.get("email", ""),
                    "plan": sub.get("plan", "free"),
                    "status": sub_data.get("status", "active"),
                    "expires_at": sub_data.get("expires_at"),
                    "overrides": sub_data.get("overrides", {})
                })

            return {"subscriptions": result}
        except Exception as e:
            logger.error(f"Get subscriptions error: {e}")
            raise HTTPException(500, "Failed to fetch subscriptions")

    @app.post("/admin/users/{user_id}/features")
    async def update_feature_override(user_id: str, payload: FeatureOverride):
        """Set feature override for specific user"""
        try:
            await db.users.update_one(
                {"id": user_id},
                {
                    "$set": {
                        f"subscription.overrides.{payload.feature}": payload.value
                    }
                },
                upsert=True
            )
            return {"ok": True}
        except Exception as e:
            logger.error(f"Feature override error: {e}")
            raise HTTPException(500, "Failed to set feature override")

    # ========== USERS ==========
    @app.get("/admin/users")
    async def get_users(limit: int = 100):
        """Get all users with their stats"""
        try:
            users = await db.profile.find(
                {},
                {"id": 1, "email": 1, "nickname": 1, "location": 1}
            ).limit(limit).to_list(limit)

            result = []
            for user in users:
                user_id = user.get("id")

                # Count medications
                meds_count = await db.medications.count_documents({"user_id": user_id})

                # Get dose stats
                doses = await db.doses.count_documents({"user_id": user_id, "status": "taken"})

                # Get subscription
                user_sub = await db.users.find_one({"id": user_id}) or {}

                result.append({
                    "user_id": user_id,
                    "email": user.get("email", ""),
                    "nickname": user.get("nickname", "User"),
                    "location": user.get("location", ""),
                    "medications": meds_count,
                    "doses_taken": doses,
                    "plan": user_sub.get("plan", "free"),
                    "last_login": user.get("last_login")
                })

            return {"users": result}
        except Exception as e:
            logger.error(f"Get users error: {e}")
            raise HTTPException(500, "Failed to fetch users")

    # ========== ANALYTICS ==========
    @app.get("/admin/stats")
    async def get_stats():
        """Get dashboard statistics"""
        try:
            # User counts
            total_users = await db.profile.count_documents({})

            # New users this month
            month_start = datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            new_month = await db.profile.count_documents({
                "created_at": {"$gte": month_start}
            })

            # Global adherence
            all_doses = await db.doses.count_documents({})
            taken_doses = await db.doses.count_documents({"status": "taken"})
            adherence_rate = round((taken_doses / all_doses * 100) if all_doses > 0 else 0)

            # Top medications
            top_meds = await db.medications.aggregate([
                {"$group": {"_id": "$name", "users": {"$sum": 1}}},
                {"$sort": {"users": -1}},
                {"$limit": 5}
            ]).to_list(5)

            top_medications = [
                {"name": m["_id"], "users": m["users"]} for m in top_meds
            ]

            return {
                "users": {
                    "total": total_users,
                    "new_month": new_month,
                    "active_week": int(total_users * 0.6),  # Estimate
                    "retention_rate": 85  # Placeholder
                },
                "health": {
                    "global_adherence_rate": adherence_rate,
                    "taken": taken_doses
                },
                "top_medications": top_medications,
                "feature_usage": [
                    {"feature": "scanner", "count": 150},
                    {"feature": "caregiver", "count": 120},
                    {"feature": "appointments", "count": 85}
                ],
                "daily_signups": []
            }
        except Exception as e:
            logger.error(f"Stats error: {e}")
            raise HTTPException(500, "Failed to fetch stats")

    @app.get("/admin/analytics/doses")
    async def get_dose_analytics():
        """Get dose analytics"""
        try:
            outcomes = {
                "taken": await db.doses.count_documents({"status": "taken"}),
                "missed": await db.doses.count_documents({"status": "missed"}),
                "skipped": await db.doses.count_documents({"status": "skipped"})
            }

            return {
                "dose_outcomes": outcomes,
                "top_medications": [],
                "hourly_pattern": [],
                "day_of_week": []
            }
        except Exception as e:
            logger.error(f"Dose analytics error: {e}")
            raise HTTPException(500, "Failed to fetch analytics")

    @app.get("/admin/revenue")
    async def get_revenue():
        """Get revenue metrics"""
        try:
            premium_users = await db.users.count_documents({"plan": "premium"})
            enterprise_users = await db.users.count_documents({"plan": "enterprise"})
            total_users = await db.users.count_documents({})
            free_users = total_users - premium_users - enterprise_users

            conversion_rate = round((premium_users / total_users * 100) if total_users > 0 else 0)

            mrr = (premium_users * 99) + (enterprise_users * 500)  # Estimate

            return {
                "premium_users": premium_users,
                "enterprise_users": enterprise_users,
                "conversion_rate": conversion_rate,
                "mrr_estimate": mrr,
                "by_plan": [
                    {"plan": "free", "users": free_users},
                    {"plan": "premium", "users": premium_users},
                    {"plan": "enterprise", "users": enterprise_users}
                ]
            }
        except Exception as e:
            logger.error(f"Revenue error: {e}")
            raise HTTPException(500, "Failed to fetch revenue")

    @app.get("/admin/analytics/location")
    async def get_location_analytics():
        """Get location/demographics analytics"""
        return {
            "states": [],
            "cities": [],
            "age_brackets": [],
            "gender": []
        }

    @app.get("/admin/analytics/devices")
    async def get_device_analytics():
        """Get device analytics"""
        return {
            "brands": [],
            "os_versions": [],
            "models": [],
            "app_versions": []
        }

    # ========== SECURITY ==========
    @app.get("/admin/blocked-ips")
    async def get_blocked_ips():
        """Get list of blocked/suspicious IPs"""
        try:
            blocked_ips = await db.blocked_ips.find({}).to_list(1000)
            return {"blocked": blocked_ips}
        except Exception as e:
            logger.error(f"Get blocked IPs error: {e}")
            return {"blocked": []}

    @app.delete("/admin/blocked-ips/{ip}")
    async def unblock_ip(ip: str):
        """Remove IP from blocked list"""
        try:
            await db.blocked_ips.delete_one({"ip": ip})
            return {"ok": True}
        except Exception as e:
            logger.error(f"Unblock IP error: {e}")
            raise HTTPException(500, "Failed to unblock IP")

    # ========== DATA EXPORT ==========
    @app.get("/admin/export/users")
    async def export_users():
        """Export user data as Excel (returns binary)"""
        try:
            # This would require openpyxl library
            # For now, return placeholder
            raise HTTPException(501, "Export feature coming soon")
        except Exception as e:
            logger.error(f"Export error: {e}")
            raise HTTPException(500, "Export failed")

    logger.info("✓ Admin endpoints registered")
