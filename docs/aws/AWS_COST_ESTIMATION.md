# AWS Cost Estimation

## Purpose

Show the order of magnitude of the proposed staging and production layout so a lead can approve or reject it. These are not quotes. Prices change. Confirm in the AWS Pricing Calculator for `ap-south-1` before purchase. Nothing in this list was purchased.

## Current configuration

The repositories do not create billable resources. Local MongoDB and Redis via `deploy/docker-compose.local.yml` cost nothing on AWS. The existing S3 bucket and SES account, if they are already in the AWS account, already have their own charges. This task did not read Cost Explorer.

MongoDB Atlas is billed by Atlas, not by this estimate.

## Identified issues

- NAT Gateway is the easy way to overspend. Prefer VPC endpoints for S3, Secrets Manager, ECR, and CloudWatch, and use NAT only for Atlas and the SMS vendor if those cannot be reached another way.
- Two environments double the fixed costs.
- A load balancer with almost no traffic still has an hourly charge.

## Required AWS services

Listed below. Optional WAF and Shield Advanced are excluded. Shield Standard is included with the load balancer at no extra line item.

## Exact configuration steps

1. Open the AWS Pricing Calculator.
2. Region **Asia Pacific (Mumbai)**.
3. Add the rows below twice if staging and production run at the same time.
4. Send the total for approval before `create` commands.

## AWS Console navigation steps

**AWS Billing → Cost Explorer** after resources exist. **Billing → Budgets → Create budget** with a monthly email at the approved ceiling. Do that when the first resource is approved, not before.

## AWS CLI commands

```bash
aws ce get-cost-and-usage --time-period Start=2026-11-01,End=2026-11-18 --granularity MONTHLY --metrics UnblendedCost
```

Requires billing IAM permission. Not run in this session. Do not treat a missing permission as a zero bill.

## Required environment variable names

None.

## Configuration examples without real secrets

Illustrative on-demand monthly figures for one small environment in Mumbai. Verify before use.

| Piece | Sketch | Why it is here |
|---|---|---|
| Application Load Balancer | low tens of USD plus LCU | HTTPS entry |
| EC2 `t3.small` x2 (web + API) or one shared host | low tens of USD | Node processes |
| NAT Gateway | about 30 USD plus data | Only if private subnets must reach Atlas/SMS |
| ElastiCache `cache.t4g.micro` | low tens of USD | Sessions |
| S3 + requests | a few USD at current document volume | Private files |
| Secrets Manager | about 0.40 USD per secret | Two or three secrets |
| CloudWatch logs 5 GB | a few USD | 30–90 day retention |
| Route 53 hosted zone | about 0.50 USD per zone | If the zone is in this account |
| ACM public certificate | 0 | DNS validation |
| Data transfer | variable | Keep uploads in-region |
| ECS/Fargate instead of EC2 | often higher for always-on tasks | Alternative, not selected |
| Atlas | separate invoice | Existing database host |

A lean staging stack without NAT, sharing a host for web and API, is the cheaper first step. Production with NAT, two AZs, and a cache node is the larger step. Do not buy both until the lead accepts the calculator total.

## Expected output

A calculator export attached to the approval ticket. No new line item appears in Cost Explorer from this repository change.

## Security considerations

Budgets and alerts do not replace least privilege. A public IP on Redis is not an acceptable saving.

## Dependencies and prerequisites

Billing access. Decision on NAT versus public Atlas allow-list of a single bastion IP (still not `0.0.0.0/0`).

## Completion status

Estimate written. No budget created. No resource purchased.

## Pending manual approvals

The monthly ceiling, NAT, and a second full production-sized stack for staging.
