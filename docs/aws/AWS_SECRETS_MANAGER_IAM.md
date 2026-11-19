# AWS Secrets Manager and IAM

## Purpose

Map every secret the API needs to a Secrets Manager name and a least-privilege role. No secret values are stored in this document.

## Current configuration

- Secrets are environment variables. There is no Secrets Manager SDK call in the API. The process reads `process.env` at startup (`src/config/env.js`).
- Static AWS keys are optional at runtime. Set `AWS_USE_INSTANCE_ROLE=true` and leave the key variables empty so EC2/ECS roles are used.
- Policy templates (not attached):
  - `BG-Service/deploy/iam/api-task-role-policy.json`
  - `BG-Service/deploy/iam/s3-private-bucket-policy.json`
- CI deploy workflows do not read AWS credentials.

## Identified issues

- Long-lived access keys in a server `.env` are the current path if a role is not used.
- The task-role template contains `ACCOUNT_ID` and bucket placeholders. It is not a live policy.
- MFA, CloudTrail, and account password policy cannot be verified without account access.
- Firebase private keys and SMS passwords are secrets and must not sit in Git.

## Required AWS services

IAM and Secrets Manager. CloudTrail should already be on for the account; if it is off, enabling it is an account-level change that needs approval.

## Exact configuration steps

1. Create two IAM roles. Do not use the root user.
   - `builtglory-api-staging` and `builtglory-api-production`. Trust EC2 or `ecs-tasks.amazonaws.com`, matching the compute choice.
   - Attach the task policy after replacing placeholders. Do not attach `AdministratorAccess`.
2. Create a deploy role for CI later, with `ecs:UpdateService` or SSM permissions only. Do not add it until deployment is approved. This task's GitHub workflows do not assume a role.
3. Create secrets (one JSON secret per environment):

| Secret name | Keys inside JSON |
|---|---|
| `builtglory/staging/api` | `MONGODB_URI`, `REDIS_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `SMS_VENDOR_URL`, `FIREBASE_PRIVATE_KEY`, `AWS_ACCESS_KEY_ID` only if not using a role, `AWS_SECRET_ACCESS_KEY` only if not using a role |
| `builtglory/production/api` | same keys, production values, different JWT secrets |
| `builtglory/staging/web` | `NEXT_PUBLIC_API_BASE_URL` (not highly sensitive, but keep build config with the other env data) |
| `builtglory/production/web` | `NEXT_PUBLIC_API_BASE_URL` |

4. On boot, the host writes those keys into the process environment. `systemd` uses `EnvironmentFile=/etc/builtglory/api.env` with mode `0600`. ECS uses the `secrets` array in the task definition with `valueFrom` ARNs. Do not bake the file into the image.
5. Rotation: JWT rotation logs every user out. Plan it. Redis AUTH and MongoDB passwords can rotate by writing the new secret and restarting tasks.
6. Enable MFA on every human IAM user that can change these roles.

## AWS Console navigation steps

**IAM → Roles → Create role → AWS service → EC2 or Elastic Container Service Task**. Attach a customer-managed policy pasted from the JSON template.

**Secrets Manager → Store a new secret → Other type of secret → Key/value**. Name `builtglory/production/api`. Do not enable automatic rotation until a Lambda exists; there is no rotation Lambda in this repo.

**IAM → Users**. Confirm no access key is used for day-to-day console login. Prefer IAM Identity Center.

**CloudTrail → Trails**. Confirm a trail writes management events to a locked-down bucket.

## AWS CLI commands

```bash
aws iam list-attached-role-policies --role-name builtglory-api-production
aws secretsmanager describe-secret --secret-id builtglory/production/api --region ap-south-1
```

`get-secret-value` prints the secret. Do not run it in CI logs or paste it into chat. Use it only on a trusted admin workstation, then clear the shell scrollback.

Validate JSON before anyone attaches it:

```bash
node -e "JSON.parse(require('fs').readFileSync('deploy/iam/api-task-role-policy.json','utf8'))"
```

This parse succeeded in this session. It does not prove AWS will accept the policy until placeholders are replaced.

Reverse: detach the policy, then delete the policy version you added. Do not delete a role that running tasks still use.

## Required environment variable names

Listed in the table above plus non-secret settings `NODE_ENV`, `PORT`, `CORS_ORIGINS`, `AWS_REGION`, `AWS_S3_BUCKET`, `EMAIL_TRANSPORT`, `EMAIL_FROM`, `JWT_ISSUER`, `JWT_AUDIENCE`.

## Configuration examples without real secrets

```json
{
  "MONGODB_URI": "mongodb+srv://USER:PASSWORD@HOST/builtglory?retryWrites=true&w=majority",
  "REDIS_URL": "rediss://default:AUTH@HOST:6379",
  "JWT_ACCESS_SECRET": "GENERATE_48_PLUS_CHARS",
  "JWT_REFRESH_SECRET": "GENERATE_DIFFERENT_48_PLUS_CHARS"
}
```

Generate with `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` on the admin machine. Do not commit the output.

## Expected output

`describe-secret` shows the name and no secret string. The API process starts with `AWS_USE_INSTANCE_ROLE=true` and can `PutObject` without static keys.

## Security considerations

App role cannot create IAM users, change bucket policies, or read unrelated secrets. The resource ARN in the template is `builtglory/ENVIRONMENT/*`. Split staging and production roles so staging cannot read `builtglory/production/api`.

## Dependencies and prerequisites

Account id for ARN replacement. Decision on EC2 instance profile versus ECS task role.

## Completion status

Templates and validator support for instance roles: done. Roles and secrets: not created.

## Pending manual approvals

IAM changes, CloudTrail if it is off, and storing production secrets.
