export class WorkflowError extends Error {
  constructor(
    message: string,
    public readonly phase?: string,
  ) {
    super(message);
    this.name = "WorkflowError";
  }
}
