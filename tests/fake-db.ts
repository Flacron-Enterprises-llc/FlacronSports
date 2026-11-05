// In-memory DocDb for isolated tests. Transactions run one at a time and buffer
// their writes, which models Firestore's serializable retry behaviour.
import type { DocDb, DocTx, QuerySpec, Row } from "@/lib/doc-db"

export function fakeDb() {
  const docs = new Map<string, Record<string, unknown>>()
  let queue: Promise<unknown> = Promise.resolve()

  const read = <T,>(path: string) => (docs.get(path) as T | undefined) ?? null
  const write = (path: string, data: object, merge?: boolean) => {
    docs.set(path, merge ? { ...docs.get(path), ...data } : { ...data })
  }

  function select<T>(collection: string, spec: QuerySpec = {}): Row<T>[] {
    const depth = collection.split("/").length + 1
    let rows = [...docs.entries()]
      .filter(([path]) => path.startsWith(`${collection}/`) && path.split("/").length === depth)
      .map(([path, data]) => ({ ...(data as T), id: path.split("/").pop() as string }))
      .filter((row) => (spec.where ?? []).every(([field, value]) => (row as Record<string, unknown>)[field] === value))
    const order = spec.orderBy
    if (order) {
      const key = (row: Row<T>) => (row as Record<string, unknown>)[order.field] as string | number
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
        const writes: [string, object, boolean | undefined][] = []
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
          set: (path, data, options) => void writes.push([path, data, options?.merge]),
        })
        for (const [path, data, merge] of writes) write(path, data, merge)
        return result
      })
      queue = attempt.catch(() => undefined)
      return attempt
    },
    get: async <T,>(path: string) => read<T>(path),
    query: async <T,>(collection: string, spec?: QuerySpec) => select<T>(collection, spec),
    set: async (path, data, options) => write(path, data, options?.merge),
  }

  return { db, docs, put: (path: string, data: object) => write(path, data) }
}
