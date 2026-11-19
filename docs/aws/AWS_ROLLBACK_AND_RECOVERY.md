# AWS Rollback and Recovery

## Purpose

Reverse a bad release without deleting databases.

## Current configuration

- No ECS service, launch template, or image registry exists yet, so there is no previous task definition to roll back to.
- API shutdown on `SIGTERM` is implemented, which is what a rolling restart needs.
- MongoDB backup is the Atlas (or current host) snapshot feature, not an AWS Backup plan in this repo.
- S3 versioning is recommended and not confirmed on the existing bucket.
- The Git deploy workflows do not change infrastructure.

## Identified issues

- Without image tags or a previous systemd release directory, the first deploy has nothing to roll back to. Keep the previous build on disk or in ECR before shifting traffic.
- Restoring a MongoDB snapshot over production is destructive. It needs a named approval and a maintenance window.
- Redis session loss logs users out. That is acceptable for a cache/session store. It is not a data restore.

## Required AWS services

ECR tags or an on-disk release directory, ALB target group, Atlas backups, S3 versioning, CloudWatch logs for the failed boot.

## Exact configuration steps

Application rollback, EC2 directory style:

1. Keep `/opt/builtglory/api-previous` as the last good copy.
2. `sudo systemctl stop builtglory-api`.
3. Swap directories. Do not delete the bad copy until the good one is healthy.
4. `sudo systemctl start builtglory-api`.
5. `curl -fsS http://127.0.0.1:5001/health`.

ECS style, after a service exists:

```bash
aws ecs update-service --cluster CLUSTER --service SERVICE --task-definition FAMILY:PREVIOUS --region ap-south-1
```

Web rollback is the previous container image. Remember `NEXT_PUBLIC_API_BASE_URL` is inside the image. Rolling back the image restores the API URL that was baked in.

Data:

- Do not drop databases as a rollback step.
- Atlas point-in-time restore goes to a new cluster name first. Point `MONGODB_URI` at it only after the lead checks the data.
- S3: if versioning is on, restore the object version. Do not empty the bucket.

Failed boot:

1. Read CloudWatch or `journalctl -u builtglory-api`.
2. If the process exits on `Invalid environment`, fix the secret and start again. The old process should still be stopped, so you are not half-migrated.
3. If health checks fail, the ALB drains the target. Put the previous target back.

## AWS Console navigation steps

**ECS → Service → Update → Revision**. **EC2 → Target groups → Deregister** the bad instance only after the previous instance is healthy. **Atlas → Backup → Restore** to a new cluster, not in place, unless the owner says otherwise.

## AWS CLI commands

```bash
aws ecs describe-services --cluster CLUSTER --services SERVICE --region ap-south-1 --query "services[0].taskDefinition"
aws ecs list-task-definitions --family-prefix builtglory-api --region ap-south-1 --sort DESC
```

These fail or return empty until the service exists. That is expected.

## Required environment variable names

No new names. A rollback uses the previous environment file. Do not point staging `MONGODB_URI` at production during a rollback test.

## Configuration examples without real secrets

Release directories `/opt/builtglory/api` and `/opt/builtglory/api-previous`. Image tags `builtglory-api:<git-sha>` and `builtglory-api:<previous-sha>`.

## Expected output

`/health` returns 200 on the restored process. Error rate on the ALB drops. No database was deleted.

## Security considerations

Rollback does not widen security groups. Do not restore a production dump onto a laptop. Secrets stay in the existing secret; do not paste them into the ticket.

## Dependencies and prerequisites

A retained previous build. Atlas backup enabled before the first production write from the new host.

## Completion status

Procedure written. No release exists to roll back. Not drilled.

## Pending manual approvals

Any snapshot restore, cluster swap, or `update-service` call.
