# AWS Security Checklist

## Purpose

Give the AWS engineer a pass/fail list. Items marked "repo" were checked in code. Items marked "account" were not, because this session had no AWS console session.

## Current configuration

Repo controls already present:

- Helmet, no `x-powered-by` (covered by existing API tests).
- CORS allow-list, credentials on, no wildcard in production validation.
- Production HTTPS origin checks.
- JWT secrets rejected if they are the development defaults.
- Swagger hidden in production.
- `/metrics` not exposed off loopback.
- S3 client does not set a public ACL.
- Pre-signed URL lifetime capped at 15 minutes.
- Upload type and 25 MB limit.
- Graceful shutdown on `SIGTERM`.
- Example bucket policy denies non-TLS and public ACLs.
- CI deploy workflow cannot run on push.

## Identified issues

| # | Item | Status |
|---|---|---|
| 1 | Root access keys for deploy | Unknown. Do not create any. Account check pending |
| 2 | MFA on human admins | Account check pending |
| 3 | CloudTrail | Account check pending |
| 4 | S3 Block Public Access on `buildglory-version3` | Account check pending |
| 5 | Redis not public | Not provisioned |
| 6 | Security groups for 5001/3000/6379/27017 | Not provisioned |
| 7 | Static AWS keys vs task role | Role path prepared, not attached |
| 8 | Phone numbers in OTP logs | Open, backend owner |
| 9 | SES identity and sandbox | Prior note said pending. Not rechecked |
| 10 | Staging SMS | Template uses `log` so it does not text customers |
| 11 | Production secrets in Git | Example files use placeholders. Filled `.env` is gitignored |
| 12 | HSTS | Helmet on the API. Confirm ALB or Nginx also redirects HTTP |

## Required AWS services

IAM, S3, EC2 security groups, CloudTrail, Secrets Manager, ACM, WAF is optional and not configured.

## Exact configuration steps

1. Sign in as an IAM administrator, not root.
2. IAM → account settings → confirm root has MFA and no day-to-day access keys.
3. Run the S3 checks in `AWS_S3_STORAGE_CONFIGURATION.md`.
4. Attach the task role instead of keys.
5. Create security groups from `AWS_NETWORK_DOMAIN_SSL.md`.
6. Turn on CloudTrail if the account has no trail.
7. After SES is verified, send no bulk mail from this checklist.
8. WAF on the ALB is optional. Add it only with a budget line. Not required for the first private staging boot.

## AWS Console navigation steps

**IAM → Dashboard**. **S3 → bucket → Permissions**. **CloudTrail → Trails**. **Certificate Manager**. **VPC → Security groups**.

## AWS CLI commands

```bash
aws sts get-caller-identity
aws s3api get-public-access-block --bucket REPLACE_PRIVATE_BUCKET --region ap-south-1
aws cloudtrail describe-trails --region ap-south-1
```

`get-caller-identity` must not show the root account as the daily automation user. Compare the ARN. This command was not run here.

## Required environment variable names

`AWS_USE_INSTANCE_ROLE`, `CORS_ORIGINS`, `REDIS_URL`, `SMS_DELIVERY_MODE`.

## Configuration examples without real secrets

Task role name `builtglory-api-production`. Policy file `deploy/iam/api-task-role-policy.json`.

## Expected output

Public access block all true. CloudTrail trail status `IsLogging` true. Caller ARN is an IAM role or user, not `root`.

## Security considerations

KYC objects stay private. Do not add `0.0.0.0/0` to Redis or MongoDB. Do not disable TLS verification.

## Dependencies and prerequisites

Account administrator.

## Completion status

Repo checklist written. Account checklist not executed.

## Pending manual approvals

CloudTrail if absent, bucket policy edits, WAF, and IAM role creation.
