// In-memory DocDb for isolated tests. Transactions run one at a time and buffer
// their writes, which models Firestore's serializable retry behaviour. Writes and
// queries that Firestore would refuse throw here too.
import type { DocDb, DocTx, QuerySpec, Row } from "@/lib/doc-db"

type Doc = Record<string, unknown>

const isMap = (value: unknown): value is Doc => typeof value === "object" && value !== null && !Array.isArray(value)

function assertDefined(value: unknown, path: string): void {
  if (value === undefined) throw new Error(`Firestore rejects undefined at ${path}`)
  if (Array.isArray(value)) value.forEach((item, index) => assertDefined(item, `${path}.${index}`))
  else if (isMap(value)) for (const [key, item] of Object.entries(value)) assertDefined(item, `${path}.${key}`)
}

/** Firestore merges nested maps key by key; keys left out of a map survive. */
function deepMerge(target: Doc = {}, data: Doc): Doc {
  const merged = { ...target }
  for (const [key, value] of Object.entries(data)) merged[key] = isMap(value) && isMap(target[key]) ? deepMerge(target[key] as Doc, value) : value
  return merged
}

/** Equality filters merge single-field indexes; ordering on another field needs a composite index. */
function assertNoCompositeIndex(spec: QuerySpec): void {
  const filtered = [...(spec.where ?? []).map(([field]) => field), ...(spec.arrayContains ? [spec.arrayContains[0]] : [])]
  if (spec.orderBy && filtered.some((field) => field !== spec.orderBy?.field)) throw new Error("This query needs a composite index")
}

export function fakeDb(options: { acceptEveryone?: boolean } = {}) {
  const docs = new Map<string, Doc>()
  let queue: Promise<unknown> = Promise.resolve()

  const read = <T,>(path: string) => {
    const stored = docs.get(path) as T | undefined
    if (stored) return stored
    return options.acceptEveryone && path.startsWith("community_acceptance/") ? ({ ageConfirmed: true } as T) : null
  }
  const write = (path: string, data: object, merge?: boolean) => {
    assertDefined(data, path)
    docs.set(path, merge ? deepMerge(docs.get(path), data as Doc) : { ...data })
  }

  function select<T>(collection: string, spec: QuerySpec = {}): Row<T>[] {
    assertNoCompositeIndex(spec)
    const depth = collection.split("/").length + 1
    let rows = [...docs.entries()]
      .filter(([path]) => path.startsWith(`${collection}/`) && path.split("/").length === depth)
      .map(([path, data]) => ({ ...(data as T), id: path.split("/").pop() as string }))
      .filter((row) => (spec.where ?? []).every(([field, value]) => (row as Doc)[field] === value))
    const contains = spec.arrayContains
    if (contains) rows = rows.filter((row) => ((row as Doc)[contains[0]] as unknown[] | undefined)?.includes(contains[1]))
    const order = spec.orderBy
    if (order) {
      const key = (row: Row<T>) => (row as Doc)[order.field] as string | number
      rows = rows.sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0) * (order.direction === "desc" ? -1 : 1))
      if (spec.startAfter !== undefined) {
        rows = rows.filter((row) => (order.direction === "desc" ? key(row) < (spec.startAfter as string) : key(row) > (spec.startAfter as string)))
      }
    }
    return spec.limit ? rows.slice(0, spec.limit) : rows
  }

  const db: DocDb = {
    transaction<T>(run: (tx: DocTx) => Promise<T>): Promise<T> {
      const attempt = queue.then(async () => {
        const writes: (() => void)[] = []
        const assertNoWrites = () => {
          if (writes.length) throw new Error("Firestore transactions require every read before the first write")
        }
        const result = await run({
          async get<R>(path: string) {
            assertNoWrites()
            return read<R>(path)
          },
          async query<R>(collection: string, spec?: QuerySpec) {
            assertNoWrites()
            return select<R>(collection, spec)
          },
          set: (path, data, options) => void writes.push(() => write(path, data, options?.merge)),
          delete: (path) => void writes.push(() => docs.delete(path)),
        })
        for (const apply of writes) apply()
        return result
      })
      queue = attempt.catch(() => undefined)
      return attempt
    },
    get: async <T,>(path: string) => read<T>(path),
    query: async <T,>(collection: string, spec?: QuerySpec) => select<T>(collection, spec),
    set: async (path, data, options) => write(path, data, options?.merge),
    delete: async (path) => void docs.delete(path),
    count: async (collection, spec) => select(collection, spec).length,
  }

  return { db, docs, put: (path: string, data: object) => write(path, data) }
}
