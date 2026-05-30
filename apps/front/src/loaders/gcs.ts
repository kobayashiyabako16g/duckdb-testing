import type { paths } from "~/lib/api-types.gen";
import { apiJson, ApiError } from "~/lib/apiClient";

type SignedUrlResponse =
  paths["/api/signed-url"]["get"]["responses"][200]["content"]["application/json"];

export async function getGCSSignedUrl(fileName: string): Promise<string | undefined> {
  try {
    const data = await apiJson<SignedUrlResponse>(
      `/api/signed-url?file=${encodeURIComponent(fileName)}`,
    );
    return data.signedUrl;
  } catch (err) {
    if (err instanceof ApiError) {
      console.error("Error fetching GCS signed URL:", err.message);
      return undefined;
    }
    console.error("Error fetching GCS signed URL:", err);
    return undefined;
  }
}
