import { copyFileSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { CURSOR_AUTH_TOKEN_KEY, CURSOR_MEMBERSHIP_KEY } from "../shared/constants";
import type { CursorAuth } from "../shared/types";

function cursorStateDbPath(): string {
  const appData = process.env.APPDATA;
  if (!appData) {
    throw new Error("APPDATA is not set; cannot locate the Cursor state database.");
  }
  return path.join(appData, "Cursor", "User", "globalStorage", "state.vscdb");
}

function copyStateDatabase(sourcePath: string): { directory: string; databasePath: string } {
  const directory = mkdtempSync(path.join(tmpdir(), "cursor-usage-"));
  const databasePath = path.join(directory, "state.vscdb");
  copyFileSync(sourcePath, databasePath);
  for (const suffix of ["-wal", "-shm"] as const) {
    const extraSource = `${sourcePath}${suffix}`;
    if (existsSync(extraSource)) {
      copyFileSync(extraSource, `${databasePath}${suffix}`);
    }
  }
  return { directory, databasePath };
}

function readItemValue(database: DatabaseSync, key: string): string | null {
  const row = database.prepare("SELECT value FROM ItemTable WHERE key = ?").get(key);
  if (!row || typeof row.value !== "string" || row.value.trim() === "") {
    return null;
  }
  return row.value;
}

export function readCursorAuth(): CursorAuth {
  const sourcePath = cursorStateDbPath();
  if (!existsSync(sourcePath)) {
    throw new Error(
      "Cursor is not signed in on this machine (state.vscdb was not found).",
    );
  }

  const copied = copyStateDatabase(sourcePath);
  try {
    const database = new DatabaseSync(copied.databasePath, { readOnly: true });
    try {
      const accessToken = readItemValue(database, CURSOR_AUTH_TOKEN_KEY);
      if (accessToken === null) {
        throw new Error("No Cursor access token was found. Sign in to Cursor and try again.");
      }
      return {
        accessToken,
        membershipType: readItemValue(database, CURSOR_MEMBERSHIP_KEY),
      };
    } finally {
      database.close();
    }
  } finally {
    rmSync(copied.directory, { recursive: true, force: true });
  }
}
