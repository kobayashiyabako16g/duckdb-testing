import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { seed, reset } from "drizzle-seed";
import { v7 as uuidv7 } from "uuid";
import * as schema from "./schema.js";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");

const client = postgres(url, { max: 1 });
const db = drizzle(client, { schema });

async function main() {
  await reset(db, schema);

  const tenantIds = Array.from({ length: 3 }, () => uuidv7());

  await seed(db, schema).refine((f) => ({
    tenants: {
      count: 3,
      columns: {
        id: f.valuesFromArray({ values: tenantIds, isUnique: true }),
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

  await db.insert(schema.users).values({
    tenantId: tenantIds[0]!,
    email: "dev@example.com",
    role: "admin",
  });

  console.log("Seeding done.");
  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
