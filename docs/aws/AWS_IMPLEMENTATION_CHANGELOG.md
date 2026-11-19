# AWS Implementation Changelog

## Purpose

List repository changes made for AWS preparation. No commit was created.

## Current configuration

Both repositories stayed on `main`. Existing uncommitted work was kept. No AWS resource was created. No production deploy ran.

## Identified issues

Fixed in files, not in the AWS account. Account issues remain open and are listed in the handover report.

## Required AWS services

Unchanged. Services are documented, not provisioned.

## Exact configuration steps

The edits are the steps. Details are in the other documents.

## AWS Console navigation steps

None performed.

## AWS CLI commands

None performed.

## Required environment variable names

Added `AWS_USE_INSTANCE_ROLE` to the API production and staging templates. Added staging URL variable usage for the web app. No new secret values.

## Configuration examples without real secrets

See `.env.staging.example` in each app.

## Expected output

Validators PASS, recorded in `AWS_COMMANDS_AND_EXECUTION_GUIDE.md`.

## Security considerations

Dockerfiles run as `node`. Images do not copy `.env`. Deploy workflows cannot fire on push. Staging template cannot name the production database or production CORS hosts without failing validation.

## Dependencies and prerequisites

None beyond the files below.

## Completion status

In-repo changes: done. Account changes: not started.

## Pending manual approvals

Commit, push, and every console change.

### BG-Service files

| File | Change |
|---|---|
| `src/server.js` | Staging no longer hops to another port when `PORT` is busy |
| `scripts/validate-production-env.mjs` | Staging must use TLS Redis, HTTPS staging hosts, a staging database name, and a staging bucket name. Instance role can replace static keys |
| `package.json` | `env:validate:staging:example` |
| `.env.production.example` | Documents `AWS_USE_INSTANCE_ROLE` |
| `.env.staging.example` | New staging template |
| `.gitignore` | Keeps staging example and `docs/aws` markdown |
| `Dockerfile`, `.dockerignore` | API image, non-root, no secrets |
| `deploy/docker-compose.local.yml` | Local only |
| `deploy/nginx.admin.example.conf` | HTTP to HTTPS redirect |
| `deploy/nginx.webapp.example.conf` | Customer site proxy |
| `deploy/systemd/builtglory-api.service` | Restart and SIGTERM |
| `deploy/iam/api-task-role-policy.json` | Least-privilege template |
| `deploy/iam/s3-private-bucket-policy.json` | Deny public ACL and non-TLS |
| `.github/workflows/config-check.yml` | Validate only |
| `.github/workflows/deploy-gated.yml` | Manual gate, no AWS calls |
| `docs/aws/*.md` | These 16 documents |

### BG-Webapp files

| File | Change |
|---|---|
| `package.json` | Node `>=20`, `start:standalone`, env validate scripts |
| `.env.staging.example` | Staging API URL |
| `.gitignore` | Track the staging example |
| `scripts/validate-public-env.mjs` | HTTPS `/api/v1` check, staging host must not be production |
| `Dockerfile`, `.dockerignore` | Standalone image, build fails without the API URL |
| `.github/workflows/config-check.yml` | URL check only |
| `.github/workflows/deploy-gated.yml` | Manual gate, no AWS calls |

Application routes, database schemas, and API contracts were not changed.
