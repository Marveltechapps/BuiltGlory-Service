# AWS Infrastructure Audit

## Purpose

Record what AWS-related configuration exists in `BG-Webapp` and `BG-Service` on branch `main`, what was added in-repo, and what does not exist in AWS. This session did not sign in to an AWS account and did not create billable resources.

## Current configuration

Verified in the repositories:

| Area | State |
|---|---|
| API runtime | Node.js `>=20`, `npm start` → `node src/server.js`, listen port `PORT` default `5001` |
| Web runtime | Next.js `16.4.6`, `output: 'standalone'`, port `3000` when using the standalone server |
| Health | `GET /health` and `GET /ready` on the API. `/ready` does not ping MongoDB or Redis |
| Shutdown | `SIGTERM` / `SIGINT`, 10 second timeout, closes HTTP, MongoDB, Redis, and Socket.IO |
| Port bind | Production and staging refuse to hop to another port if `PORT` is busy. Development may |
| CORS | Allow-list from `CORS_ORIGINS`. Production validation rejects `*`, `http://`, and localhost |
| Redis | `rediss://` required by the staging/production example validator. Runtime schema requires TLS only when `NODE_ENV=production` |
| MongoDB | `MONGODB_URI`. Production template uses `mongodb+srv`. No AWS DocumentDB client |
| S3 | `@aws-sdk/client-s3` put/get/delete and 15-minute pre-signed URLs. Empty access keys fall back to the SDK default chain |
| SES | `EMAIL_TRANSPORT=ses` via `@aws-sdk/client-ses` |
| Region default | `ap-south-1` |
| Process files added | `BG-Service/Dockerfile`, `deploy/systemd/builtglory-api.service`, `deploy/docker-compose.local.yml` (local only) |
| Web files added | `BG-Webapp/Dockerfile`, `npm run start:standalone` |
| CI added | Config-check workflows and a manual deploy gate that does not call AWS |
| IaC | None. No Terraform, CDK, ECS task definition, or CloudFormation stack |
| Live AWS account | Not inspected in this task |

Hostnames in templates (`api.builtglory.com`, `app.builtglory.com`, `admin.builtglory.com`, and `staging-*`) are names already used or proposed in repo files. They are not proof that Route 53 records exist.

A prior readiness note in the workspace reported an S3 bucket name `buildglory-version3`, an Atlas replica set, and an SES identity still pending. Those calls were not repeated here. Treat them as unverified until the AWS engineer checks the console.

## Identified issues

1. No VPC, load balancer, compute service, or DNS is defined in either repository.
2. Production and staging secrets are not in Secrets Manager. Templates still show static access-key placeholders.
3. The API process logs a normalized phone number when an OTP send starts (`auth.service.js`). That must not be shipped to CloudWatch until redacted. Application change is left to the backend developer.
4. `/ready` does not check dependencies, so a load balancer can mark a process healthy while MongoDB or Redis is down.
5. `next start` warns that standalone output should be launched with `node .next/standalone/server.js`.
6. Customer KYC objects are private only if the bucket blocks public access. The application does not set a public ACL, but bucket policy was not confirmed.
7. Staging runtime (`env.js`) still allows non-TLS Redis. The example file and the validator do not.

## Required AWS services

EC2 or ECS/Fargate (choice needs approval), Application Load Balancer, ACM, Route 53, S3, SES, Secrets Manager, IAM, CloudWatch. ElastiCache or another private Redis. MongoDB stays on the existing Atlas-style URI unless a lead approves a move. Do not create these until the approvals in `AWS_FINAL_HANDOVER_REPORT.md` are signed.

## Exact configuration steps

1. Read `AWS_ENVIRONMENT_CONFIGURATION.md` and fill staging and production secrets outside Git.
2. Choose compute in `AWS_WEBAPP_DEPLOYMENT_GUIDE.md` and `AWS_BACKEND_DEPLOYMENT_GUIDE.md`. Do not provision yet.
3. Follow network, data, storage, IAM, and monitoring documents in this folder.
4. Run the local validators in `AWS_COMMANDS_AND_EXECUTION_GUIDE.md`.

## AWS Console navigation steps

There is no single console page for this audit. Start at the account home and confirm the region selector is **Asia Pacific (Mumbai) ap-south-1** before opening EC2, S3, SES, or Secrets Manager.

## AWS CLI commands

```bash
aws sts get-caller-identity
aws configure get region
```

Expected after the engineer has credentials: an account id and `ap-south-1`. This workspace run did not execute those commands.

## Required environment variable names

See `AWS_ENVIRONMENT_CONFIGURATION.md`. Do not put values in Git.

## Configuration examples without real secrets

Templates:

- `BG-Service/.env.example` — local
- `BG-Service/.env.staging.example`
- `BG-Service/.env.production.example`
- `BG-Webapp/.env.example`
- `BG-Webapp/.env.staging.example`
- `BG-Webapp/.env.production.example`

## Expected output

`npm run env:validate:prod:example` and `npm run env:validate:staging:example` in `BG-Service` print `PASS`. The web scripts print `PASS production web env` and `PASS staging web env`. Both passed in this session.

## Security considerations

No root user. No public MongoDB, Redis, or Node port. No public S3 objects for KYC. No production deploy from CI.

## Dependencies and prerequisites

AWS account access, domain control for the real DNS zone, Atlas project access, and written approval before any resource that costs money.

## Completion status

Repository audit and safe config files: done. AWS account configuration: not done.

## Pending manual approvals

Compute platform, DNS changes, new Redis, new S3 buckets, Secrets Manager, NAT Gateway, and any production cutover.
