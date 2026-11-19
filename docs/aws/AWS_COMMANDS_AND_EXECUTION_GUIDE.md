# AWS Commands and Execution Guide

## Purpose

List commands that are safe now and commands that wait for approval. Commands that create resources are labeled **do not run yet**.

## Current configuration

Local validators passed in this session:

- `BG-Service`: production example PASS, staging example PASS, IAM JSON parsed, `node --check src/server.js` included in the same successful script.
- `BG-Webapp`: production URL PASS (`api.builtglory.com/api/v1`), staging URL PASS (`staging-api.builtglory.com/api/v1`).

Docker image builds were not run. AWS CLI was not pointed at an account.

## Identified issues

Running create, delete, or `put-secret-value` commands from a laptop that also holds the shared database URI can change production. The safe list does not include those commands.

## Required AWS services

None for the safe list.

## Exact configuration steps

Safe, from the repo roots:

```bash
cd BG-Service
npm run env:validate:prod:example
npm run env:validate:staging:example
node --check src/server.js
node -e "JSON.parse(require('fs').readFileSync('deploy/iam/api-task-role-policy.json','utf8')); JSON.parse(require('fs').readFileSync('deploy/iam/s3-private-bucket-policy.json','utf8'))"

cd ../BG-Webapp
node scripts/validate-public-env.mjs --file .env.production.example
node scripts/validate-public-env.mjs --file .env.staging.example
```

If Docker is installed, config-check the local compose file. Do not `up` it against a cloud URI:

```bash
docker compose -f BG-Service/deploy/docker-compose.local.yml config
```

Read-only AWS, after the engineer has a non-root profile. Empty output means not configured:

```bash
aws sts get-caller-identity
aws s3api get-public-access-block --bucket buildglory-version3 --region ap-south-1
aws ses get-identity-verification-attributes --identities admin@builtglory.com noreply@builtglory.com --region ap-south-1
aws elasticache describe-replication-groups --region ap-south-1
aws elbv2 describe-load-balancers --region ap-south-1
aws route53 list-hosted-zones
```

**Do not run yet:** `aws ec2 run-instances`, `aws elbv2 create-load-balancer`, `aws elasticache create-replication-group`, `aws s3api create-bucket`, `aws secretsmanager create-secret`, `aws route53 change-resource-record-sets`, `aws acm request-certificate`, any `delete-*`.

## AWS Console navigation steps

Read-only walk, region **ap-south-1**:

1. S3 → `buildglory-version3` → Permissions → Block public access.
2. SES → Identities → verification status.
3. EC2 → Load Balancers. Note if the list is empty.
4. ElastiCache → Redis caches. Note if the list is empty.
5. Secrets Manager → search `builtglory/`. Note if missing.
6. Route 53 → hosted zones. Do not edit records.

## AWS CLI commands

See the blocks above. Reverse of a read command is not required. Reverse of a future create is in the matching document and always needs approval.

## Required environment variable names

Validators read the example files. They do not need the developer `.env`.

## Configuration examples without real secrets

Example success lines:

```text
PASS production env validation (secrets not printed).
PASS production web env (api.builtglory.com/api/v1).
PASS staging web env (staging-api.builtglory.com/api/v1).
```

## Expected output

Those PASS lines. AWS read commands either describe real resources or return empty lists. Do not invent ids to fill the gap.

## Security considerations

`get-secret-value`, Atlas connection strings, and `aws s3 cp` of document prefixes are out of this guide. SES test email scripts in the API repo stay behind their existing approval flags.

## Dependencies and prerequisites

Node 20 for the API validator (`npm` scripts). The web script is plain Node.

## Completion status

Safe local commands: executed. AWS read-only commands: not executed. Create commands: not authorized.

## Pending manual approvals

Every create and DNS change. Installing Docker images on a server.
