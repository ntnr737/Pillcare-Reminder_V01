"""
Advanced Analytics Engine - JP Morgan Level Intelligence
Real-time data syncing, comprehensive metrics, and enterprise reporting
"""

from datetime import datetime, timezone, timedelta
from typing import List, Dict, Optional
import logging
from pydantic import BaseModel

logger = logging.getLogger(__name__)


class AnalyticsTag(BaseModel):
    """Tag for categorizing and filtering analytics data"""
    key: str
    value: str
    timestamp: datetime


class UserMetrics(BaseModel):
    """Comprehensive user metrics"""
    user_id: str
    email: str
    nickname: str

    # Engagement Metrics
    days_active: int
    total_logins: int
    avg_session_duration: float
    last_active: datetime

    # Medication Adherence
    medications_count: int
    doses_total: int
    doses_taken: int
    doses_missed: int
    doses_skipped: int
    adherence_rate: float
    current_streak: int
    best_streak: int

    # Health Data
    measurements_count: int
    health_score: float

    # Engagement Score
    engagement_score: float  # 0-100
    churn_risk: str  # low, medium, high

    # Plan & Revenue
    plan: str
    subscription_status: str
    lifetime_value: float

    # Metadata
    tags: List[AnalyticsTag] = []
    created_at: datetime


class CohortAnalytics(BaseModel):
    """Cohort-based analytics"""
    cohort_date: str  # YYYY-MM
    users_count: int
    active_users: int
    retention_rate: float
    avg_adherence: float
    avg_engagement_score: float
    churn_users: int


class TimeSeriesMetric(BaseModel):
    """Time series data point"""
    timestamp: datetime
    value: float
    metric_name: str
    tags: Dict[str, str] = {}


async def setup_advanced_analytics(app, db):
    """Setup enterprise-grade analytics endpoints"""

    # ========== USER METRICS ==========
    @app.get("/admin/analytics/users/comprehensive")
    async def get_comprehensive_user_metrics(
        limit: int = 100,
        offset: int = 0,
        plan: Optional[str] = None,
        min_adherence: int = 0,
        sort_by: str = "engagement_score"
    ):
        """Get comprehensive metrics for all users with filtering and sorting"""
        try:
            query = {}
            if plan:
                query["plan"] = plan

            users = await db.profile.find(query).skip(offset).limit(limit).to_list(limit)

            result = []
            for user in users:
                user_id = user.get("id")

                # Get dose statistics
                doses = await db.doses.find({"user_id": user_id}).to_list(10000)
                doses_taken = len([d for d in doses if d.get("status") == "taken"])
                doses_missed = len([d for d in doses if d.get("status") == "missed"])
                doses_skipped = len([d for d in doses if d.get("status") == "skipped"])
                total_doses = len(doses)
                adherence_rate = round((doses_taken / total_doses * 100) if total_doses > 0 else 0)

                # Get engagement metrics
                meds_count = await db.medications.count_documents({"user_id": user_id})
                measurements = await db.measurements.find({"user_id": user_id}).to_list(1000)

                # Calculate engagement score (0-100)
                engagement_score = min(100, (
                    (adherence_rate * 0.4) +  # 40% adherence
                    (min(meds_count, 10) * 5) +  # Up to 50% for medications
                    (min(len(measurements), 10) * 1)  # Up to 10% for measurements
                ))

                # Churn risk assessment
                if adherence_rate < 20:
                    churn_risk = "high"
                elif adherence_rate < 50:
                    churn_risk = "medium"
                else:
                    churn_risk = "low"

                # Get streak
                streak_info = await get_user_streak(db, user_id)

                # Get plan info
                user_plan = await db.users.find_one({"id": user_id}) or {}

                # Calculate lifetime value (estimate)
                plan = user_plan.get("plan", "free")
                days_active = (datetime.now(timezone.utc) - (user.get("created_at") or datetime.now(timezone.utc))).days + 1
                ltv = 0
                if plan == "premium":
                    ltv = (days_active / 30) * 99
                elif plan == "enterprise":
                    ltv = (days_active / 30) * 500

                result.append({
                    "user_id": user_id,
                    "email": user.get("email", ""),
                    "nickname": user.get("nickname", ""),
                    "days_active": days_active,
                    "last_active": user.get("last_active"),
                    "medications_count": meds_count,
                    "doses_total": total_doses,
                    "doses_taken": doses_taken,
                    "doses_missed": doses_missed,
                    "doses_skipped": doses_skipped,
                    "adherence_rate": adherence_rate,
                    "current_streak": streak_info.get("current_streak", 0),
                    "best_streak": streak_info.get("best_streak", 0),
                    "measurements_count": len(measurements),
                    "engagement_score": round(engagement_score, 2),
                    "churn_risk": churn_risk,
                    "plan": plan,
                    "lifetime_value": round(ltv, 2),
                    "health_score": calculate_health_score(doses_taken, doses_missed, len(measurements))
                })

            # Sort results
            sort_key_map = {
                "engagement_score": lambda x: x["engagement_score"],
                "adherence_rate": lambda x: x["adherence_rate"],
                "lifetime_value": lambda x: x["lifetime_value"],
                "churn_risk": lambda x: {"high": 0, "medium": 1, "low": 2}.get(x["churn_risk"], 3),
                "days_active": lambda x: x["days_active"]
            }

            if sort_by in sort_key_map:
                result.sort(key=sort_key_map[sort_by], reverse=True)

            return {
                "users": result,
                "total_count": await db.profile.count_documents(query),
                "offset": offset,
                "limit": limit
            }
        except Exception as e:
            logger.error(f"Comprehensive metrics error: {e}")
            raise

    # ========== COHORT ANALYSIS ==========
    @app.get("/admin/analytics/cohorts")
    async def get_cohort_analysis(months: int = 12):
        """Analyze user cohorts by signup month"""
        try:
            cohorts = []
            for i in range(months):
                month_start = datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
                month_start = month_start - timedelta(days=i*30)
                month_end = month_start + timedelta(days=32)

                # Users signed up in this month
                cohort_users = await db.profile.find({
                    "created_at": {"$gte": month_start, "$lt": month_end}
                }).to_list(10000)

                if not cohort_users:
                    continue

                users_count = len(cohort_users)

                # Active users (logged in last 30 days)
                thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)
                active_users = len([u for u in cohort_users if (u.get("last_active") or u.get("created_at")) > thirty_days_ago])

                # Calculate metrics
                adherence_rates = []
                engagement_scores = []

                for user in cohort_users:
                    doses = await db.doses.find({"user_id": user.get("id")}).to_list(1000)
                    if doses:
                        taken = len([d for d in doses if d.get("status") == "taken"])
                        adherence = (taken / len(doses)) * 100
                        adherence_rates.append(adherence)

                avg_adherence = sum(adherence_rates) / len(adherence_rates) if adherence_rates else 0

                cohorts.append({
                    "cohort_date": month_start.strftime("%Y-%m"),
                    "users_count": users_count,
                    "active_users": active_users,
                    "retention_rate": round((active_users / users_count * 100) if users_count > 0 else 0, 2),
                    "avg_adherence": round(avg_adherence, 2),
                    "churn_users": users_count - active_users
                })

            return {"cohorts": cohorts}
        except Exception as e:
            logger.error(f"Cohort analysis error: {e}")
            raise

    # ========== REAL-TIME DATA SYNC ==========
    @app.get("/admin/analytics/real-time")
    async def get_realtime_analytics():
        """Real-time dashboard metrics (last 24 hours)"""
        try:
            now = datetime.now(timezone.utc)
            last_24h = now - timedelta(hours=24)

            # Last 24h metrics
            new_users = await db.profile.count_documents({"created_at": {"$gte": last_24h}})
            active_users_24h = await db.profile.count_documents({"last_active": {"$gte": last_24h}})
            doses_taken_24h = await db.doses.count_documents({
                "recorded_at": {"$gte": last_24h},
                "status": "taken"
            })
            doses_missed_24h = await db.doses.count_documents({
                "recorded_at": {"$gte": last_24h},
                "status": "missed"
            })

            # Calculate 24h adherence
            total_doses_24h = doses_taken_24h + doses_missed_24h
            adherence_24h = (doses_taken_24h / total_doses_24h * 100) if total_doses_24h > 0 else 0

            # Trend calculation (compare to previous 24h)
            prev_24h_start = last_24h - timedelta(hours=24)
            prev_new_users = await db.profile.count_documents({
                "created_at": {"$gte": prev_24h_start, "$lt": last_24h}
            })

            new_users_trend = ((new_users - prev_new_users) / prev_new_users * 100) if prev_new_users > 0 else 0

            return {
                "timestamp": now.isoformat(),
                "period": "last_24h",
                "metrics": {
                    "new_users": new_users,
                    "new_users_trend": round(new_users_trend, 2),
                    "active_users": active_users_24h,
                    "doses_taken": doses_taken_24h,
                    "doses_missed": doses_missed_24h,
                    "adherence_rate": round(adherence_24h, 2)
                }
            }
        except Exception as e:
            logger.error(f"Real-time analytics error: {e}")
            raise

    # ========== ADVANCED FILTERING ==========
    @app.get("/admin/analytics/filter")
    async def get_filtered_analytics(
        metric: str,  # adherence, engagement, revenue, health
        min_value: Optional[float] = None,
        max_value: Optional[float] = None,
        plan: Optional[str] = None,
        days: int = 30
    ):
        """Advanced filtering and segmentation"""
        try:
            start_date = datetime.now(timezone.utc) - timedelta(days=days)

            users = await db.profile.find({}).to_list(10000)
            filtered_users = []

            for user in users:
                user_id = user.get("id")
                user_plan = await db.users.find_one({"id": user_id}) or {}

                if plan and user_plan.get("plan") != plan:
                    continue

                # Calculate requested metric
                if metric == "adherence":
                    doses = await db.doses.find({"user_id": user_id, "recorded_at": {"$gte": start_date}}).to_list(1000)
                    if doses:
                        taken = len([d for d in doses if d.get("status") == "taken"])
                        value = (taken / len(doses)) * 100
                    else:
                        value = 0

                elif metric == "engagement":
                    meds = await db.medications.count_documents({"user_id": user_id})
                    measurements = await db.measurements.count_documents({"user_id": user_id})
                    value = (meds * 5) + (measurements * 1)  # engagement score

                elif metric == "revenue":
                    plan_type = user_plan.get("plan", "free")
                    if plan_type == "premium":
                        value = 99
                    elif plan_type == "enterprise":
                        value = 500
                    else:
                        value = 0

                elif metric == "health":
                    measurements = await db.measurements.find({"user_id": user_id, "recorded_at": {"$gte": start_date}}).to_list(1000)
                    value = len(measurements)
                else:
                    value = 0

                # Apply filters
                if min_value is not None and value < min_value:
                    continue
                if max_value is not None and value > max_value:
                    continue

                filtered_users.append({
                    "user_id": user_id,
                    "email": user.get("email", ""),
                    "metric_value": round(value, 2),
                    "plan": user_plan.get("plan", "free")
                })

            # Sort by metric value
            filtered_users.sort(key=lambda x: x["metric_value"], reverse=True)

            return {
                "metric": metric,
                "users": filtered_users,
                "count": len(filtered_users),
                "date_range": f"last_{days}_days"
            }
        except Exception as e:
            logger.error(f"Filter analytics error: {e}")
            raise

    # ========== DATA TAGGING & TRACKING ==========
    @app.post("/admin/analytics/tag/{user_id}")
    async def tag_user_data(user_id: str, tag: str, value: str):
        """Tag user data for segmentation and tracking"""
        try:
            await db.user_tags.insert_one({
                "user_id": user_id,
                "tag": tag,
                "value": value,
                "created_at": datetime.now(timezone.utc)
            })
            return {"ok": True, "tag": tag, "value": value}
        except Exception as e:
            logger.error(f"Tag user error: {e}")
            raise

    @app.get("/admin/analytics/tagged/{tag}")
    async def get_tagged_users(tag: str, value: Optional[str] = None):
        """Get all users with specific tag"""
        try:
            query = {"tag": tag}
            if value:
                query["value"] = value

            tags = await db.user_tags.find(query).to_list(10000)
            user_ids = list(set([t.get("user_id") for t in tags]))

            users = []
            for uid in user_ids:
                user = await db.profile.find_one({"id": uid})
                if user:
                    users.append({
                        "user_id": uid,
                        "email": user.get("email", ""),
                        "nickname": user.get("nickname", ""),
                        "tags": [t for t in tags if t.get("user_id") == uid]
                    })

            return {"tag": tag, "users": users, "count": len(users)}
        except Exception as e:
            logger.error(f"Get tagged users error: {e}")
            raise

    logger.info("✓ Advanced analytics endpoints loaded")


# ========== HELPER FUNCTIONS ==========

async def get_user_streak(db, user_id: str) -> Dict:
    """Calculate current and best streak for user"""
    try:
        doses = await db.doses.find({"user_id": user_id}).sort("date", -1).to_list(1000)

        if not doses:
            return {"current_streak": 0, "best_streak": 0}

        # Group by date and check adherence
        daily_adherence = {}
        for dose in doses:
            date = dose.get("date", "")
            if date not in daily_adherence:
                daily_adherence[date] = {"taken": 0, "total": 0}
            daily_adherence[date]["total"] += 1
            if dose.get("status") == "taken":
                daily_adherence[date]["taken"] += 1

        # Calculate streaks (80%+ adherence = good day)
        current_streak = 0
        best_streak = 0
        temp_streak = 0

        for date in sorted(daily_adherence.keys(), reverse=True):
            adherence = daily_adherence[date]["taken"] / daily_adherence[date]["total"]
            if adherence >= 0.8:
                temp_streak += 1
                current_streak = temp_streak
            else:
                temp_streak = 0
            best_streak = max(best_streak, temp_streak)

        return {"current_streak": current_streak, "best_streak": best_streak}
    except Exception as e:
        logger.error(f"Streak calculation error: {e}")
        return {"current_streak": 0, "best_streak": 0}


def calculate_health_score(taken: int, missed: int, measurements: int) -> float:
    """Calculate overall health score"""
    if taken + missed == 0:
        return 0.0

    adherence_score = (taken / (taken + missed)) * 60  # 60% weight
    health_tracking_score = min(measurements / 10, 1.0) * 40  # 40% weight

    return round(adherence_score + health_tracking_score, 2)
