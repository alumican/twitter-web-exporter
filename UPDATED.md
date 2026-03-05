# Fork Changes (twitter-web-exporter-custom)

このドキュメントは、prinsss版の [twitter-web-exporter](https://github.com/prinsss/twitter-web-exporter) に対して本フォークで加えた変更をまとめたものです。

---

## 1. ブックマークフォルダ単位の収集とマージ

### 背景

prinsss版ではブックマーク全体 (`/Bookmarks`) の取得のみに対応しており、Twitter のブックマークフォルダ (`BookmarkFolderTimeline`) を個別に収集する手段がなかった。フォルダ単位でブックマークを管理しているユーザーにとって、特定フォルダのみをエクスポートしたり、複数フォルダのデータを統合して扱いたいというニーズがあった。

### 変更内容

- **`BookmarkFolderTimeline` API のインターセプト追加** — `/graphql/.+/BookmarkFolderTimeline` へのレスポンスもキャプチャ対象に加え、フォルダ閲覧時にもデータを自動収集できるようにした。
- **`bookmark_collection_ids` フィールドの追加** — `Capture` 型にブックマークフォルダ ID の配列を追加。同じツイートが複数フォルダに属する場合でも、どのフォルダのものかを記録できる。
- **既存キャプチャとのマージ処理** — フォルダ経由で取得したツイートが既に「すべてのブックマーク」等で取得済みの場合、`bookmark_collection_ids` を和集合でマージし、`created_at` や `sort_index` は既存値を保持する。これにより、フォルダ閲覧→全ブックマーク閲覧（またはその逆）の順序に関係なくデータが正しく統合される。

### 変更ファイル

| ファイル | 変更概要 |
|---|---|
| `src/modules/bookmarks/api.ts` | `BookmarkFolderTimelineResponse` 型の追加、URL パターンマッチの拡張、`bookmark_collection_id` の抽出と `extAddTweets` への引き渡し |
| `src/types/index.ts` | `Capture` 型に `bookmark_collection_ids?: string[]` を追加 |
| `src/core/database/manager.ts` | `extAddTweets` に `bookmarkCollectionId` 引数を追加、既存キャプチャとのマージロジック実装 |

---

## 2. DB 分離

### 背景

prinsss版と同じ IndexedDB 名 (`twitter-web-exporter`) を使っているため、このフォークにバグがあった場合に prinsss版で蓄積したデータを壊すリスクがあった。

### 変更内容

DB 名に `-custom` サフィックスを付与し、`twitter-web-exporter-custom` として完全に分離した。

- `dedicatedDbForAccounts` 有効時: `twitter-web-exporter-custom_{userId}`
- `package.json` の `name` はユーザースクリプトのメタデータ生成に使われるため変更していない。

### 変更ファイル

- `src/core/database/manager.ts`

```diff
- const DB_NAME = packageJson.name;
+ const DB_NAME = `${packageJson.name}-custom`;
```

---

## 3. Import DB 機能

### 背景

DB を分離したことで、prinsss版で蓄積したデータをこのフォークに引き継ぐ手段が必要になった。prinsss版の「Export DB」で書き出した `.json` ファイルをインポートできるようにする。

### 変更内容

Settings パネルの既存ボタン (Analyze / Export / Clear) の下に「Import DB」ボタンを追加。

1. ボタンをクリックするとファイル選択ダイアログが開く (`.json` のみ)
2. 確認ダイアログで承認後、`db.import()` (`dexie-export-import` の `importInto`) を実行
3. 成功時はアラート通知後にページをリロード（DB 接続のリフレッシュ）
4. 失敗時はエラーメッセージを表示

### 変更ファイル

| ファイル | 変更概要 |
|---|---|
| `src/core/settings.tsx` | `IconDatabaseImport`・`useRef` の追加、隠し file input と Import DB ボタンの実装 |
| `src/i18n/locales/*/common.json` | 全5言語 (en, ja, zh-Hans, zh-Hant, id) に翻訳キーを追加 |

---

## prinsss版からのデータ移行手順

1. **prinsss版**の Settings → **Export DB** で `.json` ファイルをダウンロード
2. 本フォーク版のユーザースクリプトをインストール
3. Settings → **Import DB** をクリックし、エクスポートした `.json` ファイルを選択
4. インポート完了後、ページが自動リロードされる
5. キャプチャ済みデータが正しく表示されることを確認
