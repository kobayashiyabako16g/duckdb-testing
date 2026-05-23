import { Storage } from "@google-cloud/storage";
import { config } from "./config.js";

let storageClient: Storage | null = null;

function getStorageClient(): Storage {
  if (!storageClient) {
    // Cloud Run上では Workload Identity が ADC として自動機能
    // ローカルは `gcloud auth application-default login` で設定
    storageClient = new Storage();
  }
  return storageClient;
}

export async function generateSignedUrl(params: {
  fileName: string;
  tenantId: string;
  expiresInSeconds?: number;
}): Promise<string> {
  const { fileName, tenantId, expiresInSeconds = 3600 } = params;
  const objectPath = `tenant_id=${tenantId}/${fileName}`;

  const storage = getStorageClient();
  const file = storage.bucket(config.gcsBucketName).file(objectPath);
  const [signedUrl] = await file.getSignedUrl({
    version: "v4",
    action: "read",
    expires: Date.now() + expiresInSeconds * 1000,
  });
  return signedUrl;
}
