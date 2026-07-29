import fs from "fs";
import path from "path";
import { pool } from "./db";

async function run() {
  const sql = fs.readFileSync(path.join(__dirname, "../sql/schema.sql"), "utf-8");
  await pool.query(sql);
  console.log("Schema applied successfully.");
  await pool.end();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});