// src/lib/duck.ts
import * as duckdb from '@duckdb/duckdb-wasm';
import { asset } from '../utils/asset';

const bundles: duckdb.DuckDBBundles = {
  mvp: {
    mainModule: asset('duckdb/duckdb-mvp.wasm'),
    mainWorker: asset('duckdb/duckdb-browser-mvp.worker.js'),
  },
  eh: {
    mainModule: asset('duckdb/duckdb-eh.wasm'),
    mainWorker: asset('duckdb/duckdb-browser-eh.worker.js'),
  },
};

// singletons
let dbPromise: Promise<duckdb.AsyncDuckDB> | null = null;
let connPromise: Promise<duckdb.AsyncDuckDBConnection> | null = null;
let httpfsReady = false; // ensure we run INSTALL/LOAD only once

async function getDuckDB(): Promise<duckdb.AsyncDuckDB> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const logger = new duckdb.ConsoleLogger();
      const bundle = await duckdb.selectBundle(bundles);

      // bundle.mainWorker can be string | URL | null in typings; we assert non-null.
      const mainWorker = bundle.mainWorker!;
      const worker = new Worker(mainWorker); // OK: Worker accepts string | URL

      const db = new duckdb.AsyncDuckDB(logger, worker);
      await db.instantiate(bundle.mainModule); // load wasm
      // ❌ removed: await db.open({ query: 'INSTALL httpfs; LOAD httpfs;' });
      return db;
    })();
  }
  return dbPromise;
}

async function getConn(): Promise<duckdb.AsyncDuckDBConnection> {
  if (!connPromise) {
    connPromise = (async () => {
      const db = await getDuckDB();
      const c = await db.connect();
      if (!httpfsReady) {
        // Run on the connection instead of db.open({ query: ... })
        await c.query('INSTALL httpfs; LOAD httpfs;');
        httpfsReady = true;
      }
      return c;
    })();
  }
  return connPromise;
}

/** Run a DuckDB query and return JS objects */
export async function parquetQuery<T = any>(sql: string): Promise<T[]> {
  const conn = await getConn();
  const result = await conn.query(sql); // ArrowResult
  return result.toArray() as T[];
}
