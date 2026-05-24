import { apiJson } from "~/lib/apiClient";
import type { AppTenant, AppUser } from "~/lib/auth";

export async function getTenants(): Promise<AppTenant[]> {
  const data = await apiJson<{ tenants: AppTenant[] }>("/api/tenants");
  return data.tenants;
}

export type OnboardingBody =
  | { action: "create"; tenantName: string }
  | { action: "join"; tenantId: string };

export async function submitOnboarding(
  body: OnboardingBody,
): Promise<{ user: AppUser; tenant: AppTenant }> {
  return apiJson<{ user: AppUser; tenant: AppTenant }>("/api/onboarding", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
