#!/usr/bin/env bash
set -euo pipefail

# ai-scrum が使用する GitHub ラベルをリポジトリに一括登録するスクリプト
# 使い方: 導入先リポジトリのルートで実行
#   bash /path/to/ai-scrum/scripts/setup-labels.sh

LABELS=(
  "ai-scrum:issue:status:ready|0E8A16|実装着手可能"
  "ai-scrum:issue:status:in-progress|FBCA04|実装中"
  "ai-scrum:issue:status:in-review|1D76DB|レビュー中"
)

echo "ai-scrum: ラベルをセットアップします"
echo ""

for entry in "${LABELS[@]}"; do
  IFS='|' read -r name color description <<< "$entry"
  if gh label create "$name" --color "$color" --description "$description" 2>/dev/null; then
    echo "  ✔ 作成: $name"
  else
    echo "  - スキップ: $name（既に存在）"
  fi
done

echo ""
echo "完了しました"
