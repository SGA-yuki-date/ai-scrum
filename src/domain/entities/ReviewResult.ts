export interface ReviewFinding {
  severity: "error" | "warning" | "info";
  file?: string;
  line?: number;
  message: string;
}

export interface ReviewResult {
  approved: boolean;
  findings: ReviewFinding[];
  fixesApplied: string[];
  summary: string;
}
