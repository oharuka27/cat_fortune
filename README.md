# 猫と名言

Cloudflare Worker のシークレット `THECATAPI_KEY` に TheCatAPI の API キーを設定してください。Cloudflare ダッシュボードでは、この Worker の **Settings → Variables and Secrets** で追加し、種類は **Secret** を選びます。キーはブラウザーには送られません。

## ローカルでの実行

### 1. 依存パッケージのインストール

```sh
npm install
```

### 2. API キーの設定

プロジェクト直下に `.dev.vars` を作成し、TheCatAPI の API キーを入力します。このファイルは `.gitignore` で除外されています。

```dotenv
THECATAPI_KEY=取得したAPIキー
```

Wrangler は `.env` も読み込みますが、`.dev.vars` があると `.env` は無視されます。混乱を避けるため、このプロジェクトでは `.dev.vars` だけを使ってください。

### 3. ローカル用 D1 のテーブル作成

```sh
npx wrangler d1 migrations apply cat-fortune-db --local
```

ローカル用の D1 は `.wrangler/` 配下に作られ、本番のデータベースとは別物です。適用済みのときに再実行しても、何も変更されません。

### 4. 起動

```sh
npm run dev
```

画面をビルドして Cloudflare Worker をローカル起動します。表示された `http://localhost:8787` をブラウザーで開くと、画面と `/api/cat` の両方が利用できます。停止するには `Ctrl + C` を押します。

画面のみを Vite で起動する場合は `npm run dev:vite` を使えます。ただし `/api/cat` は動かないため、猫の写真は取得できません。

### 5. 動作確認

1. 1分以内にボタンを11回以上押します。1〜10回目は毎回新しい写真が届き、11回目以降はそれまでに届いたものから直前と異なるものが表示されます。
2. 1回目から1分以上経ってから押すと、再び新しい写真が届きます。

ローカル用 D1 の中身は次のコマンドで確認できます（開始時刻は日本時間で表示）。

```sh
npx wrangler d1 execute cat-fortune-db --local --command "SELECT datetime(started_at/1000,'unixepoch','+9 hours') AS started_at_jst, request_count FROM api_window; SELECT id, image_id, author FROM cat_cache;"
```

回数とキャッシュを最初の状態に戻すには、次のコマンドを実行します。

```sh
npx wrangler d1 execute cat-fortune-db --local --command "DELETE FROM api_window; DELETE FROM cat_cache;"
```

ローカルでも本物の TheCatAPI にリクエストします。本番と同じ API キーを使う場合、利用回数は本番と合算されます。また、同じ IP からは1分間に30回までの制限があり、超えるとエラーメッセージが表示されます。

### ユニットテスト

```sh
npm test
```

## TheCatAPI の利用回数制限（Cloudflare D1）

TheCatAPI 無料プランの上限に合わせ、アプリ利用者全員で TheCatAPI へのリクエストを1分間に10回までに制限しています。

- 1分の枠内で最初のリクエストが来た時刻を記録し、10回までは TheCatAPI から画像を取得します。取得した画像・名言・人物名は D1 にキャッシュします。
- 11回目以降は、1回目から1分経つまでキャッシュの10件から前回表示と異なるものをランダムに返します。
- 1回目から1分以上経ったら、キャッシュを消して新しい枠を始めます。

回数と取得結果は D1 データベース `cat-fortune-db`（バインディング名 `DB`）に保存します。Workers KV は書き込みが他の拠点に反映されるまで時間がかかり、回数を正確に数えられないため使っていません。テーブル定義は `migrations/` にあります。

本番の D1 にテーブルを作成するには、次のコマンドを実行します。

```sh
npx wrangler d1 migrations apply cat-fortune-db --remote
```
