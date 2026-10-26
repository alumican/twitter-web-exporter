# Fork Changes (twitter-web-exporter-custom)

このドキュメントは、prinsss版の [twitter-web-exporter](https://github.com/prinsss/twitter-web-exporter) に対して本フォークで加えた変更をまとめたものです。

ベースは prinsss版の v1.4.3 です（2026-10-27 に v1.4.0 から追従。経緯は「6. prinsss版 v1.4.3 への追従」）。

---

## 1. ブックマークフォルダ単位の収集とマージ

### 背景

prinsss版ではブックマーク全体 (`/Bookmarks`) の取得のみに対応しており、Twitter のブックマークフォルダ (`BookmarkFolderTimeline`) を個別に収集する手段がなかった。フォルダ単位でブックマークを管理しているユーザーにとって、特定フォルダのみをエクスポートしたり、複数フォルダのデータを統合して扱いたいというニーズがあった。

### 変更内容

- **`BookmarkFolderTimeline` API のインターセプト追加** — `/graphql/.+/BookmarkFolderTimeline` へのレスポンスもキャプチャ対象に加え、フォルダ閲覧時にもデータを自動収集できるようにした。
- **`bookmark_collection_ids` フィールドの追加** — `Capture` 型にブックマークフォルダ ID の配列を追加。同じツイートが複数フォルダに属する場合でも、どのフォルダのものかを記録できる。
- **既存キャプチャとのマージ処理** — フォルダ経由で取得したツイートが既に「すべてのブックマーク」等で取得済みの場合、`bookmark_collection_ids` を和集合でマージし、`created_at` や `sort_index` は既存値を保持する。逆に「すべてのブックマーク」経由で取り込むときは、既存キャプチャの `bookmark_collection_ids` を引き継ぐ。これにより、フォルダ閲覧→全ブックマーク閲覧（またはその逆）の順序に関係なくデータが正しく統合される。
  - 2026-10-27 修正: 以前は「すべてのブックマーク」側で既存キャプチャを読まずに上書きしていたため、フォルダ閲覧のあとに全ブックマークを開くとフォルダ ID が消えていた。

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

- **画面は prinsss版の Import DB を使う**（v1.4.1 で本家に入った。2026-10-27 の追従で、本フォーク独自の Import DB ボタンと翻訳キーは外した）。Settings の Local Database の行に Analyze / Export / Import / Clear が並ぶ。読み込み後に旧形式のユーザー情報のマイグレーションが走り、失敗時はアラートが出る。
- **本フォークで残しているのは `importInto` の許容オプション**。本家は `acceptVersionDiff` と `overwriteValues` だけなので、DB 名の違う書き出しを読み込めない。本フォークは次を加えている。
  - `acceptNameDiff` — prinsss版の `twitter-web-exporter` の書き出しを `twitter-web-exporter-custom` に読み込むため（`dedicatedDbForAccounts` の `_{userId}` 付きも同様）
  - `acceptMissingTables`、`acceptChangedPrimaryKey` — 以前のフォークの実装から引き継いだ許容設定
- 書き出しに含まれないテーブルはそのまま残る。`bookmark_folders` の無い古い書き出し（prinsss版、v3 のフォーク版）も読み込める。

### 変更ファイル

| ファイル | 変更概要 |
|---|---|
| `src/core/database/manager.ts` | `import()` は本家の実装に、`acceptNameDiff` などの許容オプションを加えたもの |

---

## 4. テーブルに「Folder IDs」列を追加

### 背景

ブックマークフォルダ単位の収集に対応したが、キャプチャされたツイートがどのフォルダに属しているかをUI上で確認する手段がなかった。

### 変更内容

ツイートテーブルの「ID」列の右隣にフォルダの列を追加。フォルダ経由でキャプチャされたツイートにはフォルダがカンマ区切りで表示され、それ以外は「N/A」と表示される。エクスポート (JSON/CSV/HTML) にも `bookmark_folder_ids` として含まれる。

2026-10-27 から、列の見出しは「Folders」で、フォルダ名が分かっていれば名前を、分からなければ ID を表示する（ID はツールチップ）。詳細は「5. ブックマークフォルダの名前」。

データの流れ:
- `bookmark_collection_ids` は `captures` テーブルに保存されている
- `extGetCapturedTweets` でクエリ時に `captures` から `Tweet` の `twe_private_fields.bookmark_collection_ids` にマージして返す

### 変更ファイル

| ファイル | 変更概要 |
|---|---|
| `src/types/tweet.ts` | `twe_private_fields` に `bookmark_collection_ids?: string[]` を追加 |
| `src/core/database/manager.ts` | `extGetCapturedTweets` でキャプチャのフォルダIDをツイートにマージ |
| `src/components/table/columns-tweet.tsx` | 「Folder IDs」列の定義を追加 |
| `src/i18n/locales/*/exporter.json` | 全5言語に `Folder IDs` の翻訳キーを追加 |

---

## 5. ブックマークフォルダの名前

### 背景

フォルダのタイムライン (`BookmarkFolderTimeline`) の応答にはフォルダ ID しか無く、書き出しても `bookmark_folder_ids` が数字の羅列になる。どのフォルダか分からないと、アーカイブとして読み返せない。

X はフォルダの一覧（ID と名前）を別の GraphQL 操作 `BookmarkFoldersSlice` で取得している。ブックマークのページを開いたときに呼ばれる。

### 設計

- **正本は正規化したテーブル** — Dexie に `bookmark_folders` テーブルを足す（DB を v4 に上げる。新しいテーブルを足すだけなのでデータの変換は無い）。投稿ごとに名前を持たせず、ID→名前の対応を一か所に持つ。フォルダの名前は変えられるので、書き出しの時点で引く。

  | フィールド | 内容 |
  |---|---|
  | `id`（主キー） | フォルダ ID。`bookmark_collection_ids` と同じ値 |
  | `name` | 最後に取り込んだ名前 |
  | `first_seen_at` | 初めて取り込んだ時刻（ms）。名前が変わっても保つ |
  | `updated_at` | 最後に取り込んだ時刻（ms） |
  | `media` | X が返すカバー画像のオブジェクト（あれば、そのまま） |

- **取り込む操作** — BookmarksModule のインターセプタで、次の応答を取り込んで upsert する。
  - `BookmarkFoldersSlice`（フォルダ一覧）: `data.viewer.user_results.result.bookmark_collections_slice.items[]`。各要素は `{ __typename: "BookmarkCollection", id, name, media }`。続きは `slice_info.next_cursor` で、X が続きを取りに行けばその応答も取り込まれる
  - `createBookmarkFolder`: `data.bookmark_collection_create`
  - `EditBookmarkFolder`（名前の変更）: `data.bookmark_collection_update`
  - 応答の形の変化に備え、決まったパスではなく、`bookmark_collection` で始まるキー（`bookmark_collection_timeline` を除く）の下から `id` と `name` を持つオブジェクトを探す。
  - フォルダを削除しても、テーブルからは消さない（過去のブックマークの名前を引けるように残す）。
- **Export DB / Import DB** — Export DB の書き出しに `bookmark_folders` が含まれるので、ID→名前の対応も一緒に残る。Import DB で戻る。テーブルの無い古い書き出しも読み込める。
- **投稿の書き出し (JSON/CSV/HTML)** — 互換のため `bookmark_folder_ids` はそのまま残し、そのすぐ後ろに `bookmark_folders` を足す。名前が未取得のフォルダは `name: null`。CSV と HTML では他のオブジェクトのフィールドと同じく JSON 文字列になる。

  ```json
  {
    "id": "1234567890123456789",
    "bookmark_folder_ids": ["1111"],
    "bookmark_folders": [{ "id": "1111", "name": "Design" }]
  }
  ```

  ```csv
  id,bookmark_folder_ids,bookmark_folders
  "1234567890123456789","[""1111""]","[{""id"":""1111"",""name"":""Design""}]"
  ```

- **画面** — 表のフォルダ列は名前を表示し、ID はツールチップに出す。名前が分からなければ ID を表示する。検索欄では名前でも ID でも絞り込める。フォルダ名は表の読み込み時に引くので、あとから一覧を開いても表示が更新される。Settings の Analyze DB の件数に `bookmark_folders` が出る。Clear DB で消える。

### 名前を取り込む手順

1. x.com のブックマーク (`/i/bookmarks`) を開き、フォルダの一覧が表示されるところまで進む（ここで `BookmarkFoldersSlice` が呼ばれる）
2. フォルダを開いてスクロールし、投稿を取り込む（従来どおり）
3. Bookmarks モジュールの表でフォルダ名が出ていることを確かめて書き出す

### 変更ファイル

| ファイル | 変更概要 |
|---|---|
| `src/types/index.ts` | `BookmarkFolder`、`BookmarkFolderRef` 型の追加 |
| `src/types/tweet.ts` | `twe_private_fields` に `bookmark_folders?: BookmarkFolderRef[]` を追加 |
| `src/modules/bookmarks/api.ts` | フォルダ一覧・作成・名前変更の URL パターン、`extractBookmarkFolders()` の追加 |
| `src/core/database/manager.ts` | DB v4 と `bookmark_folders` テーブル、`upsertBookmarkFolders()`・`getBookmarkFolders()`・`getBookmarkFolderNames()`、`extGetCapturedTweets` での名前の解決、`count()`・`clear()` への追加 |
| `src/components/table/columns-tweet.tsx` | フォルダ列の表示を名前に、`exportExtra` で `bookmark_folders` を書き出す |
| `src/components/table/base.tsx` | 列のメタ情報に `exportExtra`（表に出さずに書き出す追加のフィールド）を追加 |
| `src/components/modals/export-data.tsx` | `exportExtra` のフィールドと見出しを書き出しに含める |
| `src/i18n/locales/*/exporter.json` | 全5言語に `Folders` の翻訳キーを追加 |

---

## 6. prinsss版 v1.4.3 への追従

### 背景

フォークの元は prinsss版の v1.4.0（2026-02）。その後 X の API の変更でユーザー情報の読み取りが壊れ、本家は v1.4.1〜v1.4.3 で対応した。本フォークのままでは投稿者の情報が欠けるおそれがあった。

### 変更内容

2026-10-27 に `upstream/main`（v1.4.3、17 コミット）をマージした。衝突の解消は次のとおり。

| ファイル | 解消 |
|---|---|
| `package.json` | 本家のバージョンにフォークの接尾辞を付けて `1.4.3-custom`。author と URL はフォークのまま |
| `src/core/database/manager.ts` | `import()` は本家の実装（読み込み後のマイグレーション、エラーの再送出）に寄せ、フォークの `acceptNameDiff` などを残す。DB 名、フォルダの取り込み、`bookmark_collection_ids` のマージはフォークのまま |
| `src/core/settings.tsx` | 自動マージで Import DB ボタンが二重になったため、本家の実装だけを残す |
| `src/i18n/locales/*/common.json` | 本家の文言に揃え、フォーク独自の Import 関連のキーを外す |

本家の API 変更への対応（ユーザー情報の抽出、プロフィール画面、UserAboutModule など）はそのまま取り込んでいる。

---

## prinsss版からのデータ移行手順

1. **prinsss版**の Settings → **Export DB** で `.json` ファイルをダウンロード
2. 本フォーク版のユーザースクリプトをインストール
3. Settings → **Import DB** をクリックし、エクスポートした `.json` ファイルを選択
4. インポート完了後、ページが自動リロードされる
5. キャプチャ済みデータが正しく表示されることを確認
