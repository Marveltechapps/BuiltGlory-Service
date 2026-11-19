# Manual production setup (external actions)

These steps cannot be completed from application code alone. Complete them, then re-run validation. **Do not deploy without written approval.**

## 1. AWS SES identity verification

1. In AWS Console → Amazon SES (`ap-south-1` or your `AWS_REGION`):
   - Verify **domain** `builtglory.com` (recommended), **or**
   - Verify email identity for `EMAIL_FROM` / `ADMIN_EMAIL`.
2. Open the verification link from the SES email (identity status must become `Success`).
3. If the account is in the SES sandbox, request production access (or only send to verified addresses).
4. Confirm IAM user/role used by the API allows at least:
   - `ses:SendEmail`, `ses:SendRawEmail`
   - `ses:GetSendQuota`, `ses:ListIdentities`, `ses:GetIdentityVerificationAttributes`
5. Set in `.env.production`:
   ```
   EMAIL_TRANSPORT=ses
   EMAIL_FROM=<verified-address-or-domain-mail>
   AWS_REGION=ap-south-1
   AWS_ACCESS_KEY_ID=…
   AWS_SECRET_ACCESS_KEY=…
   ```
6. Safe checks (no customer mail):
   ```
   npm run check:ses
   ```
7. Controlled test email (requires dual approval flags; admin recipient only):
   ```
   APPROVE_TEST_EMAIL=1 SEND_INTEGRATION_TEST_EMAIL=1 INTEGRATION_TEST_EMAIL=admin@… npm run email:test:controlled
   ```

## 2. Managed Redis TLS (`rediss://`)

1. Provision Redis with TLS (ElastiCache, Redis Cloud, Azure Cache, Memorystore, etc.).
2. Copy the TLS connection string, e.g. `rediss://default:PASSWORD@HOST:6379`.
3. Put it in `.env.production` as `REDIS_URL` (never `redis://`, never localhost).
4. Keep `REDIS_TLS_REJECT_UNAUTHORIZED=true` unless your provider requires a private CA workflow.
5. Validate from a host that can reach the cache:
   ```
   npm run check:redis-sessions
   npm run check:integrations
   ```
6. Production boot **rejects** missing Redis, non-TLS Redis, and localhost Redis.

## 3. Production domains, DNS, TLS, reverse proxy

1. Create DNS A/AAAA (or CNAME) records, for example:
   - `admin.builtglory.com` → Dashboard static host / CDN
   - `api.builtglory.com` → API load balancer / Node host
2. Issue TLS certificates (ACM, Let’s Encrypt, Cloudflare, etc.).
3. Prefer **same-origin** Dashboard hosting with reverse proxy (see `nginx.admin.example.conf`):
   - `/` → Dashboard static assets
   - `/api` → API
   - `/socket.io` → API with WebSocket upgrade
4. Set API env:
   ```
   CORS_ORIGINS=https://admin.builtglory.com,https://app.builtglory.com
   APP_PUBLIC_URL=https://api.builtglory.com
   ```
5. Dashboard build:
   - Same-origin proxy: omit or leave `VITE_API_URL` empty in runtime terms; use the nginx example.
   - Split host: `VITE_API_URL=https://api.builtglory.com` (HTTPS only).
6. Validate:
   ```
   npm run env:validate:prod
   ```

## 4. Production deployment approval

Required before any production cutover:

- [ ] Written approval from the product/ops owner
- [ ] MongoDB backup / snapshot taken
- [ ] `.env.production` validated (`npm run env:validate:prod`)
- [ ] `npm run check:integrations` and `npm run check:ses` green for intended environment
- [ ] Rollback owner + previous release artifact identified

Until approval is granted, stop at staging verification. Do not point production DNS at a new release.
