import type { components, paths } from "~/lib/api-types.gen";
import { apiJson } from "~/lib/apiClient";

export type UploadItem = components["schemas"]["UploadItem"];

type InitiateBody =
  paths["/api/uploads/initiate"]["post"]["requestBody"]["content"]["application/json"];
export type InitiateResponse =
  paths["/api/uploads/initiate"]["post"]["responses"][200]["content"]["application/json"];

type ListUploadsResponse =
  paths["/api/uploads"]["get"]["responses"][200]["content"]["application/json"];

export async function initiateUpload(input: InitiateBody): Promise<InitiateResponse> {
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
  const data = await apiJson<ListUploadsResponse>(`/api/uploads?${params.toString()}`);
  return data.uploads;
}

export async function listUploadsRange(input: {
  from_yyyy: number;
  from_mm: number;
  to_yyyy: number;
  to_mm: number;
}): Promise<UploadItem[]> {
  const params = new URLSearchParams({
    from_yyyy: String(input.from_yyyy),
    from_mm: String(input.from_mm),
    to_yyyy: String(input.to_yyyy),
    to_mm: String(input.to_mm),
  });
  const data = await apiJson<ListUploadsResponse>(`/api/uploads?${params.toString()}`);
  return data.uploads;
}
