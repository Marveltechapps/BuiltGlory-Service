# Backend Deployment Guide

## Purpose

Run `BG-Service` as a production Node process with private data stores, HTTPS, and a health check. This task does not start that process in AWS.

## Current configuration

- Start: `npm start` → `node src/server.js`. Engine `node >= 20`.
- Dockerfile: `node:20-alpine`, `npm ci --omit=dev`, `USER node`, port 5001, `NODE_ENV=production`.
- systemd unit: `deploy/systemd/builtglory-api.service`. `Restart=on-failure`, `KillSignal=SIGTERM`, `TimeoutStopSec=15`. The app's own shutdown budget is 10 seconds.
- Production and staging do not switch ports when 5001 is taken.
- `trust proxy` is 1, which matches one Nginx or ALB hop.
- Health: `GET /health` → `{ "status": "ok" }`. Ready: `GET /ready` → static ready. `/metrics` answers on loopback only.
- Socket.IO attaches to the same HTTP server. Clients use namespace `/chat` and transports websocket and polling.
- Jobs start when `NODE_ENV` is not `test`. Run one API replica, or accept duplicate cron until the backend splits workers. Do not scale past one task until that is decided.
- Nginx example proxies `/api/` and `/socket.io/` and redirects port 80 to HTTPS.

## Identified issues

- No supervisor was in the repo before the systemd unit. Nothing has installed that unit on a server.
- `/ready` will not fail when MongoDB is down. Use `/health` only to prove the process is up. Dependency failure still needs log alarms.
- Phone numbers are logged on OTP send. Filter them before CloudWatch (backend change, not done).
- Staging runtime allows non-TLS Redis even though the staging template does not.

## Required AWS services

EC2 or ECS/Fargate, ALB, the IAM role, Secrets Manager, private Redis, existing MongoDB, S3, SES. One replica until cron is isolated.

## Exact configuration steps

1. `npm run env:validate:prod:example` and `npm run env:validate:staging:example`.
2. Build locally when Docker is available:

```bash
docker build -t builtglory-api:local .
```

3. Do not push.
4. Future EC2 path:
   - Amazon Linux or Ubuntu, Node.js 20.
   - User `builtglory`, directory `/opt/builtglory/api`.
   - `/etc/builtglory/api.env` mode `0600`, owned by root, readable by the service user.
   - Copy `deploy/systemd/builtglory-api.service` to `/etc/systemd/system/`.
   - `sudo systemctl daemon-reload && sudo systemctl enable --now builtglory-api`.
5. Future ECS path: one service, desired count 1, private subnets, task role, secrets from Secrets Manager, container port 5001, health check `curl -f http://127.0.0.1:5001/health`.
6. ALB forwards `api.builtglory.com` to that target. Stickiness is not required for polling if all clients hit one task. If count becomes greater than 1 later, enable stickiness or a shared Redis adapter. The code does not configure a Socket.IO Redis adapter today, so more than one task will drop websocket events across tasks.
7. Confirm graceful stop: `systemctl stop` sends SIGTERM and the log line `Graceful shutdown complete`.

## AWS Console navigation steps

**EC2 → Instances → Launch** only after approval. Instance profile: `builtglory-api-production`. Security group: `sg-api`. No public IP if the load balancer is in front. Then a bastion or SSM Session Manager is required. Prefer Session Manager. Do not open SSH to the world.

**ECS → Clusters → Create** only if ECS was the approved platform. Task definition port 5001. Do not assign a public IP.

## AWS CLI commands

```bash
aws ecs list-clusters --region ap-south-1
aws ec2 describe-instances --region ap-south-1 --filters Name=tag:Name,Values=builtglory-api
```

Empty results are expected today.

On the future host:

```bash
curl -fsS http://127.0.0.1:5001/health
```

## Required environment variable names

The full set in `.env.production.example`. `PORT=5001`.

## Configuration examples without real secrets

```text
NODE_ENV=production
PORT=5001
AWS_USE_INSTANCE_ROLE=true
EMAIL_TRANSPORT=ses
SMS_DELIVERY_MODE=vendor
```

## Expected output

Local validators print `PASS`. Future health check returns HTTP 200. This session did not deploy, so there is no AWS health result.

## Security considerations

SSM instead of open SSH. One replica. Secrets file mode `0600`. Swagger `/api-docs` is hidden when `NODE_ENV=production`.

## Dependencies and prerequisites

Network, secrets, Redis, and MongoDB documents. Node 20 on the host if not using the image.

## Completion status

Process definition, image definition, and env gate: in repo. No instance, service, or release exists.

## Pending manual approvals

Compute choice, first boot, and SES production access before real email.
