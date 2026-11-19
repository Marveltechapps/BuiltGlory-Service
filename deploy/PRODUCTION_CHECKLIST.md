# BuiltGlory production deployment checklist

Do not deploy without explicit approval. Manual external steps: `deploy/MANUAL_SETUP.md`.

## Integration / config evidence

| Check | Status | Notes |
|-------|--------|--------|
| S3 HeadBucket + put/get/delete | Code+verified | Bucket name (not ARN); see prior `check:integrations` |
| SES transport + retries + identity errors | **Implemented** | `EMAIL_TRANSPORT=ses`, retry on transient errors |
| SES identity verified + controlled send | **Manual** | `npm run check:ses` then dual-flag `email:test:controlled` |
| MongoDB Atlas replica set | Verified (env-dependent) | `hello.setName` |
| Redis client TLS / reconnect | **Implemented** | `rediss://` + retry/reconnect in `redisOptions.js` |
| Managed Redis TLS URL | **Manual** | Provision `rediss://…` (non-local) |
| CORS / APP_PUBLIC_URL HTTPS guards | **Implemented** | Rejected at startup + `env:validate:prod` |
| Dashboard HTTPS API / Socket | **Implemented** | `runtimeConfig.ts` + nginx example |
| SMS / Firebase safe checks | Scripts ready | No OTP/push without approval |

## Pre-flight

- [ ] `.env.production` created from `.env.production.example`
- [ ] `npm run env:validate:prod` passes (rejects localhost, http CORS, weak JWT, non-TLS Redis, Gmail SMTP, S3 ARN)
- [ ] `npm run check:integrations` against staging/prod-like credentials
- [ ] `npm run check:ses` → from identity `Success`
- [ ] Controlled email only after dual flags + owner approval
- [ ] Managed Redis `rediss://` + `npm run check:redis-sessions`
- [ ] `CORS_ORIGINS` HTTPS only; `APP_PUBLIC_URL=https://…`
- [ ] Reverse proxy for `/api` + `/socket.io` (`deploy/nginx.admin.example.conf`) or HTTPS `VITE_API_URL`
- [ ] JWT secrets unique ≥48 chars; `JWT_ISSUER` / `JWT_AUDIENCE` set
- [ ] `SMS_DELIVERY_MODE=vendor`
- [ ] MongoDB backup tested
- [ ] **Written deploy approval**

## Deploy steps (after approval)

1. Maintenance window if needed
2. MongoDB snapshot
3. Deploy API with `.env.production`; `npm run migrate` if required
4. Confirm Redis sessions after test admin login
5. Deploy Dashboard + reverse proxy
6. Smoke: login, refresh, CRUD, Socket inbox, SES to admin only
7. Watch errors 30–60 minutes

## Rollback

1. Revert app release to previous artifact
2. Prefer keeping new JWT secrets (force re-login) unless explicitly restoring old secrets
3. Restore Mongo snapshot if migration incompatible
4. Flush `session:*` / `refresh:*` only if refresh tokens are cross-version invalid
5. Re-point DNS/proxy to previous Dashboard
6. Verify `/health`, admin login, OTP path

## Explicit non-actions

- No customer SMS/email/push during validation
- No production deploy without written approval
- No wildcard CORS / in-memory Redis / localhost production URLs
- No dummy credentials or fake PASS results
