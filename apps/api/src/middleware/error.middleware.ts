import { Request, Response, NextFunction } from "express";
import { AppError } from "../errors/app-error";
import { randomBytes } from "node:crypto";

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
) {
  const requestId = (req.headers["x-request-id"] as string) || randomBytes(8).toString("hex");

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
      },
      requestId,
    });
  }

  // Handle Multer file size errors
  if (err.name === "MulterError" && (err as any).code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({
      success: false,
      error: {
        code: "FILE_TOO_LARGE",
        message: "Uploaded image exceeds the 2 MB size limit.",
      },
      requestId,
    });
  }

  // Fallback for unexpected errors
  console.error(`[Unhandled Error] [Req: ${requestId}]`, err);

  return res.status(500).json({
    success: false,
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "An unexpected error occurred. Please try again later.",
    },
    requestId,
  });
}
