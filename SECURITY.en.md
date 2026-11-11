# Security Policy

[简体中文](./SECURITY.md) | English

## Supported versions

The project is in an early stage. Security fixes are provided only for the latest code on the `main` branch.

## Reporting a vulnerability

**Please do not disclose security issues through public issues, discussions, or pull requests.**

Use GitHub's private vulnerability reporting instead:

1. Open the **Security** tab of the repository
2. Click **Report a vulnerability**
3. Describe the reproduction steps, impact, and any suggested fix

Please include as much of the following as possible:

- Affected version or commit
- Vulnerability type (e.g. auth bypass, privilege escalation, injection, file upload)
- Reproduction steps or a minimal proof of concept
- The impact you believe it has

## Response process

- We will acknowledge the report and give an initial assessment within **7 days**
- Once fixed, we will credit you in the release notes (let us know in advance if you prefer to stay anonymous)
- Please do not disclose details publicly before the fixed release is published

## Deployment security checklist

Before deploying to production, make sure that:

- `JWT_SECRET` is set to a random value (`openssl rand -hex 32`)
- `ADMIN_EMAIL` points to your own email so admin rights do not fall into someone else's account
- `CORS_ORIGINS` is restricted to your actual domains instead of allowing all origins in production
- Database and Redis use strong passwords and are not exposed to the public internet
- The database and uploaded file directory are backed up regularly
