# 猫と名言

Cloudflare Worker のシークレット `THECATAPI_KEY` に TheCatAPI の API キーを設定してください。Cloudflare ダッシュボードでは、この Worker の **Settings → Variables and Secrets** で追加し、種類は **Secret** を選びます。キーはブラウザーには送られません。

ローカルで実行するには、プロジェクト直下の `.dev.vars` に API キーを入力します。このファイルは `.gitignore` で除外されています。

```dotenv
THECATAPI_KEY=取得したAPIキー
```

Wrangler は `.env` も読み込みますが、`.dev.vars` があると `.env` は無視されます。混乱を避けるため、このプロジェクトでは `.dev.vars` だけを使ってください。

`npm install` の後に `npm run dev` を実行すると、画面をビルドして Cloudflare Worker をローカル起動します。画面と `/api/cat` の両方が利用できます。画面のみを Vite で起動する場合は `npm run dev:vite` を使えます。
