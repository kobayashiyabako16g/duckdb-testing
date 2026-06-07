#!/usr/bin/env node
// mock_data.csv を生成して gzip 圧縮 (拡張子は .csv のまま)
// Node v22.6+ の Type Stripping で .mts を直接実行できます
//   https://nodejs.org/api/typescript.html#type-stripping
// Usage:
//   node scripts/generate-mock-data.mts
//   node scripts/generate-mock-data.mts --rows 365 --start 2026-06-01 --out ./mock_data.csv
//   node scripts/generate-mock-data.mts --start 2026-06-01 --end 2026-12-31

import { writeFile } from "node:fs/promises";
import { parseArgs, promisify } from "node:util";
import { gzip } from "node:zlib";
import { faker } from "@faker-js/faker";

const gzipAsync = promisify(gzip);

const { values } = parseArgs({
  options: {
    rows: { type: "string", default: "10000" },
    out: { type: "string", default: "mock_data.csv" },
    start: { type: "string", default: "2026-06-01" },
    end: { type: "string" },
  },
});

const outPath = values.out!;
const startStr = values.start!;
const endStr = values.end;

const startDate = new Date(`${startStr}T00:00:00Z`);
if (Number.isNaN(startDate.getTime())) {
  console.error(`invalid --start: ${startStr}`);
  process.exit(1);
}

let rowCount: number;
if (endStr !== undefined) {
  const endDate = new Date(`${endStr}T00:00:00Z`);
  if (Number.isNaN(endDate.getTime())) {
    console.error(`invalid --end: ${endStr}`);
    process.exit(1);
  }
  if (endDate.getTime() < startDate.getTime()) {
    console.error(`--end (${endStr}) must be >= --start (${startStr})`);
    process.exit(1);
  }
  rowCount =
    Math.floor((endDate.getTime() - startDate.getTime()) / 86400000) + 1;
} else {
  rowCount = Number(values.rows);
  if (!Number.isFinite(rowCount) || rowCount <= 0) {
    console.error(`invalid --rows: ${values.rows}`);
    process.exit(1);
  }
}

function fmtDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const lines: string[] = ["timestamp,cpu_usage,memory_usage,swap_usage"];
for (let i = 0; i < rowCount; i++) {
  const d = new Date(startDate.getTime() + i * 86400000);
  const cpu = faker.number.float({ min: 0, max: 100, fractionDigits: 1 });
  const mem = faker.number.float({ min: 0, max: 100, fractionDigits: 1 });
  const swap = faker.number.float({ min: 0, max: 100, fractionDigits: 1 });
  lines.push([fmtDate(d), cpu, mem, swap].join(","));
}

const csv = Buffer.from(lines.join("\n") + "\n", "utf8");
const compressed = await gzipAsync(csv);

await writeFile(outPath, compressed);

console.log(
  `wrote ${outPath} (rows=${rowCount}, raw=${csv.byteLength}B, gzip=${compressed.byteLength}B)`,
);
