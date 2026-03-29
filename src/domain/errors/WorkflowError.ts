export class WorkflowError extends Error {
  constructor(
    message: string,
    public readonly phase?: string,
    public readonly isTimeout: boolean = false,
  ) {
    super(message);
    this.name = "WorkflowError";
  }
}
