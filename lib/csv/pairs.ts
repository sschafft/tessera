/**
 * Minimal CSV parser + builder for the "Upload pre-built game" flow.
 * Handles the common cases (quoted fields, commas/quotes inside quotes,
 * CRLF/LF line endings). Deliberately non-streaming and dependency-free
 * — workshop rosters are <= ~60 rows so the simple O(n) scan is fine.
 */

export type CsvRole = "builder" | "guider" | "observer";

export interface ParsedRow {
  /** 1-based row number including the header. Used for error messages. */
  line: number;
  name: string;
  email: string | null;
  team_name: string;
  role: CsvRole;
}

export interface ParseError {
  line: number;
  message: string;
}

export interface ParseResult {
  rows: ParsedRow[];
  errors: ParseError[];
}

/** Header columns the parser expects, in this order. */
export const CSV_HEADERS = ["name", "email", "team_name", "role"] as const;

const ROLE_VALUES: ReadonlySet<string> = new Set([
  "builder",
  "guider",
  "observer",
]);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_NAME_LEN = 40;
const MAX_TEAM_LEN = 60;
const MAX_EMAIL_LEN = 120;

/**
 * Parse one CSV record from a raw line. Handles quoted fields with
 * escaped doubled quotes (RFC-4180 lite). Returns the field array.
 */
function splitRecord(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cur += c;
      }
    } else {
      if (c === '"' && cur.length === 0) {
        inQuotes = true;
      } else if (c === ",") {
        out.push(cur);
        cur = "";
      } else {
        cur += c;
      }
    }
  }
  out.push(cur);
  return out;
}

export function parsePairsCsv(text: string): ParseResult {
  const errors: ParseError[] = [];
  const rows: ParsedRow[] = [];

  const cleaned = text.replace(/﻿/g, ""); // strip BOM
  const lines = cleaned.split(/\r\n|\r|\n/);

  // Find first non-empty line as header.
  let headerIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i]!.trim().length > 0) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) {
    errors.push({ line: 1, message: "CSV is empty." });
    return { rows, errors };
  }

  const headerCells = splitRecord(lines[headerIdx]!).map((c) =>
    c.trim().toLowerCase(),
  );
  // Map column header → index. Tolerate extra columns; require the four.
  const indexOf: Record<(typeof CSV_HEADERS)[number], number> = {
    name: -1,
    email: -1,
    team_name: -1,
    role: -1,
  };
  for (let i = 0; i < headerCells.length; i++) {
    const h = headerCells[i]!;
    if (h === "name" || h === "team_name" || h === "role" || h === "email") {
      indexOf[h] = i;
    }
  }
  for (const required of ["name", "team_name", "role"] as const) {
    if (indexOf[required] === -1) {
      errors.push({
        line: headerIdx + 1,
        message: `missing required column: ${required}`,
      });
    }
  }
  if (errors.length > 0) return { rows, errors };

  // Walk data rows.
  const seenNames = new Set<string>();
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const raw = lines[i]!;
    if (raw.trim().length === 0) continue;
    const cells = splitRecord(raw).map((c) => c.trim());
    const name = cells[indexOf.name] ?? "";
    const team_name = cells[indexOf.team_name] ?? "";
    const role = (cells[indexOf.role] ?? "").toLowerCase();
    const emailRaw =
      indexOf.email >= 0 ? (cells[indexOf.email] ?? "") : "";
    const lineNum = i + 1;

    if (!name) {
      errors.push({ line: lineNum, message: "name is required" });
      continue;
    }
    if (name.length > MAX_NAME_LEN) {
      errors.push({
        line: lineNum,
        message: `name longer than ${MAX_NAME_LEN} chars`,
      });
      continue;
    }
    const nameKey = name.toLowerCase();
    if (seenNames.has(nameKey)) {
      errors.push({
        line: lineNum,
        message: `duplicate name "${name}" (case-insensitive)`,
      });
      continue;
    }
    seenNames.add(nameKey);

    if (!team_name) {
      errors.push({ line: lineNum, message: "team_name is required" });
      continue;
    }
    if (team_name.length > MAX_TEAM_LEN) {
      errors.push({
        line: lineNum,
        message: `team_name longer than ${MAX_TEAM_LEN} chars`,
      });
      continue;
    }
    if (!ROLE_VALUES.has(role)) {
      errors.push({
        line: lineNum,
        message: `role must be one of builder | guider | observer (got "${role}")`,
      });
      continue;
    }
    let email: string | null = null;
    if (emailRaw) {
      if (!EMAIL_RE.test(emailRaw) || emailRaw.length > MAX_EMAIL_LEN) {
        errors.push({
          line: lineNum,
          message: `email invalid: "${emailRaw}"`,
        });
        continue;
      }
      email = emailRaw.toLowerCase();
    }

    rows.push({
      line: lineNum,
      name,
      email,
      team_name,
      role: role as CsvRole,
    });
  }

  return { rows, errors };
}

/**
 * Group parsed rows into pair-shaped records. Each team_name should
 * have exactly one builder + one guider for a valid pair; observers
 * attach to the same pair. Reports errors for under-staffed or
 * over-staffed teams.
 */
export interface TeamGroup {
  team_name: string;
  builder: ParsedRow | null;
  guider: ParsedRow | null;
  observers: ParsedRow[];
  /** Rows that broke the "one builder + one guider" invariant. */
  conflicts: ParsedRow[];
}

export function groupByTeam(rows: ParsedRow[]): TeamGroup[] {
  const map = new Map<string, TeamGroup>();
  for (const r of rows) {
    const key = r.team_name;
    let g = map.get(key);
    if (!g) {
      g = {
        team_name: key,
        builder: null,
        guider: null,
        observers: [],
        conflicts: [],
      };
      map.set(key, g);
    }
    if (r.role === "builder") {
      if (g.builder) g.conflicts.push(r);
      else g.builder = r;
    } else if (r.role === "guider") {
      if (g.guider) g.conflicts.push(r);
      else g.guider = r;
    } else {
      g.observers.push(r);
    }
  }
  return Array.from(map.values());
}

/** Quote a CSV field if it contains a comma, quote, or newline. */
function quoteField(s: string): string {
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/** The downloadable template — header + a couple of example rows. */
export function pairsTemplateCsv(): string {
  const header = ["name", "email", "team_name", "role"].join(",");
  const examples = [
    [
      "Sam Architect",
      "sam@example.com",
      "The Pelicans",
      "builder",
    ],
    [
      "Jules Engineer",
      "jules@example.com",
      "The Pelicans",
      "guider",
    ],
    [
      "Hugo Reviewer",
      "hugo@example.com",
      "The Pelicans",
      "observer",
    ],
    [
      "Avery Designer",
      "avery@example.com",
      "The Otters",
      "builder",
    ],
    [
      "Cameron Researcher",
      "cameron@example.com",
      "The Otters",
      "guider",
    ],
  ].map((cells) => cells.map(quoteField).join(","));
  return [header, ...examples].join("\n") + "\n";
}

/**
 * Re-emit the parsed rows as a CSV with one extra column —
 * `join_url` — populated per participant. Used as the download
 * the GM hands back to participants.
 */
export function pairsCsvWithJoinUrls(
  rows: Array<ParsedRow & { join_url: string }>,
): string {
  const header = ["name", "email", "team_name", "role", "join_url"].join(",");
  const body = rows.map((r) =>
    [
      quoteField(r.name),
      quoteField(r.email ?? ""),
      quoteField(r.team_name),
      r.role,
      quoteField(r.join_url),
    ].join(","),
  );
  return [header, ...body].join("\n") + "\n";
}
