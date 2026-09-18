# fuel-log 開発規約

満タン法の燃費を記録する個人用PWA。**仕様の正本は [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md)**。本書はその実装規約（設計・契約・デザイン）で、実装者（人・AI）は両方を読んでから着手する。

- 公開URL: `https://akihirokunii.github.io/fuel-log/` / Vite `base: '/fuel-log/'`
- 利用者は開発者本人のみ。iPhone の Chrome からホーム画面に追加して使う
- 外部通信は一切しない（CDN・外部フォント・アナリティクス禁止）。LLMも使わない

## 1. コマンド

```bash
npm run dev      # 開発サーバ（http://localhost:5173/fuel-log/）
npm test         # Vitest（全通過が必須）
npm run build    # tsc -b && vite build（型エラー0が必須）
npm run icons    # PWAアイコン再生成（生成物は public/icons/ にコミット）
```

## 2. 技術スタック（固定。依存を足さない）

React 19 + TypeScript strict + Vite / Dexie + dexie-react-hooks / Recharts / vite-plugin-pwa / Vitest + fake-indexeddb / sharp（アイコン生成のみ）。
バージョンは旧アプリ `~/vibe-coding/personal-dashboard/package.json` と同じ範囲指定を使う（組合せが実証済み）。
ルーターなし（タブは state）。hashルーティング禁止。CSSは素のCSS（CSS-in-JS・Tailwind等を入れない）。

## 3. ディレクトリと所有範囲

```
src/
├── main.tsx
├── app/            # シェル: App.tsx, nav.ts(useAppNav), useToday.ts, TabBar, Toast, ConfirmDialog, Sheet(モーダル), Segmented, styles.css（デザイントークンと共通部品のCSS）
├── core/           # UIを持たない: types, db, repo, dates, fuel, validation, csv, backup, download, settings(localStorage)
└── features/
    ├── record/     # S1 記録: RecordTab, FillupForm（S3の編集でも再利用）, SavedNotice, RecentList, record.css
    ├── chart/      # S2 グラフ: ChartTab(遅延読込), MetricLineChart(燃費・円/L・円/km 共用), StatsRow, ticks, chartSeries, numberFormat, chart.css
    └── list/       # S3 一覧・設定: ListTab, EditSheet, SettingsPanel, list.css
docs/REQUIREMENTS.md   # 要件定義（正本のコピー。§11 に [実装判断] を追記）
docs/samples/          # テスト用フィクスチャ（CSV・バックアップJSON）
scripts/generate-icons.mjs
.github/workflows/deploy.yml
```

- 機能別CSSは各 feature ディレクトリの `*.css` に書き、共通トークン（`src/app/styles.css` の CSS 変数）だけを参照する。色の直書き禁止（グラフの系列色も CSS 変数 or `src/core/theme.ts` の定数から取る）
- **計算・パース・判定は必ず `src/core/` の純粋関数**にし、コンポーネント内に計算式を書かない。純粋関数には Vitest の単体テストを付ける
- 「今日」は必ず引数で渡せるようにする（テスト容易性）。`new Date()` を純粋関数の中で呼ばない

## 4. コア契約（`src/core/`）

### 4.1 型（`types.ts`）

```ts
export type DateStr = string; // 'YYYY-MM-DD'（Asia/Tokyo 固定）

export interface Fillup {
  id?: number;
  date: DateStr;
  tripKm: number;      // トリップメーターの値（前回リセットからの距離）
  liters: number;
  yen: number | null;  // 税込支払額。未入力は null
  partial: boolean;    // 満タンにしなかった
  createdAt: number;   // epoch ms
  updatedAt: number;   // epoch ms
}
export type StoredFillup = Fillup & { id: number };
export type FillupInput = Pick<Fillup, 'date' | 'tripKm' | 'liters' | 'yen' | 'partial'>;

export interface DerivedFillup extends StoredFillup {
  kmPerL: number | null;
  yenPerL: number | null;
  yenPerKm: number | null;
  mergedPartials: number; // この行の計算に合算した直前の部分給油の件数（通常 0）
}

export type RangeKey = '1m' | '6m' | '1y' | 'all';

export interface PeriodStats {
  count: number;        // kmPerL が非 null の行数（平均・最高・最低の母数。画面の「件数」はこれ）
  fillupCount: number;  // 期間内の全行数（部分給油を含む）
  avgKmPerL: number | null; // 単純平均
  maxKmPerL: number | null;
  minKmPerL: number | null;
  totalKm: number;
  totalLiters: number;
  totalYen: number;     // yen が null の行は除く
}

export interface SettingRow { key: string; value: unknown }
```

### 4.2 DB（`db.ts` / `repo.ts`）

Dexie DB 名 `fuel-log`、version 1: `fillups: '++id, date'`, `settings: 'key'`。
`repo.ts`（DBアクセスはここに集約。コンポーネントから `db.fillups.add` 等を直接呼ばない。読み取りの `useLiveQuery(() => db.fillups.toArray())` は可）:

```ts
addFillup(input: FillupInput, now?: number): Promise<number>          // createdAt=updatedAt=now
updateFillup(id: number, input: FillupInput, now?: number): Promise<void> // createdAt 維持, updatedAt=now
deleteFillup(id: number): Promise<void>                                // 物理削除
deleteAllFillups(): Promise<void>
appendFillups(inputs: FillupInput[], now?: number): Promise<number>    // CSV取込。入力順に id を振る。戻り値=件数
restoreBackup(backup: BackupFile): Promise<void>                       // 1トランザクションで全テーブル clear → bulkAdd（id 維持）
```

### 4.3 日付（`dates.ts`）

```ts
todayJst(now?: Date): DateStr                 // Intl で Asia/Tokyo の今日
isValidDateStr(s: string): boolean            // 形式と実在性（2026-02-30 は false）
addDays(date: DateStr, days: number): DateStr // UTC 演算で DST の影響を受けない
rangeStart(range: RangeKey, today: DateStr): DateStr | null // 1m=-30日, 6m=-182日, 1y=-365日, all=null
dateToMs(date: DateStr): number               // UTC 00:00 の epoch ms（グラフの時間軸用）
```

### 4.4 燃費計算（`fuel.ts`）— 要件 §4

```ts
sortFillups<T extends StoredFillup>(rows: readonly T[]): T[]   // date 昇順 → id 昇順。非破壊
deriveFillups(rows: readonly StoredFillup[]): DerivedFillup[]  // 入力順不問。戻り値は昇順
filterByRange(derived: readonly DerivedFillup[], range: RangeKey, today: DateStr): DerivedFillup[]
periodStats(rowsInPeriod: readonly DerivedFillup[]): PeriodStats
previousKmPerL(derived: readonly DerivedFillup[], id: number): number | null
previewKmPerL(existing: readonly StoredFillup[], candidate: FillupInput, editingId?: number): number | null
diffKmPerL(current: number, previous: number): { diff: number; dir: 'up' | 'down' | 'same' }
```

規則:

1. `partial=true` の行: `kmPerL = null`, `yenPerKm = null`。`yenPerL = yen / liters`（その給油の単価として有効なので行単体で出す）
2. `partial=false` の行: 直前に連続する `partial=true` の行（0件以上）を「連鎖」とし、
   `kmPerL = (自分の tripKm + 連鎖の tripKm 合計) / (自分の liters + 連鎖の liters 合計)`、`mergedPartials = 連鎖の件数`
3. `yenPerKm`: 連鎖と同じ合算で `(yen 合計) / (tripKm 合計)`。自分または連鎖のどれかの `yen` が null なら null。連鎖が無ければ `yen / tripKm`
4. データ先頭が部分給油で始まる場合も同じ規則（次の満タン行に合算）
5. **派生計算は必ず全データに対して行い、その後で期間フィルタをかける**（期間の外にある部分給油も、期間内の満タン行に合算されなければならない）
6. `filterByRange`: `rangeStart <= date` の行（開始日を含む）。`all` は全件
7. `periodStats`: 平均・最高・最低・`count` は `kmPerL` 非 null の行のみ。合計3種は期間内の全行（部分給油含む）
8. `previousKmPerL`: 昇順で `id` の行より前にあり、`kmPerL` が非 null の最も近い行の値
9. `previewKmPerL`: 既存データに候補行を仮に加えて（`editingId` があればその行を置き換えて）派生計算し、候補行の `kmPerL` を返す。新規の候補は同日の既存行より後ろに並ぶ
10. `diffKmPerL`: **表示値どうしの差**（`round1(current) - round1(previous)` を小数1桁に丸める）。画面の数字と矛盾させないため
11. 内部値は丸めない。丸めは表示と CSV だけ（`format.ts`: km/L=小数1桁、円/L=小数1桁、円/km=小数2桁、km は小数1桁まで・L は小数2桁までで末尾0を省く、円は3桁区切り）

### 4.5 入力検証（`validation.ts`）— 要件 S1

```ts
export interface FillupFormValues { date: string; tripKm: string; liters: string; yen: string; partial: boolean }
export type FillupFormErrors = Partial<Record<'date' | 'tripKm' | 'liters' | 'yen', string>>;
validateFillupForm(v: FillupFormValues, today: DateStr):
  | { ok: true; value: FillupInput } | { ok: false; errors: FillupFormErrors }
```

- 前処理: NFKC 正規化（全角数字→半角）、前後空白除去、桁区切りカンマ除去
- 日付: 必須・実在・今日以前 / 走行距離: 必須・1〜2,000・小数1桁まで / 給油量: 必須・0.5〜120・小数2桁まで / 金額: 任意（空→null）・0〜50,000 の整数
- 文言（固定）: `〇〇を入力してください` / `数値で入力してください` / `1〜2,000 km の範囲で入力してください` / `0.5〜120 L の範囲で入力してください` / `0〜50,000 円の整数で入力してください` / `小数第1位までで入力してください` / `小数第2位までで入力してください` / `日付は今日以前にしてください` / `日付が正しくありません（YYYY-MM-DD の実在する日付）`
- 同じ検証を CSV 取込の各行にも使う

### 4.6 CSV（`csv.ts`）— 要件 S3

```ts
export const CSV_HEADER = 'date,tripKm,liters,yen,partial,kmPerL';
toCsv(derived: readonly DerivedFillup[]): string
parseCsv(text: string, today: DateStr): { ok: true; rows: FillupInput[] } | { ok: false; errors: string[] }
```

- 書き出し: 昇順、改行 `\n`、末尾改行あり、BOM なし。`yen` null は空欄、`partial` は `true`/`false`、`kmPerL` は小数1桁（null は空欄）。`tripKm`・`liters` は丸めず数値そのまま
- 取込: 先頭 BOM・CRLF・空行を許容。1行目はヘッダ必須（`date,tripKm,liters,yen,partial` の5列が必須。`kmPerL` 列は有っても無くてもよく、値は無視）。`partial` は `true/false/1/0/空`（空は false）
- **全行が妥当なときだけ `ok: true`**。1行でも不正なら何も取り込まない（`errors` は `3行目: 走行距離…` の形式。表示は先頭5件まで）
- ファイル名: `fuel-log-YYYY-MM-DD.csv`

### 4.7 バックアップ（`backup.ts`）— 全体方針 §2

```ts
export interface BackupFile {
  app: 'fuel-log'; schemaVersion: 1; exportedAt: string; // ISO 8601
  tables: { fillups: StoredFillup[]; settings: SettingRow[] };
}
buildBackup(fillups: readonly StoredFillup[], settings: readonly SettingRow[], now?: Date): BackupFile
parseBackup(text: string): { ok: true; backup: BackupFile } | { ok: false; error: string }
```

- `parseBackup` は `app`・`schemaVersion`・各行の型と値域を検証する（壊れたファイルで DB を消さない）。復元は置換（`repo.restoreBackup`）
- ファイル名: `fuel-log-backup-YYYY-MM-DD.json`

### 4.8 ファイル保存（`download.ts`）

`saveTextFile(filename, text, mime): Promise<'saved' | 'shared' | 'cancelled' | 'unconfirmed'>`（`'unconfirmed'` = iOS で共有シートを使えず `<a download>` を試みた。保存できたか確かめられないので、呼び出し側は成功と言い切らない）
iOS（ホーム画面PWA）では `<a download>` が不安定なため、iOS かつ `navigator.canShare({files})` が真なら Web Share API（「ファイルに保存」）を使い、それ以外は Blob + `<a download>`。`revokeObjectURL` は遅延させる。
**クリックハンドラ内で await を挟まずに呼ぶ**（ユーザー操作の有効期限切れを避けるため、書き出すデータは `useLiveQuery` で手元に持っておき、同期的に文字列化する）。

### 4.9 設定（`settings.ts`）

表示範囲は `localStorage` の `fuel-log:range`（既定 `all`）。読めない・不正値のときは既定値。Dexie の `settings` テーブルは将来用で、現時点では何も書かない。

## 5. 画面とUXの規約

対象は iPhone（幅 375〜430px）の片手操作。ガソリンスタンドで立ったまま 10 秒で記録できること。

- **定常操作は5操作以内**: 開く → 走行距離 → 給油量 →（金額）→ 保存。日付は既定で今日
- 入力欄の文字は **16px 以上**（iOS のフォーカス時ズームを防ぐ）。数値欄は 20px 前後・右寄せ・単位（km / L / 円）を欄内右に表示。タップ領域は 44px 以上
- **記録フォームは縦に短く保つ**: 日付はラベルと同じ1行、走行距離と給油量は2列、金額は1行、「詳細」の開閉（左）と算出燃費プレビュー（右）は同じ1行。テンキーを開いたままでも保存ボタンが隠れず、保存後の結果カードがタブバーの裏に回らないこと（幅375×高さ812で保存ボタン下端が約410px）。欄を足したり余白を広げたりする変更は、この条件を実画面で確認してから
- 新規入力で日付を手で変えていない間は、日付が変わったら今日に追従させる（PWAは何日もメモリに残る）。「今日」は `useToday()` から取る
- フォームは `<form onSubmit>` にし、キーボードの確定でも保存できる。`enterKeyHint` を付ける
- 走行距離と給油量が両方入ったら、保存前に**算出燃費のプレビュー**（`previewKmPerL`）を保存ボタンの上に出す（打ち間違いにその場で気づける）
- 保存後: 入力欄をクリア（日付は今日に戻す）し、フォーム直下に結果カード「保存しました: 2026-09-17 / 412.3 km / 28.5 L → **14.5 km/L**（前回 13.9）▲0.6」。▲は良化（緑）、▼は悪化（橙赤）、同値は「±0.0」。部分給油なら「部分給油のため、燃費は次の満タン給油で算出します」
- 結果カードは次の入力を始めた時点で消す。直近3件（日付・km/L）→ タップで編集シートを開く。編集シートは App 直下に1つだけ置き、記録タブ・一覧タブのどちらからも開ける（開いた元のタブに留まる）
- 確認は **自前の `ConfirmDialog`**（`window.confirm` / `alert` は使わない）。結果通知は `Toast`
- 編集・確認はボトムシート型モーダル（背景タップ・Esc で閉じる、フォーカスをシート内に移す、`role="dialog"` `aria-modal`）
- 一覧の1行は2段組: 上段＝日付（左）と km/L（右・強調）、下段＝`412.3 km ・ 28.5 L ・ 4,560円（160.0 円/L）` を muted で。部分給油は「部分」バッジ、km/L は「—」。一覧は30件ずつ段階表示（データ管理は一覧の最下部にあるため、件数が増えても辿り着けるように）
- グラフ: 範囲切替は最上部に1つ（下の全要素に効く）。時間軸は実時間スケール（`type="number"` + `scale="time"`。軸の範囲は 1か月/半年/1年が「開始日〜今日」、全期間が「最古の記録日〜今日」で最短14日幅。端の点が欠けないよう左右に余白を取る）。点は間引かないが、期間内の点数が多いときは半径を小さくする（〜60点: r=4 / 〜150点: r=3 / それ以上: r=2・リングなし）。アニメーション無効。値の無い点（部分給油・金額未入力の行）では実線を切り、その区間を破線でつなぐ（本人決定。同じデータの `connectNulls` 破線を実線の下の層に重ねて描く。該当区間があるときだけ破線の意味を注記）。線 2px・点 r=4 + 面色の 2px リング・グリッドは控えめな実線・**凡例ボックスは出さない**（系列は1本。平均線のラベル「平均 14.2」は破線のキー付きで**プロット領域の外側**（上の余白の右端）に固定する。内側だとデータの点と重なり得る）。X軸の目盛は7本以下に収まる最も細かい刻み（`buildTimeTicks`）。Recharts の `accessibilityLayer` は無効（タップで白いフォーカス枠が出るため。`role="img"` + 要約の `aria-label` で代替）。軸・ラベル・ツールチップの文字は文字色トークン（系列色で文字を塗らない）。ツールチップは値を主役に（`14.5 km/L` を大きく、日付・km・L を小さく）。Y軸は `floor(min-1)`〜`ceil(max+1)`。**2軸グラフ禁止**（円/L と 円/km は切替式の別グラフ）
- 統計行は4つのタイル（平均 / 最高 / 最低 / 件数）＋その下に期間合計（km・L・円）を muted の1行で
- 空状態は文言＋記録タブへ移動するボタン
- アクセシビリティ: ラベルと入力の関連付け、エラーは `aria-describedby` + `aria-invalid`、タブバーは `aria-current`、色だけに頼らない（▲▼や「部分」の文字を併記）

## 6. デザイントークン（`src/app/styles.css` の `:root`）

ダークテーマ固定（`color-scheme: dark`）。旧アプリの「ダークグロー」を青基調で踏襲。

```css
--bg: #0b1120;  --bg-glow: #172038;  --card: #131c31;  --card-hi: #16203a;  --border: #1f2a44;
--text: #e2e8f0;  --text-2: #b6c2d6;  --muted: #8fa0b8;
--accent: #3987e5;  --accent-hi: #5aa2f2;   /* 燃費線・主ボタン */
--cost: #d95926;                            /* 円/L・円/km の線 */
--avg: #8fa0b8;                             /* 平均線（灰の破線） */
--good: #34d399;  --bad: #f4845f;  --danger: #f87171;
--radius: 16px;  --radius-sm: 10px;
```

- 系列色 `#3987e5` / `#d95926` はカード面 `#131c31` に対して検証済み（明度帯・彩度・CVD 分離・3:1 コントラスト）。変更するなら再検証する
- フォントは `system-ui, -apple-system, 'Hiragino Sans', 'Noto Sans JP', sans-serif`。縦に揃える数値（一覧・軸）は `tabular-nums`、大きな単独の数値は既定の字幅
- `.app` は `max-width: 560px` 中央寄せ、下部タブバーは固定・`env(safe-area-inset-bottom)` 対応、本文の上余白は `env(safe-area-inset-top)` 対応（`black-translucent` のステータスバー下に潜らない）、`viewport-fit=cover`
- 重なり順: タブバー 20 < シート 40 < 確認ダイアログ 50 < トースト 60。確認ダイアログはシートの上に開くので、Esc は最前面だけを閉じる

## 7. 進め方

- 要件に無い細部を決めたら、最も単純な実装を選び `docs/REQUIREMENTS.md` §11 に `[実装判断]` として1行追記する
- 要件 §10 のスコープ外（複数車両・給油所名・オドメーター等）は作らない。入力欄は4つ＋「満タンにしなかった」だけ
- commit・pushは本人の明示指示後に行う。実装担当はGPTへ引き継ぎ済み（2026-09-18）
- 自分の担当外のファイルを直したくなったら、直さずに報告に書く

## 8. 現在地（2026-09-17）

- 要件 §8 の実装フェーズは「デプロイ」の手前まで完了。受け入れ条件1〜4は実画面で確認済み（`docs/REQUIREMENTS.md` §11 末尾の検証結果）。`npm test` 全通過・`npm run build` 型エラー0
- 残り: GitHub に空の `fuel-log` リポジトリを作り Pages の Source を「GitHub Actions」にする（本人作業）→ `git remote add origin … && git push -u origin main` → Actions が公開URLへ配置 → 実機 iPhone で受け入れ条件5（ホーム画面追加・機内モード）と、共有シート経由のファイル保存を確認
- 要件定義の正本は個人Vault（`10_人生設計/50_個人開発/`）。§11 の追記は区切りでVaultへ戻す

## GPT引き継ぎ（2026-09-18。現在はこちらを優先）

既存実装と未コミット差分を維持して再開する。公開候補の変更と確認状況は `docs/ACCEPTANCE.md`。
PWAは更新通知方式（`prompt`）。入力途中に自動で再読込しない。保存形式、ダークテーマ、3タブ、依存構成は維持する。
実装・自動検証・実機検証・公開を別々に記録し、実機未確認を完了扱いにしない。
