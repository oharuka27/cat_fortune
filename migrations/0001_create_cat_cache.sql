-- TheCatAPI へのリクエスト回数を、アプリ利用者全員で共有して数えるための枠（常に1行だけ）
CREATE TABLE api_window (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  started_at INTEGER NOT NULL,     -- 枠の1回目のリクエスト時刻（UNIX時間ミリ秒）
  request_count INTEGER NOT NULL   -- 枠内で TheCatAPI にリクエストした回数
);

-- 枠内で TheCatAPI から取得した画像と、組み合わせた名言のキャッシュ
CREATE TABLE cat_cache (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  window_started_at INTEGER NOT NULL,
  image_id TEXT NOT NULL,
  image_url TEXT NOT NULL,
  quote_id INTEGER NOT NULL,
  quote_text TEXT NOT NULL,
  author TEXT NOT NULL,
  profile TEXT NOT NULL
);

CREATE INDEX cat_cache_window_started_at ON cat_cache (window_started_at);
