# AWS Final Handover Report

## Purpose

Hand the AWS engineer a factual status of infrastructure preparation. Deployment is not authorized. Application QA is the next phase, not this one.

## Current configuration

Code and templates only. No AWS account session was opened in this task.

## Identified issues

Counted in section B.

## Required AWS services

EC2 or ECS (not chosen), ALB, ACM, Route 53, ElastiCache, S3, SES, Secrets Manager, IAM, CloudWatch. MongoDB stays on the current replica-set URI.

## Exact configuration steps

Section F.

## AWS Console navigation steps

Each document in `BG-Service/docs/aws/` has the click path. Start with read-only checks in `AWS_COMMANDS_AND_EXECUTION_GUIDE.md`.

## AWS CLI commands

Read-only commands are in that same guide. Create commands are withheld until approval.

## Required environment variable names

`AWS_ENVIRONMENT_CONFIGURATION.md`.

## Configuration examples without real secrets

`.env.production.example` and `.env.staging.example` in both repositories.

## Expected output

Local validators already printed PASS. AWS describe commands are still outstanding.

## Security considerations

`AWS_SECURITY_CHECKLIST.md`.

## Dependencies and prerequisites

Account access, domain access, database owner, SMS and email provider access, budget.

## Completion status

Repository preparation: complete. Infrastructure: not provisioned. Production readiness: **not ready**.

## Pending manual approvals

Section G.

---

## A. Infrastructure analysis

### Existing AWS architecture

The API calls S3 and SES with the AWS SDK and reads MongoDB and Redis from environment variables. There is no Terraform, CloudFormation, ECS task, or EC2 user-data in the repos. A previous workspace note said bucket `buildglory-version3` responded to HeadBucket and that SES identity `admin@builtglory.com` was pending. This task did not repeat those API calls. Treat that note as unverified history.

### WebApp hosting

Not hosted. Next.js standalone config, Dockerfile, and Nginx example were added. No CloudFront or Amplify app is defined.

### Backend hosting

Not hosted. The process model is Node 20, port 5001, systemd unit or container, one replica because cron starts inside the API process and Socket.IO has no multi-node adapter.

### Network configuration

Not created. Desired rules are in `AWS_NETWORK_DOMAIN_SSL.md`. Example Nginx redirects HTTP to HTTPS and proxies `/socket.io/`.

### Database and Redis

MongoDB is an external replica set via `MONGODB_URI`. Redis TLS is required by the production runtime and by both example validators. No ElastiCache group is in the repo. Local compose is localhost only.

### S3 storage

Client code uploads private objects and signs URLs for 15 minutes. Bucket public-access settings were not read.

### Secrets management

Environment variables today. Secrets Manager names are specified and not created. Instance-role mode is supported by the S3/SES clients and by the validator.

### Security configuration

Application guards exist (CORS, Helmet, hidden docs, loopback metrics). Account MFA, CloudTrail, and security groups were not verified.

## B. Issues identified

| Class | Count | Notes |
|---|---:|---|
| Total AWS-related gaps tracked | 16 | Sections below |
| Fixed in the repository | 8 | Staging templates, validators, Docker, systemd, Nginx redirect, IAM/S3 policy templates, CI gates, port bind for staging |
| Pending in AWS | 7 | VPC/ALB, DNS/TLS, Redis, bucket audit, secrets, log groups, SES verification |
| Blocked | 1 | No AWS account credentials in this session |
| Security risks still open | 4 | Unverified public S3, phone numbers in OTP logs, possible long-lived access keys, SES not confirmed |

Fixed does not mean the cloud object exists. It means the repo now contains the safe config.

## C. Files modified

See `AWS_IMPLEMENTATION_CHANGELOG.md` for the full table.

Repositories: `BG-Service` and `BG-Webapp`, branch `main` in each. Workspace root is not a Git repository. Docs live in `BG-Service/docs/aws/` so they can be versioned with the API deploy files. `BG-Service/.gitignore` was adjusted so `docs/aws/**/*.md` is not ignored.

## D. AWS configuration status

| Item | Status |
|---|---|
| EC2 / ECS / hosting | Not configured. Requires approval and account access |
| VPC and networking | Not configured |
| Route 53 | Not modified. Names in templates are proposed or already written in older examples. Live records were not read |
| SSL / HTTPS | Application requires HTTPS origins in production templates. Certificates are not requested |
| MongoDB | App expects a URI. Staging database not created. Do not migrate or delete |
| Redis | Not provisioned. Template requires `rediss://` |
| S3 | Client ready. Bucket `buildglory-version3` is named in the production template and was not rechecked. Staging bucket not created |
| Secrets Manager | Not configured. Name map is documented |
| IAM | Policy JSON only. Not attached. Root must not be used |
| CloudWatch | Not configured |
| CI/CD | Workflow files added. They do not deploy. Not pushed |
| SES | Code path exists. Identity status not rechecked |

## E. Deployment readiness

| Gate | Result |
|---|---|
| WebApp deployment preparation | Dockerfile and URL check ready. Image not built or published |
| Backend deployment preparation | Dockerfile, systemd, env check ready. Not installed on a server |
| Staging readiness | Template only. Not ready to receive traffic |
| Production configuration readiness | Template validates. Infrastructure absent. **Not ready** |
| Pending approvals | Compute, DNS, Redis, secrets, bucket policy, budget |

## F. Execution instructions

Do these in order. Stop when a step needs an approval you do not have.

1. Confirm region `ap-south-1` and a non-root IAM user.
2. Run the read-only CLI list in `AWS_COMMANDS_AND_EXECUTION_GUIDE.md`. Write down empty versus present. Do not create anything to fill a gap.
3. In S3, record Block Public Access, encryption, and whether the bucket policy is public for `buildglory-version3`.
4. In SES, record identity status for the from-address. Do not request production access until email ownership is confirmed.
5. Get approval for the calculator total in `AWS_COST_ESTIMATION.md`.
6. Create the VPC, security groups, and load balancer only after that approval. Follow `AWS_NETWORK_DOMAIN_SSL.md`. Do not open 27017 or 6379 publicly.
7. Ask the database owner for `builtglory_staging` and an IP allow-list. Do not copy the production URI.
8. Create ElastiCache with TLS and AUTH, or document an approved private Redis substitute.
9. Create Secrets Manager entries from the name map. Load them into the host environment file mode `0600`.
10. Create IAM roles from `deploy/iam/api-task-role-policy.json` after replacing `ACCOUNT_ID` and bucket names.
11. Request ACM certificates. Add DNS validation records only with domain approval.
12. Create log groups and alarms from `AWS_CLOUDWATCH_MONITORING.md` after the backend redacts phone numbers.
13. Boot one API replica and one web replica in staging. Health check `GET /health`.
14. Leave production desired count at zero until a separate written production approval.

## G. Remaining blockers

| Blocker | Who |
|---|---|
| AWS account access | AWS engineer |
| Domain and DNS approval | Domain owner |
| Staging database and network allow-list | Database owner |
| Do not run migrations on the shared database | Technical lead |
| SES identity and sandbox | AWS engineer plus mailbox owner |
| SMS vendor account for staging (template stays in `log` mode) | SMS provider owner |
| ElastiCache and NAT or VPC endpoint budget | Technical lead |
| Compute choice EC2 versus ECS | Technical lead |
| Phone numbers in OTP logs before CloudWatch | Backend developer |
| GitHub Environment reviewers | Repository admin, after commit is requested |
| Production deploy | Not authorized |

## How to verify later

- API: `curl -fsS https://staging-api.builtglory.com/health` returns `"status":"ok"`.
- Web build argument is `https://staging-api.builtglory.com/api/v1`.
- `openssl s_client` shows a certificate that matches the hostname.
- Redis security group source is the API group only.
- S3 `get-bucket-policy-status` reports not public.

## How to reverse

Stop the new instances and delete only resources tagged for this project, with approval. Do not delete the existing bucket, Atlas cluster, or DNS zone as a rollback. Application rollback steps are in `AWS_ROLLBACK_AND_RECOVERY.md`.
