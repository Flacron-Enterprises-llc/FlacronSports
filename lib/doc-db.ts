// A small document interface so that atomic limits can be tested against a
// serialized fake. Paths are composed from validated ids only.

import type { Query, Transaction } from "firebase-admin/firestore"
import { ApiError } from "@/lib/api-auth"
import { getAdminDb } from "@/lib/firebase-admin"

export interface QuerySpec {
  where?: [field: string, value: unknown][]
  arrayContains?: [field: string, value: unknown]
  orderBy?: { field: string; direction: "asc" | "desc" }
  limit?: number
  startAfter?: unknown
}

export type Row<T> = T & { id: string }

export interface DocTx {
  get<T>(path: string): Promise<T | null>
  query<T>(collection: string, spec?: QuerySpec): Promise<Row<T>[]>
  set(path: string, data: object, options?: { merge?: boolean }): void
  delete(path: string): void
}

export interface DocDb {
  transaction<T>(run: (tx: DocTx) => Promise<T>): Promise<T>
  get<T>(path: string): Promise<T | null>
  query<T>(collection: string, spec?: QuerySpec): Promise<Row<T>[]>
  set(path: string, data: object, options?: { merge?: boolean }): Promise<void>
  delete(path: string): Promise<void>
  count(collection: string, spec?: QuerySpec): Promise<number>
}

function buildQuery(firestore: NonNullable<ReturnType<typeof getAdminDb>>, collection: string, spec: QuerySpec = {}): Query {
  let query: Query = firestore.collection(collection)
  for (const [field, value] of spec.where ?? []) query = query.where(field, "==", value)
  if (spec.arrayContains) query = query.where(spec.arrayContains[0], "array-contains", spec.arrayContains[1])
  if (spec.orderBy) query = query.orderBy(spec.orderBy.field, spec.orderBy.direction)
  if (spec.startAfter !== undefined) query = query.startAfter(spec.startAfter)
  if (spec.limit) query = query.limit(spec.limit)
  return query
}

export function firestoreDocDb(): DocDb {
  const firestore = getAdminDb()
  if (!firestore) throw new ApiError(503, "storage_unavailable", "This service is temporarily unavailable")

  return {
    transaction: (run) =>
      firestore.runTransaction((tx: Transaction) =>
        run({
          async get<T>(path: string) {
            const doc = await tx.get(firestore.doc(path))
            return doc.exists ? (doc.data() as T) : null
          },
          async query<T>(collection: string, spec?: QuerySpec) {
            const found = await tx.get(buildQuery(firestore, collection, spec))
            return found.docs.map((doc) => ({ ...(doc.data() as T), id: doc.id }))
          },
          set(path, data, options) {
            tx.set(firestore.doc(path), data, { merge: options?.merge === true })
          },
          delete(path) {
            tx.delete(firestore.doc(path))
          },
        }),
      ),
    async get<T>(path: string) {
      const doc = await firestore.doc(path).get()
      return doc.exists ? (doc.data() as T) : null
    },
    async query<T>(collection: string, spec?: QuerySpec) {
      const found = await buildQuery(firestore, collection, spec).get()
      return found.docs.map((doc) => ({ ...(doc.data() as T), id: doc.id }))
    },
    async set(path, data, options) {
      await firestore.doc(path).set(data, { merge: options?.merge === true })
    },
    async delete(path) {
      await firestore.doc(path).delete()
    },
    async count(collection, spec) {
      return (await buildQuery(firestore, collection, spec).count().get()).data().count
    },
  }
}
