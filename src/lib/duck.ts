import * as duckdb from '@duckdb/duckdb-wasm'

let dbPromise: Promise<duckdb.AsyncDuckDB> | null = null

export async function getDB() {
  if (dbPromise) return dbPromise
  const JSDELIVR_BUNDLES = duckdb.getJsDelivrBundles()
  const bundle = await duckdb.selectBundle(JSDELIVR_BUNDLES)
  const worker = new Worker(new URL('@duckdb/duckdb-wasm/dist/duckdb-browser.worker.js', import.meta.url), { type: 'module' })
  const logger = new duckdb.ConsoleLogger()
  const db = new duckdb.AsyncDuckDB(logger, worker)
  await db.instantiate(bundle.mainModule, bundle.pthreadWorker)
  dbPromise = Promise.resolve(db)
  return db
}

export async function parquetQuery<T = any>(sql: string): Promise<T[]> {
  const db = await getDB()
  const c = await db.connect()
  try {
    const res = await c.query(sql)
    const rows: T[] = []
    for (let i = 0; i < res.numRows; i++) rows.push(res.get(i) as T)
    return rows
  } finally { await c.close() }
}
