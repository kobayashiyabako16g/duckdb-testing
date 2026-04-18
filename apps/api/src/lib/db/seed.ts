import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { seed, reset } from "drizzle-seed";
import * as schema from "./schema.js";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");

const client = postgres(url, { max: 1 });
const db = drizzle(client, { schema });

async function main() {
  await reset(db, schema);

  await seed(db, schema).refine((f) => ({
    tenants: {
      count: 3,
      columns: {
        id: f.valuesFromArray({ values: ["tenant-1", "tenant-2", "tenant-3"] }),
        name: f.companyName(),
      },
    },
    users: {
      count: 6,
      columns: {
        id: f.uuid(),
        email: f.email(),
        role: f.valuesFromArray({
          values: ["admin", "viewer"],
          isUnique: false,
        }),
      },
    },
  }));

  console.log("Seeding done.");
  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
