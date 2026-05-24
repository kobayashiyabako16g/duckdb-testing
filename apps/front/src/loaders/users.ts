import { apiJson } from "~/lib/apiClient";

export interface CreatedUser {
  id: string;
  tenant_id: string;
  email: string;
  role: string;
}

export async function createUser(input: {
  email: string;
  role: "admin" | "viewer";
}): Promise<CreatedUser> {
  const data = await apiJson<{ user: CreatedUser }>("/api/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return data.user;
}
