export interface IPromptRenderer {
  render(
    templateName: string,
    context: Record<string, unknown>,
  ): Promise<string>;
}
