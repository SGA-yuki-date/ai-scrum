import type { PullRequest } from "../../domain/entities/PullRequest.js";

export interface IPullRequestGateway {
  create(params: {
    title: string;
    body: string;
    base: string;
    head: string;
  }): Promise<PullRequest>;
}
