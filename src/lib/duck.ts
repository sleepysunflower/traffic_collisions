// src/lib/duck.ts
import * as duckdb from '@duckdb/duckdb-wasm'

// EH build (good on Windows/Vite)
import DUCKDB_WASM_URL from '@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url'
import DUCKDB_WORKER_URL from '@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url'

let dbPromise: Promise<duckdb.AsyncDuckDB> | null = null
let httpfsReady = false

function toAbs(urlOrPath: string) {
  // Turn "./data/…" into absolute URL (works in dev and on GitHub Pages)
  return new URL(urlOrPath, window.location.href).toString()
}

// ✅ Correct regex: capture the quote and reuse it; no extra escapes
function rewriteReadParquet(sql: string) {
  return sql.replace(/read_parquet\((['"])([^'"]+)\1\)/g, (_m, _q, relPath) => {
    const abs = toAbs(relPath)
    return `read_parquet('${abs}')`
  })
}

export async function getDB() {
  if (dbPromise) return dbPromise
  const logger = new duckdb.ConsoleLogger()
  const worker = new Worker(DUCKDB_WORKER_URL, { type: 'module' })
  const db = new duckdb.AsyncDuckDB(logger, worker)
  await db.instantiate(DUCKDB_WASM_URL)
  dbPromise = Promise.resolve(db)
  return dbPromise
}

async function ensureHTTPFS(conn: duckdb.AsyncDuckDBConnection) {
  if (httpfsReady) return
  await conn.query(`INSTALL httpfs; LOAD httpfs;`)
  await conn.query(`SET enable_http_metadata_cache=true; SET enable_object_cache=true;`)
  httpfsReady = true
}

export async function parquetQuery<T = any>(sql: string): Promise<T[]> {
  const db = await getDB()
  const conn = await db.connect()
  try {
    await ensureHTTPFS(conn)
    const rewritten = rewriteReadParquet(sql)
    // Uncomment to verify once:
    // console.log('[DuckDB SQL]', rewritten)
    const res = await conn.query(rewritten)
    const rows: T[] = []
    for (let i = 0; i < res.numRows; i++) rows.push(res.get(i) as T)
    return rows
  } finally {
    await conn.close()
  }
}
