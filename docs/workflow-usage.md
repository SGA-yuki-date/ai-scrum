# ai-scrum タスク実装ワークフロー 利用ガイド

## 概要

`ai-scrum` は、GitHub Issue を入力として「Issue 解析→設計＆実装→レビュー→PR 作成」の4フェーズを自動実行するワークフローツールです。

## 前提条件

| ツール | バージョン | 用途 |
|--------|-----------|------|
| Node.js | 24+ (LTS) | ランタイム |
| `gh` CLI | 最新 | GitHub 操作（要認証） |
| `git` | 最新 | バージョン管理 |
| GitHub Copilot CLI | 最新 | AI フェーズ実行（要認証） |
| PowerShell Core (`pwsh`) | 7+ | AI エージェントのシェル実行（Windows のみ必須） |

## セットアップ

### 必須ツールのインストール

```bash
# GitHub CLI（Issue / PR 操作に必要）
winget install --id GitHub.cli   # Windows
brew install gh                   # macOS

# GitHub 認証
gh auth login

# PowerShell Core（Windows のみ。gh copilot がシェル実行に pwsh.exe を必要とするため）
winget install Microsoft.PowerShell
# Pathが設定されるはずなのでPC再起動後、PowerSellを起動し `pwsh --version`  →  PowerShell 7.x.x と表示されれば OK 

# GitHub Copilot CLI（AI フェーズに必要）
npm install -g @github/copilot
```

### リポジトリへのラベル登録

導入先リポジトリで以下を実行してください：

```bash
npx ai-scrum setup-labels
```

### ビルド

```bash
npm install
npm run build
npm link
```

### 導入先リポジトリでのセットアップ

```bash
cd /path/to/your-project

# ai-scrum をリンク（ai-scrum 側で npm link 実行済みが前提）
npm link ai-scrum

# ラベルを登録
npx ai-scrum setup-labels
```

## 使い方

```bash
# 基本的な使い方
npx ai-scrum task <issue-number>

# オプション付き
npx ai-scrum task 23 --base-branch develop

# ヘルプ
npx ai-scrum --help
```

## オプション

| オプション | 説明 | デフォルト |
|-----------|------|-----------|
| `--ai-timeout <ms>` | AI タイムアウト (ms) | `1800000` |
| `--base-branch <branch>` | ベースブランチ | `main` |

## 環境変数

| 変数 | 説明 |
|------|------|
| `AI_SCRUM_AI_TIMEOUT` | AI タイムアウト (ms) |
| `AI_SCRUM_BASE_BRANCH` | ベースブランチ |
| `AI_SCRUM_TEST_COMMAND` | テスト実行コマンド |
| `AI_SCRUM_LINT_COMMAND` | リンター実行コマンド |

## ワークフローの流れ

### Phase 1: Issue 解析

Task Issue の内容をパースし、構造化データに変換します。Issue ラベルを `ai-scrum:issue:status:in-progress` に更新します。

### Phase 2: 設計＆実装

AI Coding Agent を呼び出し、設計と実装を一括実行します。フィーチャーブランチを作成し、変更をコミット・プッシュします。

### Phase 3: レビュー

AI にコードレビューを依頼し、問題があれば修正を適用します。

### Phase 4: PR 作成

設計・変更・レビュー結果を含む PR を作成し、Issue ラベルを `ai-scrum:issue:status:in-review` に更新します。

## Task Issue の書き方

[`.github/ISSUE_TEMPLATE/task-issue.yml`](../.github/ISSUE_TEMPLATE/task-issue.yml) テンプレートに従って以下のセクションを記載してください：

- **タスク概要**（必須）
- **要件**（必須）
- **受け入れ条件**（必須）
- **技術コンテキスト**（任意）
- **親ストーリー Issue 番号**（任意）

## アーキテクチャ

Clean Architecture に基づき、4層で構成されています：

- **Domain Layer** — エンティティ・Value Object
- **Application Layer** — Use Case・Port (interface)
- **Infrastructure Layer** — gh/git CLI 実行・テンプレート展開
- **Adapter Layer** — CLI・設定

依存性逆転により、Infrastructure 層はテスト時にモック差し替え可能です。
