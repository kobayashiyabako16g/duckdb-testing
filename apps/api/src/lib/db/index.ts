import { config } from "../config.js";
import { PostgresRepository } from "./postgres.js";
import type { IUserRepository } from "./repository.js";

let repo: IUserRepository | null = null;

export function getRepository(): IUserRepository {
  if (!repo) {
    repo = new PostgresRepository(config.databaseUrl);
  }
  return repo;
}
