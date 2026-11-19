# AWS Network, Domain, and SSL

## Purpose

Define the network and TLS layout without changing live DNS.

## Current configuration

- API listens on `PORT` (5001 in templates) on the host interface Node binds by default.
- Web standalone listens on 3000 (`HOSTNAME=0.0.0.0` in the web Dockerfile).
- Example Nginx files:
  - `BG-Service/deploy/nginx.admin.example.conf` — admin static site plus `/api/` and `/socket.io/` to `127.0.0.1:5001`, and a dedicated `api.builtglory.com` server. Port 80 now returns 301 to HTTPS.
  - `BG-Service/deploy/nginx.webapp.example.conf` — `app.builtglory.com` to `127.0.0.1:3000`, plus HTTP to HTTPS.
- Certificate lines in those files are commented. No certificate is installed by the repo.
- Socket.IO namespace is `/chat`. The HTTP path is `/socket.io/`. Proxy `/socket.io/`, not only `/chat`.
- No VPC, subnet, security group, load balancer, or Route 53 zone is in the repo.

## Identified issues

- Applying the Nginx examples as-is will fail TLS because certificate paths are comments.
- If the API is reached through a load balancer, only the balancer may expose 443. Node ports stay on the instance security group from the balancer only.
- MongoDB and Redis must have no `0.0.0.0/0` rule.
- DNS names in the examples are not approved live changes.

## Required AWS services

VPC, public subnets (load balancer), private subnets (API, web, Redis), Internet Gateway, NAT Gateway only if private tasks must reach Atlas, S3, SES, or the SMS vendor without a VPC endpoint. Application Load Balancer, ACM, Route 53. Optional S3 gateway endpoint and interface endpoints for Secrets Manager, ECR, and CloudWatch to avoid NAT data charges.

## Exact configuration steps

Do not run the create commands until budget and DNS approval exist.

Proposed shape (not created):

1. One VPC, CIDR chosen by the account owner (example placeholder `10.20.0.0/16`).
2. Two public subnets in two AZs for the load balancer.
3. Two private subnets for compute and Redis.
4. Internet Gateway on the public route table.
5. NAT Gateway only if private instances need the public internet and no VPC endpoint covers that traffic. Prefer VPC endpoints.
6. Security groups:
   - `sg-alb`: inbound 443 from `0.0.0.0/0`, outbound to web and API groups only.
   - `sg-web`: inbound 3000 from `sg-alb`.
   - `sg-api`: inbound 5001 from `sg-alb` and from `sg-web` only if the web server proxies API (it does not; the browser calls the API host).
   - `sg-redis`: inbound 6379 from `sg-api` only.
7. Atlas Network Access: the NAT egress IP or VPC peering, not `0.0.0.0/0`.
8. ACM certificate in `ap-south-1` for the ALB (regional certs must be in the same region as the load balancer).
9. Listener 443 forward; listener 80 redirect to 443.
10. Target health check path `GET /health` for the API. Expect HTTP 200 and body `"status":"ok"`.

## AWS Console navigation steps

1. **VPC → Your VPCs → Create VPC**. Use the wizard only after the CIDR is approved.
2. **VPC → Security groups → Create security group**. Add the rules above. Source is another security group id, not the internet, for app ports.
3. **EC2 → Load Balancers → Create Application Load Balancer**. Scheme: internet-facing. Subnets: public. Security group: `sg-alb`.
4. **EC2 → Target groups**. Protocol HTTP, port 5001 or 3000, health check path `/health` for the API. The web app has no `/health` route; use `/` and expect 200, or add a health route later (application work, not done here).
5. **Certificate Manager → Request certificate → Public**. DNS validation. Do not click **Create records** in Route 53 until the domain owner approves.
6. **Route 53 → Hosted zones → the real zone**. Create alias A/AAAA to the load balancer only after approval. Proposed names:
   - Production: `app`, `api`, `admin`
   - Staging: `staging-app`, `staging-api`, `staging-admin`

## AWS CLI commands

Placeholders only. Replace account-specific ids after `describe` calls. Do not run create commands in this task.

```bash
aws ec2 describe-vpcs --region ap-south-1
aws elbv2 describe-load-balancers --region ap-south-1
aws acm list-certificates --region ap-south-1
aws route53 list-hosted-zones
```

Reverse a mistaken listener rule:

```bash
aws elbv2 delete-listener --listener-arn LISTENER_ARN
```

Delete only resources created for this project and only with approval.

## Required environment variable names

`PORT`, `CORS_ORIGINS`, `APP_PUBLIC_URL`, `NEXT_PUBLIC_API_BASE_URL`.

`APP_PUBLIC_URL` in the API template is the public API origin (`https://api.builtglory.com`), not the web origin.

## Configuration examples without real secrets

ALB API target group health check: path `/health`, matcher `200`, interval 30 seconds, healthy threshold 2.

CORS production value already in `.env.production.example`:

```text
CORS_ORIGINS=https://admin.builtglory.com,https://app.builtglory.com
```

Add a real customer hostname here only if it is not `app.builtglory.com`.

## Expected output

`describe` commands list existing resources or an empty list. Empty means not configured. Do not treat an empty list as a failure of the application.

## Security considerations

No inbound 27017, 6379, 3000, or 5001 from the internet. Redirect HTTP to HTTPS at the load balancer or Nginx. HSTS is already set by Helmet on API responses.

## Dependencies and prerequisites

Domain registrar access if the zone is not in this AWS account. Two availability zones.

## Completion status

Example proxy config: updated in repo. VPC, ALB, ACM, and DNS: not configured.

## Pending manual approvals

Any Route 53 write, certificate request, NAT Gateway (monthly cost), and security group changes on existing hosts.
