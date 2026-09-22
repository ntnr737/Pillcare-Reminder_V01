# PillCare - Database Design & ERD Specification

## 1. Relational Entity Relationship Diagram (ERD)

```text
+-------------------+       1:N       +-----------------------+
|      users        |----------------<|      medications      |
+-------------------+                 +-----------------------+
| id (PK)           |                 | id (PK)               |
| user_id (UNIQUE)  |                 | user_id (FK)          |
| name              |                 | name, dosage, unit    |
| email, phone      |                 | times (JSON Array)    |
| plan (free/pro)   |                 | stock, refill_thresh  |
| feature_overrides |                 +-----------------------+
+-------------------+                             |
          | 1:N                                   | 1:N
          v                                       v
+-------------------+                 +-----------------------+
|    caregivers     |                 |    medication_logs    |
+-------------------+                 +-----------------------+
| id (PK)           |                 | id (PK)               |
| user_id (FK)      |                 | medication_id (FK)    |
| caregiver_phone   |                 | status (taken/missed) |
| relationship      |                 | timestamp_iso         |
+-------------------+                 +-----------------------+
```

---

## 2. DDL Schema Definitions (SQLite / PostgreSQL)

### 2.1 `users` Table
```sql
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT UNIQUE NOT NULL,
    email TEXT,
    name TEXT,
    plan TEXT DEFAULT 'free',
    feature_overrides TEXT DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 2.2 `medications` Table
```sql
CREATE TABLE medications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    generic_name TEXT,
    dosage TEXT NOT NULL,
    unit TEXT NOT NULL,
    times TEXT NOT NULL, -- JSON Array: ["08:00", "20:00"]
    start_date TEXT NOT NULL,
    stock INTEGER DEFAULT 30,
    refill_threshold INTEGER DEFAULT 5,
    food_relation TEXT DEFAULT 'with_food',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(user_id)
);
```

### 2.3 `announcements` Table
```sql
CREATE TABLE announcements (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    type TEXT DEFAULT 'offer',
    target_plan TEXT DEFAULT 'all',
    link_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```
