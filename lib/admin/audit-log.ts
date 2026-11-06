import type { DocDb } from "@/lib/doc-db"

const SCAN = 500
const PAGE = 100

export interface AuditEntry {
  id: string
  action: string
  actorUid: string
  detail: Record<string, string | number | boolean | null>
  at: string
}

/**
 * Firestore has no text search, so each call scans the next batch by time and matches
 * in memory. `before` continues from where the last batch ended, which keeps one
 * search bounded while still reaching the whole log.
 */
export async function searchAudit(db: Pick<DocDb, "query">, input: { q: string; before?: string | null }) {
  const needle = input.q.trim().toLowerCase().slice(0, 100)
  const rows = await db.query<Omit<AuditEntry, "id">>("audit_logs", {
    orderBy: { field: "at", direction: "desc" },
    limit: SCAN,
    ...(input.before ? { startAfter: input.before } : {}),
  })
  const matches = rows.filter((row) => !needle || `${row.action} ${row.actorUid} ${JSON.stringify(row.detail ?? {})}`.toLowerCase().includes(needle))
  const entries = matches.slice(0, PAGE)
  const lastRead = matches.length > PAGE ? entries.at(-1)?.at : rows.at(-1)?.at
  return { entries, next: rows.length === SCAN || matches.length > PAGE ? (lastRead ?? null) : null }
}
