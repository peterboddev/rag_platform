# Lambda Deployment Issue: S3 Asset Upload

## Problem

Lambda function deployment was failing with:
```
Error occurred while GetObject. S3 Error Code: NoSuchKey. 
S3 Error Message: The specified key does not exist.
```

## Root Cause

CDK synthesizes Lambda functions with asset references that point to S3 locations. However, the deployment was failing because these assets were not being uploaded to S3 before CloudFormation tried to create the Lambda functions.

## CDK Asset Workflow

When using `lambda.Code.fromAsset()`, CDK:
1. **During synthesis**: Creates asset metadata in `cdk.out/` with S3 bucket/key references
2. **During deployment**: Expects assets to be uploaded to S3 before CloudFormation runs
3. **CloudFormation**: References the S3 locations to create Lambda functions

## The Issue

The pipeline was using CloudFormation directly (not `cdk deploy`), which means:
- CDK assets were NOT automatically uploaded to S3
- CloudFormation tried to create Lambda functions with S3 keys that didn't exist
- Deployment failed with "NoSuchKey" error

## Solution Implemented

**Platform team has fixed this issue** by adding automatic CDK asset publishing to the pipeline.

### How It Works Now

For CDK applications (identified by `templatePath` containing `cdk.out/`):

1. **Build Stage**: 
   - Runs `npx cdk synth` to generate CloudFormation templates and asset metadata
   - Creates `cdk.out/*.assets.json` files describing all assets

2. **Deploy Stage** (NEW):
   - **Step 1**: Asset Publishing (runs first)
     - CodeBuild project runs `npx cdk-assets publish`
     - Uploads Lambda code, Docker images, and other assets to CDK bootstrap bucket
     - Uses pattern: `s3://cdk-*-assets-<account>-<region>/`
   
   - **Step 2**: CloudFormation Deployment (runs after assets are uploaded)
     - Deploys the CloudFormation template
     - Lambda functions now reference existing S3 objects
     - Deployment succeeds

### Pipeline Configuration

The platform pipeline now automatically:
- Detects CDK applications by checking if `templatePath` contains `cdk.out/`
- Creates an asset publishing CodeBuild project for each deployment target
- Runs asset publishing before CloudFormation deployment
- Grants necessary S3 permissions to the CDK bootstrap bucket

## What App Teams Need to Do

**Nothing!** This is handled automatically by the platform pipeline.

Just ensure your buildspec.yml includes:
```yaml
build:
  commands:
    - npx cdk synth  # This creates the asset metadata
```

And your application configuration specifies the correct template path:
```json
{
  "templatePath": "cdk.out/RAGApplicationStack.template.json"
}
```

## Verification

After deployment, you can verify assets were uploaded:

```bash
# Check CDK bootstrap bucket
aws s3 ls s3://cdk-hnb659fds-assets-<account>-<region>/

# Check asset metadata
cat cdk.out/RAGApplicationStack.assets.json
```

## Technical Details

### Asset Publishing Command

The pipeline runs:
```bash
npx cdk-assets --path cdk.out/*.assets.json --verbose publish
```

This command:
- Reads all `*.assets.json` files in `cdk.out/`
- Uploads file assets (Lambda code) to S3
- Publishes Docker images to ECR (if any)
- Uses the CDK bootstrap bucket in the target account/region

### Permissions Required

The CodeBuild role needs:
- `s3:PutObject` - Upload assets to bootstrap bucket
- `s3:GetObject` - Read existing assets (for caching)
- `s3:ListBucket` - List bucket contents

These permissions are automatically granted by the platform pipeline.

### CDK Bootstrap Bucket

CDK uses a bootstrap bucket with the naming pattern:
```
cdk-hnb659fds-assets-<account-id>-<region>
```

This bucket is created when you run `cdk bootstrap` in your AWS account.

## SAM Applications

SAM applications are not affected by this issue because:
- SAM packages Lambda code during the build phase
- The packaged code is included in the build artifacts
- No separate asset upload step is needed

## Status

✅ **RESOLVED** - Platform pipeline now automatically handles CDK asset publishing for all CDK applications.

## Related Documentation

- **App Team Guide**: `docs/rag-app-team-guide-v2.md`
- **Buildspec Examples**: `docs/buildspec-example-cdk.yml`
- **Pipeline Configuration**: `docs/application-pipeline-configuration.md`
