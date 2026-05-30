import type { paths } from "~/lib/api-types.gen";
import { apiJson } from "~/lib/apiClient";
import type { AppUser } from "~/lib/auth";

export type CreatedUser = AppUser;

type CreateUserBody =
  paths["/api/users"]["post"]["requestBody"]["content"]["application/json"];
type CreateUserResponse =
  paths["/api/users"]["post"]["responses"][201]["content"]["application/json"];

export async function createUser(input: CreateUserBody): Promise<CreatedUser> {
  const data = await apiJson<CreateUserResponse>("/api/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return data.user;
}
