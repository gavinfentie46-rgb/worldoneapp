CREATE TABLE builds (
  id SERIAL PRIMARY KEY,
  project TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'App',
  stack TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'queued',
  payout INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX builds_created_at_idx ON builds (created_at DESC);
