# ai-scrum

> **ステータス: 構想段階（Concept）**

AI Agent を活用して、GitHub Issue / PR ベースのスクラム開発プロセスを自律的に実行するワークフローフレームワーク。

## 背景と目的

AI Agent の生成するコードの精度が飛躍的に向上した今、詳細設計やコーディングを人が行うのではなく AI に委ねることで、**開発のスピードとコストを大幅に改善**できる時代になりつつあります。

一方で、最終的にシステム運用の結果に責任を持つのは人です。そのため、開発の過程やアーキテクチャ上の意思決定といった重要な情報に、人がスムーズにアクセス・理解できる**トレーサビリティの確保**が不可欠です。

GitHub Issue や PR は、もともとチームメンバーやプロダクトオーナーが開発情報を共有し、トレーサビリティを維持するために使われてきた手法です。ai-scrum はこの仕組みをそのまま活かしながら、AI Agent が自律的にスクラムプロセスを回すワークフローを提供します。

## 主な機能・ワークフロー

ai-scrum は以下の 3 つのワークフローで構成されます。

### 1. ストーリー分解ワークフロー

Story Issue を起点に、アーキテクチャ検討を行い、タスクを分割して Task Issue（Sub-Issue）を作成します。

```
Story Issue → アーキテクチャ検討 → Task Issue（Sub-Issue）作成
```

### 2. タスクディスパッチャー（常駐 AI Agent）

実装着手可能な Task Issue を検知し、自動でワークフロー 3 に引き渡す常駐 AI Agent です。

```
Task Issue（Ready）を監視 → ワークフロー 3 へディスパッチ
```

### 3. タスク実装ワークフロー

Task Issue を受け取り、詳細設計・実装・PR 作成・レビューまでを一貫して行います。

```
Task Issue 受領 → 詳細設計 → 実装 → PR 作成 → レビュー
```

> **実装順序:** ワークフロー 3 → 2 → 1 の順に開発を進める予定です。

## 技術スタック

| 領域 | 技術 |
|---|---|
| 言語 | TypeScript (Node.js 24 LTS) |
| AI Agent | GitHub Copilot |
| バージョン管理・プロジェクト管理 | GitHub (Issue / PR / Sub-Issue) |
| CI/CD | 各導入プロジェクトが独自に用意 |

## なぜ TypeScript + Clean Architecture なのか

### TypeScript を採用する理由

ai-scrum は Git 操作・GitHub API 呼び出し・AI Coding Agent 連携など、多くの外部プロセスを組み合わせて動作します。TypeScript を使うことで以下のメリットがあります。

- **型安全なインターフェース定義** — 各レイヤー間の Port（インターフェース）を型で明示でき、引数や戻り値の不整合をコンパイル時に検出できる
- **IDE サポート** — 補完・リファクタリング・定義ジャンプが効くため、コードベースの見通しが良い
- **Node.js エコシステム** — `node:child_process` などの標準 API で `gh` CLI / `git` コマンドを直接呼び出せる。ランタイム依存ライブラリはゼロ

### Clean Architecture を採用する理由

```
Adapter → Application (Use Cases / Ports) → Domain
                ↑ 実装を提供
          Infrastructure
```

- **依存性逆転 (DIP)** — Use Case 層が Port（interface）を定義し、Infrastructure 層が実装を提供する。テスト時はモックに差し替えるだけで各レイヤーを独立して検証できる
- **Infrastructure の差し替え** — GitHub 以外（GitLab 等）や別の AI Agent（Claude Code / aider 等）に対応する場合、Gateway を追加するだけで拡張可能
- **フロー制御の明確化** — `TaskWorkflowOrchestrator` が 4 フェーズ（Issue 解析→設計＆実装→レビュー→PR 作成）の遷移を決定論的に管理

## セットアップ

### 前提条件

| ツール | バージョン | 用途 |
|--------|-----------|------|
| **Node.js** | 24 LTS 以上 | TypeScript のビルドとスクリプト実行に必要 |
| `gh` CLI | 最新推奨 | GitHub 操作（Issue 取得・PR 作成） |
| `git` | 最新推奨 | バージョン管理 |
| GitHub Copilot CLI | 最新推奨 | AI フェーズ実行 |

> **Note:** 現在、AI Agent は GitHub Copilot のみサポートしています。将来的に他の AI Agent への対応も検討予定です。

> **Node.js が必要な理由:** TypeScript はそのままでは実行できません。TypeScript コンパイラ (`tsc`) で JavaScript に変換し、Node.js ランタイムで実行します。Node.js をインストールすると `npm`（パッケージマネージャ）も一緒にインストールされます。

### インストール

```bash
# 1. リポジトリをクローン
git clone https://github.com/<your-org>/ai-scrum.git
cd ai-scrum

# 2. 依存パッケージをインストール（TypeScript コンパイラ等の開発ツール）
npm install

# 3. TypeScript → JavaScript にビルド
npm run build
```

### 利用可能なスクリプト

| コマンド | 説明 |
|---------|------|
| `npm run build` | TypeScript を JavaScript にコンパイル（`dist/` に出力） |
| `npm start` | ワークフロー CLI を実行 |
| `npm test` | ユニットテストを実行 |
| `npm run test:integration` | 統合テストを実行 |
| `npm run typecheck` | 型チェックのみ実行（JavaScript は出力しない） |

### ワークフローの実行

```bash
# Issue 番号を指定してタスク実装ワークフローを実行
npx ai-scrum task 23

# オプション指定
npx ai-scrum task 23 --base-branch main --ai-timeout 600000
```

詳細は [docs/workflow-usage.md](docs/workflow-usage.md) を参照してください。

## 導入イメージ

このリポジトリはワークフローの**フレームワーク／テンプレート**として機能します。各プロジェクトが本リポジトリを導入し、自身の開発対象に合わせてカスタマイズして利用する想定です。

## 対象ユーザー

- GitHub の Issue / PR ワークフローに慣れた開発者
- AI を活用してスクラム開発を効率化したいチーム

## ライセンス

未定