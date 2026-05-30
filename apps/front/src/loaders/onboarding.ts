import type { paths } from "~/lib/api-types.gen";
import { apiJson } from "~/lib/apiClient";
import type { AppTenant } from "~/lib/auth";

type TenantsResponse =
  paths["/api/tenants"]["get"]["responses"][200]["content"]["application/json"];

export async function getTenants(): Promise<AppTenant[]> {
  const data = await apiJson<TenantsResponse>("/api/tenants");
  return data.tenants;
}

export type OnboardingBody =
  paths["/api/onboarding"]["post"]["requestBody"]["content"]["application/json"];

type OnboardingResponse =
  paths["/api/onboarding"]["post"]["responses"][201]["content"]["application/json"];

export async function submitOnboarding(body: OnboardingBody): Promise<OnboardingResponse> {
  return apiJson<OnboardingResponse>("/api/onboarding", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
