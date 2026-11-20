# MongoDB and Redis Configuration

## Purpose

Separate staging and production data stores and keep both off the public internet.

## Current configuration

- The API reads `MONGODB_URI`. It does not embed a host. Transactions are required in production (`assertTransactionsAvailableInProduction`), so the deployment needs a replica set. The production template uses `mongodb+srv`, which matches Atlas or another SRV replica set. This is not Amazon DocumentDB unless a lead migrates it. Do not migrate.
- `MONGODB_DNS_SERVERS` is optional and used when SRV DNS from the host is unreliable.
- Redis is required for refresh sessions. Client: `ioredis` via `src/config/redis.js` and `src/config/redisOptions.js`.
- Local development reads `REDIS_ENABLED`, `REDIS_URL`, `REDIS_HOST`, `REDIS_PORT`, and `REDIS_PASSWORD`. `REDIS_URL` wins. No host is hardcoded in the client.
- Production runtime rejects `redis://`, localhost, a missing target, and `REDIS_ENABLED=false`. Set `REDIS_URL=rediss://...` for production. `REDIS_HOST` is for local or non-TLS addresses and still has to pass the production TLS check.
- Staging runtime still accepts `redis://` on a non-local host (`redisOptions.test.js`). The staging example and `validate-production-env.mjs` require `rediss://` anyway.
- Local compose file `deploy/docker-compose.local.yml` publishes MongoDB and Redis on localhost only. It is not a staging or production topology.
- No ElastiCache replication group, subnet group, or Atlas project id is in the repo.

## Identified issues

- Workstation `.env` (not committed) may point at a shared Atlas database. Do not use that URI for staging, and do not run migrations against it from a deploy script.
- Redis TLS is not provisioned in this repository.
- A public Redis endpoint would expose session and OTP keys.

## Required AWS services

ElastiCache for Redis in private subnets, in-transit encryption, AUTH token, security group `sg-redis`. MongoDB remains the current managed replica set (Atlas) unless approved otherwise. Backups stay on that provider's snapshot schedule.

## Exact configuration steps

1. Create a staging database named `builtglory_staging` in the same Atlas project or a separate project. Use a user that cannot read the production database.
2. Store that URI only in the staging secret.
3. Restrict Atlas IP access to the NAT egress or peering CIDR.
4. Enable Atlas backups and encryption at rest (Atlas default for modern clusters; confirm in the Atlas console).
5. For Redis, create a replication group with transit encryption and at-rest encryption. Multi-AZ for production. Single node is acceptable for staging if the lead accepts the outage risk.
6. Set `REDIS_URL=rediss://default:AUTH_TOKEN@primary-endpoint:6379`.
7. Leave `REDIS_TLS_REJECT_UNAUTHORIZED=true`.
8. Do not assign a public IP to the cache.

## AWS Console navigation steps

ElastiCache:

1. **ElastiCache → Redis OSS caches → Create**.
2. Region **ap-south-1**.
3. Cluster mode disabled unless the lead asks for sharding. Session keys do not require cluster mode.
4. Node type: start with `cache.t4g.micro` for staging and `cache.t4g.small` for production. Change only with a cost approval.
5. Subnet group: private subnets.
6. Security group: `sg-redis`.
7. Encryption in transit: required. Encryption at rest: enabled. AUTH: enabled.
8. Backup retention: 7 days production, 1 day staging.

Atlas (not AWS): Atlas → Network Access, Database Access, Backup. Do not click **Terminate**.

## AWS CLI commands

```bash
aws elasticache describe-replication-groups --region ap-south-1
aws elasticache describe-cache-subnet-groups --region ap-south-1
```

Create commands are intentionally omitted until the VPC id exists and spend is approved. After creation, confirm `TransitEncryptionEnabled` is true and `CacheSubnetGroupName` is the private group.

Reverse: `aws elasticache delete-replication-group --replication-group-id ID --region ap-south-1` deletes data. Do not run it against a cache that holds sessions you still need.

## Required environment variable names

`MONGODB_URI`, `MONGODB_DNS_SERVERS`, `REDIS_URL`, `REDIS_TLS_REJECT_UNAUTHORIZED`.

## Configuration examples without real secrets

```text
MONGODB_URI=mongodb+srv://staging_user:PASSWORD@staging-cluster.example.mongodb.net/builtglory_staging?retryWrites=true&w=majority
REDIS_URL=rediss://default:AUTH_TOKEN@master.staging-redis.xxxxx.aps1.cache.amazonaws.com:6379
REDIS_TLS_REJECT_UNAUTHORIZED=true
```

## Expected output

Validator line `MONGODB_URI=set(scheme-ok)` and `REDIS_URL=rediss(TLS)`. A staging file whose database name is `builtglory` fails the validator.

## Security considerations

Separate users and passwords. No shared URI. Redis AUTH token is a secret. Do not log the URI. OTP payloads stored under Redis keys `otp:*` must not be exported to logs.

## Dependencies and prerequisites

VPC and `sg-api` before ElastiCache. Atlas organization owner for the staging database.

## Completion status

Templates and validator rules: done. Atlas staging database and ElastiCache: not created.

## Pending manual approvals

Database owner for a staging cluster or database. Budget for ElastiCache and, if used, NAT so the API can reach Atlas.
