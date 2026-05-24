import { apiJson } from "~/lib/apiClient";

export interface UploadItem {
  yyyy: number;
  mm: number;
  dd: number;
  objectPath: string;
  size: number;
  uploadedAt: string;
  signedUrl: string;
}

export interface InitiateResponse {
  signedUrl: string;
  objectPath: string;
  requiredHeaders: Record<string, string>;
}

export async function initiateUpload(input: {
  contentType: string;
  yyyy?: number;
  mm?: number;
  dd?: number;
}): Promise<InitiateResponse> {
  return apiJson<InitiateResponse>("/api/uploads/initiate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function uploadFile(
  file: File,
  date: { yyyy: number; mm: number; dd: number },
): Promise<void> {
  const contentType = "text/csv";
  const { signedUrl, requiredHeaders } = await initiateUpload({
    contentType,
    yyyy: date.yyyy,
    mm: date.mm,
    dd: date.dd,
  });
  const putRes = await fetch(signedUrl, {
    method: "PUT",
    headers: requiredHeaders,
    body: file,
  });
  if (!putRes.ok) {
    let detail = "";
    try {
      detail = await putRes.text();
    } catch {
      // ignore
    }
    throw new Error(`GCS PUT failed: ${putRes.status} ${detail}`);
  }
}

export async function listUploads(input: {
  yyyy: number;
  mm: number;
  dd?: number;
}): Promise<UploadItem[]> {
  const params = new URLSearchParams({
    yyyy: String(input.yyyy),
    mm: String(input.mm),
  });
  if (input.dd !== undefined) params.set("dd", String(input.dd));
  const data = await apiJson<{ uploads: UploadItem[] }>(`/api/uploads?${params.toString()}`);
  return data.uploads;
}
