import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

type S3Props = {
  bucket: string;
  key: string;
  credentials: {
    accessKeyId: string;
    secretAccessKey: string;
  };
};
export async function GetS3SignedUr({ bucket, key, credentials }: S3Props) {
  const s3Client = new S3Client({
    region: "ap-northeast-1",
    credentials: {
      accessKeyId: credentials.accessKeyId,
      secretAccessKey: credentials.secretAccessKey,
    },
  });
  try {
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    const signedUrl = await getSignedUrl(s3Client, command, {
      expiresIn: 3600,
    });
    return signedUrl;
  } catch (error) {
    console.error("Error generating signed URL:", error);
    return undefined;
  }
}
