# PillCare - Security Architecture Specification

## 1. Zero-Trust Security Pillars

```text
+-----------------------------------------------------------------------+
|  1. LOCAL DATA ENCRYPTION AT REST (AES-256 via expo-secure-store)     |
+-----------------------------------------------------------------------+
|  2. DATA IN TRANSIT PROTECTION (TLS 1.3 Encryption for all HTTPS REST) |
+-----------------------------------------------------------------------+
|  3. ORM PARAMETERIZATION (Protection against SQLi & XSS Fuzzing)      |
+-----------------------------------------------------------------------+
|  4. ADMIN AUTHENTICATION GATEWAY (HMAC-SHA256 & Header Verification) |
+-----------------------------------------------------------------------+
```

---

## 2. Threat Matrix & Defensive Controls

| Threat Vector | Severity | Mitigation Control | Verification Result |
| :--- | :---: | :--- | :---: |
| **SQL Injection (SQLi)** | **Critical** | Parameterized queries via FastAPI ORM. Malicious inputs like `' DROP TABLE medications; --` handled safely as literal strings. | 🟢 PASSED |
| **Cross-Site Scripting (XSS)** | **High** | HTML tag stripping and React Native text node escaping (`<script>` tags neutralized). | 🟢 PASSED |
| **Unauthorized Admin Access** | **Critical** | 401 Unauthorized block on `/admin/*` routes when `x-admin-secret` or session cookie is missing. | 🟢 PASSED |
| **Man-in-the-Middle (MitM)** | **High** | SSL Certificate pinning and strict TLS 1.3 protocol enforcement. | 🟢 PASSED |
