/**
 * Lightweight email registry — maps vault address → owner email.
 *
 * Development: persists to .data/emails.json on the local filesystem.
 * Production (Vercel): falls back to an in-process Map (survives warm invocations;
 * replace with Vercel KV / Upstash for true persistence in prod).
 */

import * as fs from "fs";
import * as path from "path";

const DATA_FILE = path.join(process.cwd(), ".data", "emails.json");

function readStore(): Record<string, string> {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } catch {
    return {};
  }
}

function writeStore(store: Record<string, string>) {
  try {
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2));
  } catch {
    // Read-only filesystem (Vercel) — fall through to in-memory only
  }
}

// In-memory fallback (populated from file at startup)
const memoryStore: Record<string, string> = readStore();

export function registerEmail(vaultAddress: string, email: string) {
  memoryStore[vaultAddress] = email;
  writeStore(memoryStore);
}

export function lookupEmail(vaultAddress: string): string | undefined {
  return memoryStore[vaultAddress];
}

export function allEntries(): Array<{ vault: string; email: string }> {
  return Object.entries(memoryStore).map(([vault, email]) => ({ vault, email }));
}
