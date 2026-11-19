# AWS CI/CD Pipeline

## Purpose

Describe the pipeline that is in Git and the manual gates required before any AWS deploy. Nothing in this pipeline deploys.

## Current configuration

Both repos are on `main`. Workflows added:

| File | Trigger | What it does |
|---|---|---|
| `BG-Service/.github/workflows/config-check.yml` | pull request, manual | `npm ci`, both env example validators, `node --check src/server.js` |
| `BG-Service/.github/workflows/deploy-gated.yml` | manual only | Selects `staging` or `production`, uses a GitHub Environment of that name, prints that deploy is not implemented |
| `BG-Webapp/.github/workflows/config-check.yml` | pull request, manual | Validates both public API URL templates |
| `BG-Webapp/.github/workflows/deploy-gated.yml` | manual only | Same hold pattern as the API |

No CodePipeline, CodeBuild, or ECR push exists. Pushing these YAML files does not happen in this task (no commit, no push).

## Identified issues

- GitHub Environment reviewers do not exist until an admin creates environments named `staging` and `production` and turns on required reviewers.
- `config-check` installs npm packages. It does not need AWS credentials. Do not add `AWS_ACCESS_KEY_ID` to the repository secrets for this workflow.
- A future deploy job must assume a role with OIDC (`token.actions.githubusercontent.com`), not a long-lived key.

## Required AWS services

None for the current workflows. Later: ECR, and either ECS deploy permissions or SSM send-command, plus GitHub OIDC provider in IAM.

## Exact configuration steps

1. After the YAML is committed (separate approval), open GitHub → Settings → Environments.
2. Create `staging`. Required reviewers: one engineer.
3. Create `production`. Required reviewers: technical lead. Set a wait timer if the lead wants one.
4. Leave deployment branches limited to `main`.
5. Do not add a job step that runs `aws ecs update-service` or `docker push` until a written deploy approval exists.
6. Suggested later order, still manual:
   - Build image in CI.
   - Push to ECR tag `git sha`.
   - Staging environment updates the staging service to that tag.
   - Production environment is a second job that starts only after staging succeeds and a reviewer accepts.
7. Failure handling: the deploy job stops on the first failed step. The previous image tag stays on the service if the update is not issued. See rollback.
8. Logs: GitHub Actions logs for CI. CloudWatch for the running app. Do not print secrets. The current hold step prints only the target name.

## AWS Console navigation steps

**IAM → Identity providers → Add provider → OpenID Connect** is a later step. Provider URL `https://token.actions.githubusercontent.com`. Audience `sts.amazonaws.com`. Do not add it until the deploy role is designed.

GitHub's environment UI is not in the AWS console.

## AWS CLI commands

No AWS CLI is part of the current workflows. Syntax was reviewed as YAML in the repo. GitHub will be the runtime that parses it after the files are pushed.

## Required environment variable names

CI validators need no secrets. Future build of the web image needs `NEXT_PUBLIC_API_BASE_URL` as a non-secret variable on the workflow, different per environment.

## Configuration examples without real secrets

```yaml
environment: production
permissions:
  id-token: write
  contents: read
```

That `permissions` block is not in the current deploy file because the file does not call AWS. Add it only with the OIDC role.

## Expected output

Config-check on GitHub ends green when validators pass. They passed locally in this session. The deploy workflow, if someone runs it before environments exist, waits or fails closed. It still does not change AWS.

## Security considerations

Production is `workflow_dispatch` plus an environment reviewer. It is not on `push` to `main`. Fork pull requests must not receive secrets. The config-check workflow has no secrets to leak.

## Dependencies and prerequisites

GitHub repository admin to create environments. That can wait until the branch is pushed.

## Completion status

Workflow files written. Not committed, not pushed, not executed on GitHub. No AWS deploy path is active.

## Pending manual approvals

Commit and push of the workflow files. GitHub environment reviewers. Any later OIDC role.
