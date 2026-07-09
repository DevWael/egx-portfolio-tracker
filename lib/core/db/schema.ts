export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS securities (
  ticker   TEXT PRIMARY KEY,
  name     TEXT NOT NULL,
  sector   TEXT,
  currency TEXT NOT NULL DEFAULT 'EGP'
);

CREATE TABLE IF NOT EXISTS transactions (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  ticker    TEXT NOT NULL REFERENCES securities(ticker),
  side      TEXT NOT NULL CHECK (side IN ('buy','sell')),
  qty       INTEGER NOT NULL,
  price     INTEGER NOT NULL,
  fee       INTEGER NOT NULL DEFAULT 0,
  traded_at TEXT NOT NULL,
  note      TEXT
);

CREATE TABLE IF NOT EXISTS prices (
  ticker TEXT NOT NULL REFERENCES securities(ticker),
  date   TEXT NOT NULL,
  open   INTEGER NOT NULL,
  high   INTEGER NOT NULL,
  low    INTEGER NOT NULL,
  close  INTEGER NOT NULL,
  volume INTEGER NOT NULL,
  source TEXT NOT NULL,
  PRIMARY KEY (ticker, date)
);

CREATE TABLE IF NOT EXISTS watchlist_alerts (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  ticker       TEXT NOT NULL REFERENCES securities(ticker),
  target_price INTEGER NOT NULL,
  direction    TEXT NOT NULL CHECK (direction IN ('above','below')),
  active       INTEGER NOT NULL DEFAULT 1,
  note         TEXT,
  created_at   TEXT NOT NULL,
  triggered_at TEXT
);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT
);
`;
