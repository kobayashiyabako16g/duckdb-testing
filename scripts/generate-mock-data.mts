#!/usr/bin/env node
// mock_data.csv を生成して gzip 圧縮 (拡張子は .csv のまま)
// Node v22.6+ の Type Stripping で .mts を直接実行できます
//   https://nodejs.org/api/typescript.html#type-stripping
// Usage:
//   node scripts/generate-mock-data.mts
//   node scripts/generate-mock-data.mts --rows 50000 --out ./mock_data.csv

import { writeFile } from "node:fs/promises";
import { parseArgs, promisify } from "node:util";
import { gzip } from "node:zlib";
import { faker } from "@faker-js/faker";

const gzipAsync = promisify(gzip);

const { values } = parseArgs({
  options: {
    rows: { type: "string", default: "10000" },
    out: { type: "string", default: "mock_data.csv" },
  },
});

const rowCount = Number(values.rows);
const outPath = values.out!;

if (!Number.isFinite(rowCount) || rowCount <= 0) {
  console.error(`invalid --rows: ${values.rows}`);
  process.exit(1);
}

const lines: string[] = ["id,first_name,last_name,email,gender,ip_address"];
for (let i = 1; i <= rowCount; i++) {
  const fn = faker.person.firstName();
  const ln = faker.person.lastName();
  const email = `${fn.toLowerCase()}.${ln.toLowerCase()}${i}@example.com`;
  lines.push([i, fn, ln, email, faker.person.sex(), faker.internet.ipv4()].join(","));
}

const csv = Buffer.from(lines.join("\n") + "\n", "utf8");
const compressed = await gzipAsync(csv);

await writeFile(outPath, compressed);

console.log(
  `wrote ${outPath} (rows=${rowCount}, raw=${csv.byteLength}B, gzip=${compressed.byteLength}B)`,
);
