import { STSClient, AssumeRoleCommand } from "@aws-sdk/client-sts";

let stsClient: STSClient | null = null;

const getStsClient = (): STSClient => {
  if (!stsClient) {
    console.log("Initializing new STSClient...");
    stsClient = new STSClient();
  }
  return stsClient;
};

type Statement = {
  Effect: string;
  Action: string[];
  Resource: string[];
};

/**
 * @example Policy
 * ```javascript
 * const policy: Policy = {
 *   Statement: [
 *     {
 *       Effect: "Allow",
 *       Action: ["s3:GetObject", "s3:ListBucket"],
 *       Resource: [
 *         `arn:aws:s3:::my-bucket/data/tenant_id=123`,
 *         `arn:aws:s3:::my-bucket/data/tenant_id=123/*`,
 *       ],
 *     },
 *   ],
 * };
 *
 * ```
 **/
type Policy = {
  Statement: Statement[];
};

export const generateCredentials = async (params: {
  userId: string;
  tenantId: string;
  roleArn: string;
  region: string;
}) => {
  const client = getStsClient();

  const policy = {
    Version: "2012-10-17",
    Statement: [
      {
        Effect: "Allow",
        Action: ["s3:GetObject", "s3:ListBucket"],
        Resource: [
          `arn:aws:s3:::my-bucket/data/tenant_id=${params.tenantId}`,
          `arn:aws:s3:::my-bucket/data/tenant_id=${params.tenantId}/*`,
        ],
      },
    ],
  };

  return client.send(
    new AssumeRoleCommand({
      RoleArn: params.roleArn,
      RoleSessionName: `DuckDB-${params.userId}`,
      DurationSeconds: 3600,
      Policy: JSON.stringify(policy),
    }),
  );
};
