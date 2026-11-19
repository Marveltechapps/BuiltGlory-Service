# AWS CloudWatch Monitoring

## Purpose

Define logs, metrics, and alarms for the API, web app, load balancer, Redis, and email. The application still logs to the console through Winston. No CloudWatch agent is installed.

## Current configuration

- API logger writes structured console logs. There is no CloudWatch transport in code.
- Startup logs SMS mode and whether a vendor URL is set. They do not log the URL.
- OTP send logs include a normalized phone number. Passwords and tokens were not found in the logger calls that were searched. Phone numbers are still sensitive.
- `/metrics` is loopback-only and is not a CloudWatch integration.
- ALB, ElastiCache, and SES are not provisioned here, so their metrics do not exist yet.

## Identified issues

- Shipping logs without a redact step will store phone numbers.
- No alarm notifies anyone if `/health` fails.
- No log retention is set, so a future log group could keep data forever.

## Required AWS services

CloudWatch Logs, Alarms, and SNS. Optional Container Insights if ECS is chosen. ElastiCache and ALB metrics appear automatically once those resources exist.

## Exact configuration steps

1. Create log groups before the first boot:
   - `/builtglory/staging/api`
   - `/builtglory/staging/web`
   - `/builtglory/production/api`
   - `/builtglory/production/web`
2. Retention: 30 days staging, 90 days production. Increase only with a privacy review.
3. EC2: install the CloudWatch agent and point it at the systemd journal or the process stdout. ECS: `awslogs` driver to the log group. The task role already allows `logs:CreateLogStream` and `logs:PutLogEvents` in the policy template.
4. Ask the backend developer to remove phone numbers, OTPs, passwords, tokens, and pre-signed URLs from log fields before the agent is enabled in production.
5. Alarms, after resources exist:
   - ALB target `UnHealthyHostCount` >= 1 for 2 minutes.
   - ALB `HTTPCode_Target_5XX_Count` > 10 in 5 minutes.
   - EC2 or ECS CPU > 80% for 10 minutes.
   - Memory > 80% for 10 minutes where the metric exists.
   - ElastiCache `EngineCPUUtilization` > 80% and `DatabaseMemoryUsagePercentage` > 80%.
   - ElastiCache `CurrConnections` drop to 0 while the API is in service.
   - SES bounce and complaint rates using the account metrics. SES sandbox status is a separate check (`npm run check:ses` on an approved machine).
6. SNS topic `builtglory-ops` with email subscriptions. Do not put customer data in alarm descriptions.
7. Dashboard widgets: ALB healthy hosts, API CPU, Redis CPU, 5xx.

## AWS Console navigation steps

**CloudWatch → Log groups → Create log group**. Set retention on the same page.

**CloudWatch → Alarms → Create alarm**. Pick the ALB metric namespace `AWS/ApplicationELB`.

**SNS → Topics → Create topic → Standard**. Subscribe the on-call email. Confirm the subscription email.

## AWS CLI commands

```bash
aws logs create-log-group --log-group-name /builtglory/production/api --region ap-south-1
aws logs put-retention-policy --log-group-name /builtglory/production/api --retention-in-days 90 --region ap-south-1
```

Do not run these until the account and naming are approved.

Reverse retention only by setting a new retention. Delete a log group only if it was created by mistake and contains no incident data:

```bash
aws logs delete-log-group --log-group-name /builtglory/production/api --region ap-south-1
```

## Required environment variable names

None inside the app for CloudWatch. ECS task definition uses `awslogs-group` and `awslogs-region=ap-south-1`.

## Configuration examples without real secrets

```text
awslogs-group=/builtglory/production/api
awslogs-region=ap-south-1
awslogs-stream-prefix=api
```

## Expected output

After a real deploy, `aws logs tail /builtglory/production/api --since 5m` shows startup lines and no JWT, OTP, or MongoDB URI.

## Security considerations

Log groups are not public. IAM write access is limited to the app role ARN in the template. Alarm email can include resource ids, not request bodies.

## Dependencies and prerequisites

SNS subscription owner. Backend redaction of phone numbers before production log shipping.

## Completion status

Alarm and retention design: documented. Log groups, agent, and alarms: not created.

## Pending manual approvals

Creating log groups and an SNS topic. Enabling the agent on a host.
