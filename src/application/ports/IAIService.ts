export interface IAIService {
  /**
   * AI Coding Agent を呼び出す。
   * AI はワーキングディレクトリ内のファイルを直接作成・編集できる。
   * @param promptContent - AI への指示
   * @param workingDir - AI が操作するワーキングディレクトリ
   * @returns AI のテキスト応答
   */
  invoke(promptContent: string, workingDir: string): Promise<string>;
}
