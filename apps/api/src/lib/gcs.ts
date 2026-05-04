import { Storage } from "@google-cloud/storage";
import { config } from "./config.js";

let storageClient: Storage | null = null;

function getStorageClient(): Storage {
  if (!storageClient) {
    if (config.gcsEmulatorHost) {
      // GCS エミュレータ使用時: エミュレータエンドポイントへ接続
      storageClient = new Storage({
        apiEndpoint: config.gcsEmulatorHost,
        projectId: "local-dev",
      });
    } else {
      // Cloud Run上では Workload Identity が ADC として自動機能
      // ローカルは `gcloud auth application-default login` で設定
      storageClient = new Storage();
    }
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

  // GCS エミュレータ使用時: 認証不要の直接 URL を返す (署名付き URL は実資格情報が必要なためスキップ)
  if (config.gcsEmulatorHost) {
    const encodedPath = encodeURIComponent(objectPath);
    return `${config.gcsEmulatorHost}/download/storage/v1/b/${config.gcsBucketName}/o/${encodedPath}?alt=media`;
  }

  const storage = getStorageClient();
  const file = storage.bucket(config.gcsBucketName).file(objectPath);
  const [signedUrl] = await file.getSignedUrl({
    version: "v4",
    action: "read",
    expires: Date.now() + expiresInSeconds * 1000,
  });
  return signedUrl;
}
