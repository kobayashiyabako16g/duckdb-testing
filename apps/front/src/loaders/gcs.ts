import { apiJson, ApiError } from "~/lib/apiClient";

export async function getGCSSignedUrl(fileName: string): Promise<string | undefined> {
  try {
    const data = await apiJson<{ signedUrl: string }>(
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
