/** The API's JSON error codes (MASTERSPEC 3.3), plus what can go wrong before a response arrives. */
export type ApiErrorCode = 'address_not_found' | 'outside_toronto' | 'bad_request' | 'timeout' | 'network' | 'server'

const API_CODES: ApiErrorCode[] = ['address_not_found', 'outside_toronto', 'bad_request']

export class ApiError extends Error {
  readonly code: ApiErrorCode
  readonly status: number | null

  constructor(code: ApiErrorCode, status: number | null = null) {
    super(code)
    this.code = code
    this.status = status
  }
}

export function apiCode(body: unknown): ApiErrorCode {
  const code = (body as { error?: unknown } | null)?.error
  return API_CODES.find((c) => c === code) ?? 'server'
}

/** True when the caller cancelled the request; that is never an error to show. */
export function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}
