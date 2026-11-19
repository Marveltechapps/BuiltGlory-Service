# AWS Environment Configuration

## Purpose

Keep local, staging, and production configuration separate for the Customer WebApp and the API.

## Current configuration

| | Local | Staging template | Production template |
|---|---|---|---|
| API env file | `.env.example` | `.env.staging.example` | `.env.production.example` |
| Web env file | `.env.example` | `.env.staging.example` | `.env.production.example` |
| `NODE_ENV` | `development` | `staging` | `production` |
| API URL | `http://localhost:5001/api/v1` | `https://staging-api.builtglory.com/api/v1` | `https://api.builtglory.com/api/v1` |
| Web origin | `http://localhost:3000` | `https://staging-app.builtglory.com` | `https://app.builtglory.com` |
| Admin origin | `http://localhost:5173` | `https://staging-admin.builtglory.com` | `https://admin.builtglory.com` |
| MongoDB | `mongodb://127.0.0.1:27017/builtglory` | database name `builtglory_staging` | database name `builtglory` |
| Redis | `redis://127.0.0.1:6379` | `rediss://` staging host | `rediss://` production host |
| S3 | empty locally | `builtglory-staging-private` | `buildglory-version3` (name already in the production template) |
| SMS | vendor URL placeholder | `SMS_DELIVERY_MODE=log` | `vendor` |

Staging hostnames are proposed. They are not delegated records.

`NEXT_PUBLIC_API_BASE_URL` is baked in at `next build` / Docker build. Changing it later does not change an already built image.

## Identified issues

- A filled production `.env` must never be committed. Both repos ignore `.env` and `.env.*` except the example files.
- Runtime `env.js` is stricter for `production` than for `staging` (TLS Redis, HTTPS CORS). The staging example validator is stricter than the runtime. Do not point staging at production by editing only `NODE_ENV`.
- The web production build on a developer machine still defaults to localhost if the variable is unset.

## Required AWS services

None for local. Staging and production need the services listed in the other documents in this folder. Secrets Manager holds the filled values; the example files do not.

## Exact configuration steps

1. Local API: copy `BG-Service/.env.example` to `.env`. Use local MongoDB and Redis only.
2. Local web: copy `BG-Webapp/.env.example` to `.env.local`.
3. Staging and production: create the secret JSON from the matching example. Replace every `REPLACE`, `USER`, `PASS`, and `HOST`. Use different JWT secrets per environment.
4. Confirm the staging MongoDB database name contains `staging`.
5. Confirm staging CORS hosts contain `staging` and are not `app.builtglory.com` or `admin.builtglory.com`.
6. Build the web app with the matching `NEXT_PUBLIC_API_BASE_URL`.

## AWS Console navigation steps

Not used for local files. For hosted env vars, see `AWS_SECRETS_MANAGER_IAM.md`.

## AWS CLI commands

Do not `aws secretsmanager put-secret-value` until the secret resource is approved. Validation on the templates:

```bash
cd BG-Service
npm run env:validate:prod:example
npm run env:validate:staging:example

cd ../BG-Webapp
npm run env:validate:prod:example
npm run env:validate:staging:example
```

## Required environment variable names

API, minimum for staging and production:

`NODE_ENV`, `PORT`, `MONGODB_URI`, `MONGODB_DNS_SERVERS`, `REDIS_URL`, `REDIS_TLS_REJECT_UNAUTHORIZED`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `JWT_ISSUER`, `JWT_AUDIENCE`, `CORS_ORIGINS`, `APP_PUBLIC_URL`, `AWS_REGION`, `AWS_S3_BUCKET`, `AWS_USE_INSTANCE_ROLE`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `QUARANTINE_S3_BUCKET`, `SMS_DELIVERY_MODE`, `SMS_VENDOR_URL`, `EMAIL_TRANSPORT`, `EMAIL_FROM`, `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`

Web:

`NEXT_PUBLIC_API_BASE_URL`

## Configuration examples without real secrets

```text
NEXT_PUBLIC_API_BASE_URL=https://api.builtglory.com/api/v1
CORS_ORIGINS=https://app.builtglory.com,https://admin.builtglory.com
REDIS_URL=rediss://default:PASSWORD@redis-host:6379
MONGODB_URI=mongodb+srv://USER:PASSWORD@cluster-host/builtglory?retryWrites=true&w=majority
AWS_USE_INSTANCE_ROLE=true
```

When `AWS_USE_INSTANCE_ROLE=true`, leave the access key variables empty. The S3 and SES clients already omit static credentials in that case and use the task role.

## Expected output

Each validator prints `PASS` and lengths of JWT secrets, not the secret text.

## Security considerations

Staging SMS stays in `log` mode until a separate SMS account is approved, so staging cannot text customers. Production rejects `SMS_DELIVERY_MODE=log`. Never copy the production URI into the staging secret.

## Dependencies and prerequisites

Node.js 20. API validator uses the repo's `dotenv`. Web validator does not.

## Completion status

Templates and validators: done and executed. Real staging and production secret stores: not created.

## Pending manual approvals

Creating the staging Atlas database, staging Redis, staging bucket, and storing secrets.
