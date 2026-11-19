export interface SendResult {
  endpoint: string
  status: number
}

/** Decide what to do after pushing one reminder to every device of a user. */
export function afterSend(results: SendResult[]): { reminded: boolean; deadEndpoints: string[] } {
  return {
    reminded: results.some((r) => r.status >= 200 && r.status < 300),
    deadEndpoints: results.filter((r) => r.status === 404 || r.status === 410).map((r) => r.endpoint),
  }
}
