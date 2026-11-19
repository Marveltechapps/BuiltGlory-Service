# Customer WebApp Deployment Guide

## Purpose

Ship `BG-Webapp` (Next.js 16, React 19) with the correct API URL and HTTPS, without deploying it in this task.

## Current configuration

- `next.config.ts` sets `output: 'standalone'`.
- `npm start` runs `next start`, which prints a warning that standalone mode should use `node .next/standalone/server.js`.
- `npm run start:standalone` is the command to use after `npm run build`.
- `BG-Webapp/Dockerfile` builds with `ARG NEXT_PUBLIC_API_BASE_URL` and fails the image build if that argument is empty. Runtime command is `node server.js` on port 3000.
- API URL files: `.env.example`, `.env.staging.example`, `.env.production.example`.
- Nginx example: `BG-Service/deploy/nginx.webapp.example.conf`.
- There is no Amplify app, S3 static site, or CloudFront distribution in the repo. Standalone mode needs a Node process, not a static S3 website.

## Identified issues

- A production build without `NEXT_PUBLIC_API_BASE_URL` falls back to `http://localhost:5001/api/v1` in `src/services/api.ts`.
- The browser connects Socket.IO to the API origin with namespace `/chat`. The web host does not proxy Socket.IO. The API host must allow the web origin in `CORS_ORIGINS` and must proxy `/socket.io/`.
- No health route exists on the web app. An ALB check on `/` depends on the home page returning 200.

## Required AWS services

Same VPC and ALB as the API, a second target group on port 3000, ACM name for `app.builtglory.com` and `staging-app.builtglory.com`, ECR only if the image is the deploy artifact. EC2 with the systemd pattern is an alternative. Do not pick ECS over EC2 without approval. The Nginx example assumes a single host process on port 3000.

## Exact configuration steps

1. Validate URLs: `npm run env:validate:prod:example` and `npm run env:validate:staging:example` from `BG-Webapp`.
2. Build image (staging example):

```bash
docker build -f Dockerfile --build-arg NEXT_PUBLIC_API_BASE_URL=https://staging-api.builtglory.com/api/v1 -t builtglory-web:staging .
```

3. Do not push the image or start it on AWS in this phase.
4. On the future host, run container port 3000 bound to the private interface or to localhost behind Nginx.
5. Point the ALB or Nginx server name at that port.
6. Confirm the API `CORS_ORIGINS` contains the exact web origin, scheme included, no path.

Rollback is a previous image tag or the previous standalone directory. See `AWS_ROLLBACK_AND_RECOVERY.md`.

## AWS Console navigation steps

**ECR → Repositories → Create** `builtglory-web` only after approval.

**EC2 → Target groups → Create** HTTP 3000, health check `/`.

**EC2 → Load balancers → listener 443 → Add rule** host `app.builtglory.com` forward to that target group. Do this after the certificate is issued.

## AWS CLI commands

```bash
docker build -f Dockerfile --build-arg NEXT_PUBLIC_API_BASE_URL=https://api.builtglory.com/api/v1 -t builtglory-web:local .
```

This command was not run here (it needs a full image build and network). Config validation was run instead.

## Required environment variable names

`NEXT_PUBLIC_API_BASE_URL` at build time. `PORT` and `HOSTNAME` are set in the Dockerfile (`3000`, `0.0.0.0`).

## Configuration examples without real secrets

```text
NEXT_PUBLIC_API_BASE_URL=https://api.builtglory.com/api/v1
```

## Expected output

Validator: `PASS production web env (api.builtglory.com/api/v1).` Observed in this session.

A correct container logs `Ready` from Next and answers HTTPS on the public name only after DNS and the load balancer exist.

## Security considerations

The image must not copy `.env` (`.dockerignore` excludes it). Public env vars are visible in the browser. Do not put secrets in `NEXT_PUBLIC_*`.

## Dependencies and prerequisites

API HTTPS origin already chosen. Node 20. Docker if using the image.

## Completion status

Build contract, Dockerfile, and URL checks: done. Image not published. Host not created.

## Pending manual approvals

ECR, target group, DNS name for the customer site, and the first deploy.
