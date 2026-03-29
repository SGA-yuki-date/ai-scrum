# Plan: タスク実装ワークフロー基本設計・実装計画

Task Issue を入力として「Issue 解析→設計＆実装→レビュー→PR 作成」の4フェーズを実行するワークフロー。**TypeScript (Node.js) による Clean Architecture** でフロー制御・Git/GitHub 操作を決定論的に管理し、AI (Copilot) はプロンプトファイル経由で各フェーズに限定して呼び出す。設計ドキュメントは PR 本文に集約する。

---

## Clean Architecture 概要

```
┌─────────────────────────────────────────────────────────────────┐
│                        main.ts (Composition Root)                │
│                     DI コンテナで全レイヤーを結線                  │
└────────────────────────────┬──────────────────────────────────────┘
                             │
┌────────────────────────────▼──────────────────────────────────────┐
│  Adapter Layer (Interface Adapters)                               │
│  ┌──────────────────────┐  ┌──────────────────────────────────┐  │
│  │ CLI Entry Point      │  │ WorkflowConfig                   │  │
│  │ (commander)          │  │ (cosmiconfig / env)               │  │
│  └──────────┬───────────┘  └──────────────────────────────────┘  │
└─────────────┼────────────────────────────────────────────────────┘
              │
┌─────────────▼────────────────────────────────────────────────────┐
│  Application Layer (Use Cases)                                    │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ TaskWorkflowOrchestrator                                   │  │
│  │   Phase 1 → Phase 2 → Phase 3 → Phase 4                    │  │
│  └────┬──────────────┬──────────────┬──────────────┬─────────┘  │
│  ┌────▼────┐  ┌──────▼───────┐  ┌───▼────┐  ┌─────▼──────┐    │
│  │Parse    │  │Design &      │  │Review  │  │Create      │    │
│  │Issue    │  │Implement     │  │        │  │PR          │    │
│  │UseCase  │  │UseCase       │  │UseCase │  │UseCase     │    │
│  └─────────┘  └──────────────┘  └────────┘  └────────────┘    │
│                                                                   │
│  Ports (interfaces)                                               │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐             │
│  │IIssueGateway │ │IGitGateway   │ │IAIService    │ ...         │
│  └──────────────┘ └──────────────┘ └──────────────┘             │
└───────────────────────────────────────────────────────────────────┘
              │ Dependency Rule: 内側は外側を知らない
┌─────────────▼────────────────────────────────────────────────────┐
│  Domain Layer (Entities & Value Objects)                          │
│  TaskIssue, DesignAndImplementation, PullRequest, ReviewResult    │
└──────────────────────────────────────────────────────────────────┘
              ▲ Ports を実装
┌─────────────┴────────────────────────────────────────────────────┐
│  Infrastructure Layer (Frameworks & Drivers)                      │
│  ┌────────────────┐ ┌────────────────┐ ┌────────────────┐       │
│  │GhCliIssue      │ │GitCliGateway   │ │CliAIService    │       │
│  │Gateway         │ │(execa + git)   │ │(execa + gh     │       │
│  │(execa + gh)    │ │                │ │ copilot CLI)   │       │
│  └────────────────┘ └────────────────┘ └────────────────┘       │
│  ┌────────────────┐ ┌────────────────┐                           │
│  │GhCliPR         │ │Handlebars      │                           │
│  │Gateway         │ │PromptRenderer  │                           │
│  │(execa + gh)    │ │                │                           │
│  └────────────────┘ └────────────────┘                           │
└──────────────────────────────────────────────────────────────────┘
```

**コア設計方針:**
1. **決定論的フロー制御** — `TaskWorkflowOrchestrator` が各フェーズの開始・終了・遷移を厳密に管理
2. **依存性逆転 (DIP)** — Use Case 層が Port (interface) を定義し、Infrastructure 層が実装を提供。テスト時はモック差し替えが容易
3. **AI 呼び出しの自動化** — `IAIService` を通じて Coding Agent（ファイルシステム操作可能な AI）を呼び出し、ユーザー入力なしで全フェーズを一気通貫で実行。AI がワーキングディレクトリ内のファイルを直接作成・編集する方式（Coding Agent 方式）。実装は差し替え可能
4. **フェーズ間バリデーション** — 各 Use Case が成果物を検証してから次フェーズへ遷移（戻り値の型で保証）
5. **PR 集約型ドキュメント** — 設計・実装サマリー・レビュー結果をすべて PR 本文に記載。レビュー済みのクリーンな状態で PR を作成

---

## ファイル構成

```
ai-scrum/
├── .github/
│   ├── ISSUE_TEMPLATE/
│   │   └── task-issue.yml                  # Task Issue テンプレート
│   └── PULL_REQUEST_TEMPLATE/
│       └── task.md                         # PR テンプレート（人間・スクリプト共用）
│
├── src/
│   ├── domain/                             # === Domain Layer ===
│   │   ├── entities/
│   │   │   ├── TaskIssue.ts                # Issue エンティティ
│   │   │   ├── DesignAndImplementation.ts   # 設計＆実装結果 エンティティ
│   │   │   ├── PullRequest.ts              # PR エンティティ
│   │   │   └── ReviewResult.ts             # レビュー結果 エンティティ
│   │   ├── value-objects/
│   │   │   ├── IssueNumber.ts              # Issue 番号 (バリデーション付き)
│   │   │   ├── BranchName.ts               # ブランチ名 (命名規則付き)
│   │   │   └── CommitMessage.ts            # コミットメッセージ (Conventional Commits)
│   │   └── errors/
│   │       └── WorkflowError.ts            # ドメイン固有エラー
│   │
│   ├── application/                        # === Application Layer ===
│   │   ├── ports/                          # ← Port (interface) 定義
│   │   │   ├── IIssueGateway.ts            # Issue 取得・更新
│   │   │   ├── IGitGateway.ts              # Git 操作
│   │   │   ├── IPullRequestGateway.ts      # PR 作成
│   │   │   ├── IAIService.ts               # AI 呼び出し
│   │   │   ├── IPromptRenderer.ts          # テンプレート展開
│   │   │   └── ILogger.ts                  # ログ出力
│   │   ├── usecases/
│   │   │   ├── ParseIssueUseCase.ts            # Phase 1: Issue 解析
│   │   │   ├── DesignAndImplementUseCase.ts    # Phase 2: 設計＆実装
│   │   │   ├── ReviewUseCase.ts                # Phase 3: レビュー
│   │   │   └── CreatePullRequestUseCase.ts     # Phase 4: PR 作成
│   │   └── TaskWorkflowOrchestrator.ts     # Use Case 統合・フェーズ遷移
│   │
│   ├── infrastructure/                     # === Infrastructure Layer ===
│   │   ├── github/
│   │   │   ├── GhCliIssueGateway.ts        # gh issue view / edit
│   │   │   └── GhCliPullRequestGateway.ts  # gh pr create
│   │   ├── git/
│   │   │   └── GitCliGateway.ts            # git branch / commit / push
│   │   ├── ai/
│   │   │   └── CliAIService.ts             # gh copilot CLI 等
│   │   ├── prompt/
│   │   │   └── HandlebarsPromptRenderer.ts # Handlebars テンプレート展開
│   │   └── logger/
│   │       └── ConsoleLogger.ts            # コンソール出力
│   │
│   ├── adapter/                            # === Adapter Layer ===
│   │   ├── cli/
│   │   │   └── TaskWorkflowCommand.ts      # CLI エントリポイント (commander)
│   │   └── config/
│   │       └── WorkflowConfig.ts           # 設定読み込み (cosmiconfig / env)
│   │
│   └── main.ts                             # Composition Root (DI 結線)
│
├── prompts/                                # AI プロンプトテンプレート
│   ├── design-and-implement.prompt.hbs
│   └── review.prompt.hbs
│
├── tests/
│   ├── unit/
│   │   ├── domain/                         # エンティティ・ValueObject テスト
│   │   ├── application/                    # UseCase テスト (Port モック)
│   │   └── infrastructure/                 # Gateway テスト
│   └── integration/
│       └── workflow.test.ts                # E2E ワークフローテスト
│
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── docs/
    └── workflow-usage.md                   # 利用ガイド
```

---

## Domain Layer

### Entities

```typescript
// TaskIssue — Issue から取得した構造化データ
interface TaskIssue {
  number: IssueNumber;
  title: string;
  description: string;        // タスク概要
  requirements: string[];     // 要件
  acceptanceCriteria: string[]; // 受け入れ条件
  technicalContext?: string;  // 技術コンテキスト
  parentStory?: IssueNumber;
  labels: string[];
}

// DesignAndImplementation — 設計＆実装の統合成果物
interface DesignAndImplementation {
  // 設計部分
  approach: string;           // 実装アプローチ
  targetFiles: FileChange[];  // 変更対象ファイル
  testStrategy: string;       // テスト方針
  designMarkdown: string;     // PR 埋め込み用の設計テキスト
  // 実装部分
  branch: BranchName;
  changedFiles: string[];
  diffStat: string;
  testResults: TestResults;
  commitHash: string;
}

// PullRequest — PR 情報
interface PullRequest {
  number: number;
  url: string;
  title: string;
  branch: BranchName;
}

// ReviewResult — レビュー結果
interface ReviewResult {
  approved: boolean;
  findings: ReviewFinding[];
  fixesApplied: string[];
  summary: string;
}
```

### Value Objects

```typescript
// IssueNumber — 正の整数のみ許可
class IssueNumber {
  private constructor(readonly value: number) {}
  static create(n: number): IssueNumber { /* validation */ }
}

// BranchName — task/<issue-number>-<slug> 形式を保証
class BranchName {
  private constructor(readonly value: string) {}
  static fromIssue(issue: TaskIssue): BranchName { /* 命名規則適用 */ }
}

// CommitMessage — Conventional Commits 準拠
class CommitMessage {
  private constructor(readonly value: string) {}
  static forTask(issue: TaskIssue, summary: string): CommitMessage { /* 規約適用 */ }
}
```

---

## Application Layer

### Ports (Interfaces)

```typescript
// IIssueGateway — Issue の取得・ラベル更新
interface IIssueGateway {
  fetchIssue(number: IssueNumber): Promise<RawIssueData>;
  updateLabels(number: IssueNumber, add: string[], remove: string[]): Promise<void>;
}

// IGitGateway — Git 操作
interface IGitGateway {
  createBranch(name: BranchName): Promise<void>;
  hasChanges(): Promise<boolean>;
  diffStat(): Promise<string>;
  diffAgainstBase(baseBranch: string): Promise<string>; // レビュー用の全差分取得
  commitAll(message: CommitMessage): Promise<string>; // returns commit hash
  push(branch: BranchName): Promise<void>;
}

// IPullRequestGateway — PR 操作
interface IPullRequestGateway {
  create(params: { title: string; body: string; base: string; head: string; }): Promise<PullRequest>;
}

// IAIService — Coding Agent 呼び出し（AI がファイルを直接操作）
interface IAIService {
  /**
   * AI Coding Agent を呼び出す。
   * AI はワーキングディレクトリ内のファイルを直接作成・編集できる。
   * @param promptContent - AI への指示（設計、実装、レビュー等）
   * @param workingDir - AI が操作するワーキングディレクトリ
   * @returns AI のテキスト応答（設計文書、レビュー結果等）
   *          ファイル変更は副作用としてワーキングディレクトリに直接反映される
   */
  invoke(promptContent: string, workingDir: string): Promise<string>;
}

// IPromptRenderer — テンプレート → プロンプト生成
interface IPromptRenderer {
  render(templateName: string, context: Record<string, unknown>): Promise<string>;
}

// ILogger — 構造化ログ
interface ILogger {
  step(phase: string, message: string): void;
  info(message: string): void;
  error(message: string, error?: Error): void;
}
```

### Use Cases

```typescript
// Phase 1: ParseIssueUseCase
class ParseIssueUseCase {
  constructor(
    private issueGateway: IIssueGateway,
    private logger: ILogger,
  ) {}
  async execute(issueNumber: IssueNumber): Promise<TaskIssue> {
    // 1. gh で Issue 取得
    // 2. body をセクション単位でパース
    // 3. 必須フィールドバリデーション
    // 4. ラベルを ai-scrum:issue:status:in-progress に更新
    // 5. TaskIssue エンティティを返却
  }
}

// Phase 2: DesignAndImplementUseCase（設計＋実装を一体実行）
class DesignAndImplementUseCase {
  constructor(
    private gitGateway: IGitGateway,
    private aiService: IAIService,
    private promptRenderer: IPromptRenderer,
    private logger: ILogger,
  ) {}
  async execute(issue: TaskIssue, repoStructure: string): Promise<DesignAndImplementation> {
    // --- 準備 ---
    // 1. design-and-implement.prompt.hbs にコンテキスト埋め込み
    //    （Issue 内容 + リポジトリ構造 → 設計＆実装を一括指示）
    // 2. フィーチャーブランチ作成
    //
    // --- AI Coding Agent 実行 ---
    // 3. AI 呼び出し（AI がファイルを直接作成・編集し、設計テキストをレスポンスとして返す）
    //
    // --- 検証 ---
    // 4. AI レスポンスから設計セクションをパース (approach, targetFiles, testStrategy)
    // 5. 変更検出 (git diff --stat) — AI がファイルを変更したことを確認
    // 6. テスト/リンター実行 (config で定義)
    // 7. コミット・プッシュ
    // 8. DesignAndImplementation エンティティを返却
  }
}

// Phase 3: ReviewUseCase（PR 作成前に内部レビューを実施）
class ReviewUseCase {
  constructor(
    private gitGateway: IGitGateway,
    private aiService: IAIService,
    private promptRenderer: IPromptRenderer,
    private logger: ILogger,
  ) {}
  async execute(issue: TaskIssue, result: DesignAndImplementation): Promise<ReviewResult> {
    // 1. git diff でローカル差分取得（ベースブランチとの比較）
    // 2. AI Coding Agent にレビュー依頼（設計内容 + diff + 受け入れ条件）
    // 3. 問題あれば AI がファイルを直接修正 → スクリプトがコミット・プッシュ
    // 4. ReviewResult エンティティを返却（PR 本文に埋め込み用）
  }
}

// Phase 4: CreatePullRequestUseCase（レビュー済みコードで PR を作成）
class CreatePullRequestUseCase {
  constructor(
    private prGateway: IPullRequestGateway,
    private issueGateway: IIssueGateway,
    private promptRenderer: IPromptRenderer,
    private logger: ILogger,
  ) {}
  async execute(issue: TaskIssue, result: DesignAndImplementation, review: ReviewResult): Promise<PullRequest> {
    // 1. PR 本文テンプレート展開（設計 + 変更サマリー + テスト結果 + レビュー結果）
    // 2. gh pr create
    // 3. ラベルを ai-scrum:issue:status:in-review に更新
  }
}
```

### Orchestrator

```typescript
// TaskWorkflowOrchestrator — 全 Phase を決定論的に順次実行
class TaskWorkflowOrchestrator {
  constructor(
    private parseIssue: ParseIssueUseCase,
    private designAndImplement: DesignAndImplementUseCase,
    private review: ReviewUseCase,
    private createPR: CreatePullRequestUseCase,
    private logger: ILogger,
  ) {}

  async execute(issueNumber: IssueNumber): Promise<void> {
    this.logger.step("1/4", "Issue 解析");
    const issue = await this.parseIssue.execute(issueNumber);

    this.logger.step("2/4", "設計＆実装");
    const repoStructure = await this.getRepoStructure(); // tree コマンド等
    const result = await this.designAndImplement.execute(issue, repoStructure);

    this.logger.step("3/4", "レビュー");
    const review = await this.review.execute(issue, result);

    this.logger.step("4/4", "PR 作成");
    await this.createPR.execute(issue, result, review);
  }
}
```

---

## Infrastructure Layer

### CliAIService (IAIService 実装 — Coding Agent 方式)

```typescript
class CliAIService implements IAIService {
  constructor(
    private command: string,  // デフォルト: "gh copilot" (Coding Agent CLI)
    private timeout: number,  // デフォルト: 600_000ms (AI がファイル操作を行うため長め)
  ) {}

  async invoke(promptContent: string, workingDir: string): Promise<string> {
    // 1. execa で Coding Agent CLI を実行
    //    - cwd: workingDir（AI がファイルを操作するディレクトリ）
    //    - stdin: プロンプトを渡す
    // 2. AI がワーキングディレクトリ内のファイルを直接作成・編集
    // 3. タイムアウト制御
    // 4. 終了コード検証
    // 5. stdout（AI のテキスト応答: 設計文書、レビュー結果等）を返却
    // ユーザー入力は一切不要（全自動）
  }
}
```

> **Coding Agent 方式のポイント:**
> - AI は `workingDir` 内のファイルを直接作成・編集する（副作用）
> - スクリプトは AI 実行後に `git diff` で変更を検証し、コミット・プッシュを行う
> - `IAIService` の実装差し替えにより、Copilot Coding Agent / Claude Code / aider 等任意の Coding Agent に対応可能

### GhCliIssueGateway (IIssueGateway 実装)

```typescript
class GhCliIssueGateway implements IIssueGateway {
  async fetchIssue(number: IssueNumber): Promise<RawIssueData> {
    // execa: gh issue view <number> --json title,body,labels,assignees
  }
  async updateLabels(number: IssueNumber, add: string[], remove: string[]): Promise<void> {
    // execa: gh issue edit <number> --add-label ... --remove-label ...
  }
}
```

### GitCliGateway (IGitGateway 実装)

```typescript
class GitCliGateway implements IGitGateway {
  async createBranch(name: BranchName): Promise<void> {
    // execa: git switch -c <name>
  }
  async hasChanges(): Promise<boolean> {
    // execa: git diff --quiet (exit code で判定)
  }
  async diffStat(): Promise<string> {
    // execa: git diff --stat
  }
  async diffAgainstBase(baseBranch: string): Promise<string> {
    // execa: git diff <baseBranch>...HEAD
  }
  async commitAll(message: CommitMessage): Promise<string> {
    // execa: git add -A && git commit -m <message>
    // returns: commit hash
  }
  async push(branch: BranchName): Promise<void> {
    // execa: git push origin <branch>
  }
}
```

---

## Adapter Layer

### CLI Entry Point

```typescript
// commander ベースの CLI
// 使用例: npx ai-scrum task 23
program
  .command("task <issueNumber>")
  .description("Task Issue を受け取り、設計＆実装→レビュー→PR作成を実行")
  .option("--ai-command <cmd>", "AI Coding Agent 呼び出しコマンド", "gh copilot")
  .option("--ai-timeout <ms>", "AI タイムアウト (ms)", "600000")
  .option("--base-branch <branch>", "ベースブランチ", "main")
  .option("--dry-run", "実際の GitHub/Git 操作を行わない")
  .action(async (issueNumber, options) => {
    // WorkflowConfig を構築
    // main.ts の Composition Root で DI 結線
    // TaskWorkflowOrchestrator.execute() を実行
  });
```

### WorkflowConfig

```typescript
interface WorkflowConfig {
  aiCommand: string;          // AI Coding Agent 呼び出しコマンド (default: "gh copilot")
  aiTimeout: number;          // タイムアウト ms (default: 600000)
  baseBranch: string;         // ベースブランチ (default: "main")
  branchPrefix: string;       // ブランチ接頭辞 (default: "task/")
  labels: {
    inProgress: string;       // default: "ai-scrum:issue:status:in-progress"
    inReview: string;         // default: "ai-scrum:issue:status:in-review"
  };
  testCommand?: string;       // テスト実行コマンド (任意)
  lintCommand?: string;       // リンター実行コマンド (任意)
  dryRun: boolean;            // default: false
}
```

---

## Composition Root (main.ts)

```typescript
// DI 手動結線 (軽量。DI コンテナライブラリは使わない)
export function createWorkflow(config: WorkflowConfig): TaskWorkflowOrchestrator {
  const logger = new ConsoleLogger();
  const issueGateway = new GhCliIssueGateway();
  const gitGateway = new GitCliGateway();
  const prGateway = new GhCliPullRequestGateway();
  const aiService = new CliAIService(config.aiCommand, config.aiTimeout);
  const promptRenderer = new HandlebarsPromptRenderer("./prompts");

  return new TaskWorkflowOrchestrator(
    new ParseIssueUseCase(issueGateway, logger),
    new DesignAndImplementUseCase(gitGateway, aiService, promptRenderer, logger),
    new ReviewUseCase(gitGateway, aiService, promptRenderer, logger),
    new CreatePullRequestUseCase(prGateway, issueGateway, promptRenderer, logger),
    logger,
  );
}
```

---

## 各フェーズ詳細

### Phase 1: Issue 解析 — `ParseIssueUseCase`
- `IIssueGateway.fetchIssue()` で Issue データ取得
- body をセクション単位でパース（概要・要件・受け入れ条件・技術コンテキスト）
- 必須フィールドのバリデーション（欠落時は `WorkflowError` を throw）
- `TaskIssue` エンティティとして返却
- Issue ラベルを `ai-scrum:issue:status:in-progress` に更新

### Phase 2: 設計＆実装 — `DesignAndImplementUseCase`
設計と実装を1つの AI セッションで連続実行し、コンテキスト切れによる品質低下を防ぐ。

1. `IPromptRenderer.render("design-and-implement", ...)` で Issue 内容 + リポジトリ構造をプロンプトに埋め込み
   - プロンプトは「まず設計を出力し、続けて実装を行う」ことを指示
2. `IGitGateway.createBranch()` でフィーチャーブランチ作成
3. `IAIService.invoke()` で AI を自動呼び出し（設計→実装を一括実行）
4. AI レスポンスから設計セクションをパース（approach, targetFiles, testStrategy）
5. `IGitGateway.hasChanges()` + `diffStat()` で変更確認
6. config の `testCommand` / `lintCommand` があれば実行・検証
7. `IGitGateway.commitAll()` + `push()` でコミット・プッシュ
8. `DesignAndImplementation` エンティティとして返却

### Phase 3: レビュー — `ReviewUseCase`
PR 作成前に内部レビューを実施し、クリーンな状態で PR を出す。

1. `IGitGateway.diffAgainstBase()` でベースブランチとの差分を取得
2. `IAIService.invoke()` でレビュー依頼（設計整合性・コード品質・テストカバレッジ・セキュリティ・性能 + 受け入れ条件充足確認）
3. 問題あれば AI が修正 → `IGitGateway.commitAll()` + `push()`
4. `ReviewResult` を返却（PR 本文に埋め込むためのサマリー付き）

### Phase 4: PR 作成 — `CreatePullRequestUseCase`
レビュー済みのコードで PR を作成し、設計・変更・レビュー結果をそろえた完成度の高い PR を提出する。

1. `IPromptRenderer.render("pr-body", ...)` で `.github/PULL_REQUEST_TEMPLATE/task.md` を読み込み、プレースホルダー（HTML コメント）を実際の値で置換
2. `IPullRequestGateway.create()` で PR 作成（`Closes #<issue-number>` 自動付与）
3. `IIssueGateway.updateLabels()` で `ai-scrum:issue:status:in-review` に更新

---

## 実装ステップ

### Phase A: プロジェクト基盤
| Step | 内容 | 依存 |
|------|------|------|
| 1 | `package.json` / `tsconfig.json` / `vitest.config.ts` — プロジェクト初期化。依存: `commander`, `execa`, `handlebars`, `vitest` | なし |
| 2 | `.github/ISSUE_TEMPLATE/task-issue.yml` — Task Issue テンプレート | なし |
| 2b | `.github/PULL_REQUEST_TEMPLATE/task.md` — PR テンプレート（人間・スクリプト共用） | なし |

### Phase B: Domain Layer
| Step | 内容 | 依存 |
|------|------|------|
| 3 | `domain/entities/` — TaskIssue, DesignAndImplementation, PullRequest, ReviewResult | なし |
| 4 | `domain/value-objects/` — IssueNumber, BranchName, CommitMessage | なし |
| 5 | `domain/errors/WorkflowError.ts` — ドメインエラー | なし |
| 6 | Domain 層の単体テスト | Steps 3-5 |

### Phase C: Application Layer (Ports + Use Cases)
| Step | 内容 | 依存 |
|------|------|------|
| 7 | `application/ports/` — 全 Port interface 定義 | Steps 3-5 |
| 8 | `application/usecases/ParseIssueUseCase.ts` | Step 7 |
| 9 | `application/usecases/DesignAndImplementUseCase.ts` | Step 7 |
| 10 | `application/usecases/ReviewUseCase.ts` | Step 7 |
| 11 | `application/usecases/CreatePullRequestUseCase.ts` | Step 7 |
| 12 | `application/TaskWorkflowOrchestrator.ts` | Steps 8-11 |
| 13 | Use Case 層の単体テスト（Port をモック） | Steps 8-12 |

### Phase D: Infrastructure Layer
| Step | 内容 | 依存 |
|------|------|------|
| 14 | `infrastructure/github/GhCliIssueGateway.ts` — `gh issue` ラッパー | Step 7 |
| 15 | `infrastructure/github/GhCliPullRequestGateway.ts` — `gh pr create` ラッパー | Step 7 |
| 16 | `infrastructure/git/GitCliGateway.ts` — `git` ラッパー | Step 7 |
| 17 | `infrastructure/ai/CliAIService.ts` — Coding Agent CLI 呼び出し（全自動、AI がファイル直接操作） | Step 7 |
| 18 | `infrastructure/prompt/HandlebarsPromptRenderer.ts` | Step 7 |
| 19 | `infrastructure/logger/ConsoleLogger.ts` | Step 7 |
| 20 | Infrastructure 層のテスト | Steps 14-19 |

### Phase E: Adapter Layer + Composition Root
| Step | 内容 | 依存 |
|------|------|------|
| 21 | `adapter/config/WorkflowConfig.ts` — 設定読み込み | なし |
| 22 | `adapter/cli/TaskWorkflowCommand.ts` — CLI エントリポイント | Step 21 |
| 23 | `main.ts` — DI 結線 | Steps 12, 14-19, 21-22 |

### Phase F: プロンプト・テンプレート
| Step | 内容 | 依存 |
|------|------|------|
| 24 | `prompts/design-and-implement.prompt.hbs` — 設計＆実装プロンプト | なし |
| 25 | `prompts/review.prompt.hbs` — レビュープロンプト | なし |

### Phase G: 統合テスト・ドキュメント
| Step | 内容 | 依存 |
|------|------|------|
| 27 | E2E テスト — テスト用 Issue で全フェーズ実行 | Step 23 |
| 28 | `docs/workflow-usage.md` — 利用ガイド | Step 23 |

---

## Task Issue テンプレート設計

```yaml
name: "🔧 Task Issue"
description: "タスク実装用 Issue"
labels: ["task", "ai-scrum:issue:status:ready"]
body:
  - type: textarea
    id: description
    attributes:
      label: タスク概要
      description: このタスクで実現すること
    validations:
      required: true
  - type: textarea
    id: requirements
    attributes:
      label: 要件
      description: 具体的な要件を箇条書きで記載
    validations:
      required: true
  - type: textarea
    id: acceptance-criteria
    attributes:
      label: 受け入れ条件
      description: 完了判定の基準
    validations:
      required: true
  - type: textarea
    id: technical-context
    attributes:
      label: 技術コンテキスト
      description: 関連するアーキテクチャ、既存コード、制約事項
    validations:
      required: false
  - type: input
    id: parent-story
    attributes:
      label: 親ストーリー Issue 番号
      description: "例: #23"
    validations:
      required: false
```

---

## PR テンプレート設計

配置: `.github/PULL_REQUEST_TEMPLATE/task.md`

GitHub 標準の PR テンプレートとして配置する。人間が PR を作成する場合はプレースホルダーを手動で埋める。スクリプトから実行する場合は `CreatePullRequestUseCase` がプレースホルダーを値で置換して `gh pr create --body` に渡す。

```markdown
## 概要

Closes #<!-- Issue 番号 -->

<!-- タスクの概要を記載 -->

## 詳細設計

<!-- 実装アプローチ、変更対象ファイル、テスト方針を記載 -->

## 変更内容

<!-- 変更ファイル一覧と変更概要を記載 -->

## テスト結果

<!-- テスト実行結果を記載 -->

## レビュー結果

<!-- レビュー実施結果を記載 -->
```

---

## 前提条件

| ツール | 用途 |
|--------|------|
| Node.js 20+ | ランタイム |
| `gh` CLI | GitHub 操作（認証済み） |
| `git` | バージョン管理 |
| Coding Agent CLI | AI フェーズ実行（Copilot Coding Agent / Claude Code / aider 等） |

---

## 検証方法

1. **Domain 層 単体テスト** — Value Object のバリデーション、エンティティ生成ロジック
2. **Use Case 層 単体テスト** — Port をモックし、各 Use Case のビジネスロジックを検証。`TaskWorkflowOrchestrator` がフェーズを正しい順序で呼び出すことを確認
3. **Infrastructure 層 テスト** — `execa` をモックし、gh/git コマンドが正しい引数で呼ばれることを検証
4. **E2E テスト** — テスト用リポジトリで `npx ai-scrum task <number>` を実行し、Issue 解析→PR 作成→セルフレビューの一連の流れを確認
5. **異常系テスト** — 必須フィールド欠落 Issue で `WorkflowError`、AI 成果物未生成でタイムアウト、`gh` 未認証で適切なエラーメッセージ

---

## 設計判断

- **TypeScript + Clean Architecture**: 型安全なインターフェース定義で依存性逆転を実現。テスト時に Port をモック差し替えでき、各レイヤーを独立してテスト可能
- **DI コンテナ不使用**: `main.ts` での手動結線で十分。ライブラリ依存を最小化
- **execa**: 子プロセス起動を型安全に行い、gh/git CLI との連携を簡潔に実装
- **Handlebars**: テンプレートエンジンとして軽量で十分な機能。Mustache 互換で学習コスト低
- **AI Coding Agent 方式**: AI がファイルを直接作成・編集する方式を採用。ユーザーは `npx ai-scrum task <number>` を実行するだけで全フェーズが自動完了する。`IAIService` の実装差し替えで Copilot / Claude Code / aider 等任意の Agent に対応
- **AI 呼び出し自動化**: `IAIService` インターフェースにより実装差し替え可能。ユーザー入力を一切挟まず全フェーズを自動実行。ワークフロー 2（ディスパッチャー）統合時のバッチ実行にもそのまま対応
- **PR 集約型ドキュメント**: コードと設計の紐付きが明確、レビュー時の参照が容易
- **スコープ外**: ワークフロー 2 との連携、エラーリカバリ（途中再開）

---

## Further Considerations

1. **エラーリカバリ** — Orchestrator に状態永続化を追加し `--resume` で途中フェーズから再開。初期は見送り、E2E テスト後に検討を推奨
2. **動的コンテキスト注入** — 詳細設計プロンプトにリポジトリ構造 (`tree` コマンド等) を自動付与するか、Issue の技術コンテキスト欄に委ねるか？ → 自動付与を推奨（精度向上に寄与）
3. **npm パッケージ公開** — `npx ai-scrum task <number>` でどこからでも使えるようにパッケージ公開するか？ → プロジェクトの成熟後に検討
4. **Infrastructure 差し替え** — GitHub 以外（GitLab 等）への対応。Port 層で抽象化されているため Gateway 追加のみで拡張可能
