/** Errors that carry a calm, user-facing message. Technical detail stays server-side. */
export class AppError extends Error {
  constructor(
    public status: number,
    public code: string,
    public userMessage: string,
    public detail?: string,
  ) {
    super(detail ?? userMessage);
  }
}

export const notFound = (what = "That item") =>
  new AppError(404, "not_found", `${what} couldn't be found.`);
export const forbidden = () =>
  new AppError(403, "forbidden", "You don't have permission to do that.");
export const unauthorized = () => new AppError(401, "unauthorized", "Please sign in to continue.");
export const badRequest = (msg: string) => new AppError(400, "bad_request", msg);
export const conflict = (msg: string) => new AppError(409, "conflict", msg);
