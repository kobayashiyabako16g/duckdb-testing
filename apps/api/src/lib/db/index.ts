import { config } from '../config.js'
import { SqliteRepository } from './sqlite.js'
import type { IUserRepository } from './repository.js'

let repo: IUserRepository | null = null

export function getRepository(): IUserRepository {
  if (!repo) {
    repo = new SqliteRepository(config.dbPath)
  }
  return repo
}
