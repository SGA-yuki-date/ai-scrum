export interface ILogger {
  step(phase: string, message: string): void;
  info(message: string): void;
  error(message: string, error?: Error): void;
}
