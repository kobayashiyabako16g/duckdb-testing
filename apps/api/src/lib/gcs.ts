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
  return generateReadSignedUrl({ objectPath, expiresInSeconds });
}

export async function generateReadSignedUrl(params: {
  objectPath: string;
  expiresInSeconds?: number;
}): Promise<string> {
  const { objectPath, expiresInSeconds = 3600 } = params;
  const storage = getStorageClient();
  const file = storage.bucket(config.gcsBucketName).file(objectPath);
  const [signedUrl] = await file.getSignedUrl({
    version: "v4",
    action: "read",
    expires: Date.now() + expiresInSeconds * 1000,
  });
  return signedUrl;
}

export async function generateUploadSignedUrl(params: {
  objectPath: string;
  contentType: string;
  expiresInSeconds?: number;
}): Promise<string> {
  const { objectPath, contentType, expiresInSeconds = 3600 } = params;
  const storage = getStorageClient();
  const file = storage.bucket(config.gcsBucketName).file(objectPath);
  const [signedUrl] = await file.getSignedUrl({
    version: "v4",
    action: "write",
    expires: Date.now() + expiresInSeconds * 1000,
    contentType,
  });
  return signedUrl;
}

export interface ObjectMeta {
  size: number;
  updated: string;
}

export async function getObjectMeta(objectPath: string): Promise<ObjectMeta | null> {
  const storage = getStorageClient();
  const file = storage.bucket(config.gcsBucketName).file(objectPath);
  try {
    const [meta] = await file.getMetadata();
    return {
      size: typeof meta.size === "string" ? Number(meta.size) : (meta.size ?? 0),
      updated: meta.updated ?? new Date().toISOString(),
    };
  } catch (err: unknown) {
    if (typeof err === "object" && err !== null && "code" in err) {
      const code = (err as { code?: number }).code;
      if (code === 404) return null;
    }
    throw err;
  }
}

export interface ListedObject {
  name: string;
  size: number;
  updated: string;
}

export async function listObjects(params: { prefix: string }): Promise<ListedObject[]> {
  const storage = getStorageClient();
  const [files] = await storage.bucket(config.gcsBucketName).getFiles({ prefix: params.prefix });
  return files.map((f) => ({
    name: f.name,
    size: typeof f.metadata.size === "string" ? Number(f.metadata.size) : (f.metadata.size ?? 0),
    updated: f.metadata.updated ?? new Date().toISOString(),
  }));
}
