# AWS S3 Storage Configuration

## Purpose

Keep uploads private, especially KYC and customer documents, with separate staging and production buckets.

## Current configuration

`BG-Service/src/services/storage.service.js`:

- Client region `AWS_REGION` or `ap-south-1`.
- If `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` are both non-empty, those keys are used. If either is empty, the SDK default chain is used (task role on EC2/ECS).
- Bucket name is `AWS_S3_BUCKET`. An `arn:aws:s3:::` prefix is stripped in code, and production validation rejects that mistake.
- Optional `QUARANTINE_S3_BUCKET` for malware quarantine.
- Allowed types: PDF, JPEG, PNG for documents; images plus webp for profile photos; MP4 for property media. Max 25 MB.
- `PutObject` does not set a public ACL.
- Pre-signed PUT and GET expire in at most 900 seconds.
- The production template names bucket `buildglory-version3`. This task did not call S3. Block Public Access, encryption, and bucket policy are **not confirmed**.
- Staging template names `builtglory-staging-private` and `builtglory-staging-quarantine`. Those buckets were not created.

## Identified issues

- A public bucket policy would expose KYC even though the app does not request `public-read`.
- Static HTTPS object URLs are returned by `s3ObjectUrl`. If the bucket is private, those URLs do not grant access. Downloads must use `createReadUrl`. Confirm each customer download path uses the pre-signed helper before go-live (application check, next phase).
- No lifecycle rule is stored in the repo.
- No bucket CORS is in the repo. Browser uploads that use pre-signed PUT need a bucket CORS rule limited to the web origins.

## Required AWS services

S3 in `ap-south-1`. KMS only if the lead chooses SSE-KMS instead of SSE-S3. Do not create a second production bucket if `buildglory-version3` is the approved store; audit that bucket instead.

## Exact configuration steps

For each of production and staging:

1. Create the bucket in `ap-south-1` only if it does not exist. Staging names must include `staging`.
2. Block all public access: ON.
3. Bucket owner enforced (ACLs disabled).
4. Default encryption SSE-S3 (`AES256`) unless security requires SSE-KMS. Do not change an existing KMS key without a decrypt plan.
5. Versioning ON for the production document bucket.
6. Attach `deploy/iam/s3-private-bucket-policy.json` after replacing `REPLACE_PRIVATE_BUCKET`.
7. CORS, only if browser PUT is used:

```json
[{
  "AllowedOrigins": ["https://app.builtglory.com"],
  "AllowedMethods": ["PUT", "GET", "HEAD"],
  "AllowedHeaders": ["*"],
  "ExposeHeaders": ["ETag"],
  "MaxAgeSeconds": 300
}]
```

Use the staging origin on the staging bucket. Do not use `*`.

8. Lifecycle: abort incomplete multipart uploads after 7 days. Expire prefix `deploy-checks/` after 1 day if probes write there. Do not expire `kyc/` or customer document prefixes.
9. IAM: `s3:PutObject`, `s3:GetObject`, `s3:DeleteObject` on `bucket/*` for the task role only. No `s3:PutBucketPolicy` for the app role.

## AWS Console navigation steps

**S3 → Buckets → bucket → Permissions → Block public access → Edit → Block all**.

**Properties → Default encryption → Edit**.

**Management → Lifecycle rules → Create rule**.

**Permissions → Cross-origin resource sharing → Edit**.

**Permissions → Bucket policy → Edit**. Paste the JSON template.

## AWS CLI commands

```bash
aws s3api get-public-access-block --bucket REPLACE_PRIVATE_BUCKET --region ap-south-1
aws s3api get-bucket-encryption --bucket REPLACE_PRIVATE_BUCKET --region ap-south-1
aws s3api get-bucket-policy-status --bucket REPLACE_PRIVATE_BUCKET --region ap-south-1
```

Expected when private: `BlockPublicAcls`, `IgnorePublicAcls`, `BlockPublicPolicy`, and `RestrictPublicBuckets` are true. `IsPublic` is false.

Reverse a bad policy:

```bash
aws s3api delete-bucket-policy --bucket REPLACE_PRIVATE_BUCKET --region ap-south-1
```

Only after saving the previous policy. Do not delete the bucket.

## Required environment variable names

`AWS_REGION`, `AWS_S3_BUCKET`, `QUARANTINE_S3_BUCKET`, `AWS_USE_INSTANCE_ROLE`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`.

## Configuration examples without real secrets

```text
AWS_REGION=ap-south-1
AWS_S3_BUCKET=builtglory-staging-private
AWS_USE_INSTANCE_ROLE=true
```

## Expected output

`get-public-access-block` shows all four blocks true. App uploads succeed with the task role and fail anonymously.

## Security considerations

KYC, payment proofs, and identity documents stay in the private bucket. Pre-signed URLs are the only read path for those objects. Do not log the full pre-signed URL.

## Dependencies and prerequisites

IAM task role from `AWS_SECRETS_MANAGER_IAM.md`. Confirmation whether `buildglory-version3` is the production bucket to keep.

## Completion status

Application client and policy template: in repo. Bucket hardening: requires console access. Staging buckets: not created.

## Pending manual approvals

Creating buckets, changing the policy on `buildglory-version3`, and enabling versioning on a bucket that already contains data.
