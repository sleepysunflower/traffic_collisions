export const asset = (p: string) => {
  const base = (import.meta.env.BASE_URL || '/').replace(/\/+$/, '/'); // ensure trailing slash
  const rel  = String(p).replace(/^\/+/, '');                           // strip leading slash
  return base + rel;                                                    // e.g. /traffic_collisions/duckdb/...
};
