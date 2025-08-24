import { AxiosError } from "axios";

export interface ApiError {
  message: string;
  status?: number;
  code?: string;
  details?: unknown;
}

export class ApiErrorHandler {
  static handleError(error: unknown): ApiError {
    // Extra safety check for null/undefined errors
    if (!error) {
      return {
        message: "An unknown error occurred",
        code: "UNKNOWN_ERROR",
      };
    }

    if (error instanceof AxiosError) {
      // Safe access to response properties with optional chaining
      const status = error?.response?.status;
      const data = error?.response?.data;

      // Handle specific HTTP status codes
      switch (status) {
        case 404:
          return {
            message: data?.detail || "Resource not found",
            status: 404,
            code: "NOT_FOUND",
          };

        case 422:
          // Safe handling of 422 validation errors
          let validationMessage: string;
          try {
            validationMessage = this.formatValidationError(data);
          } catch (e) {
            console.error("Error formatting validation error:", e);
            validationMessage =
              data?.detail || data?.message || "Validation error occurred";
          }

          return {
            message: validationMessage,
            status: 422,
            code: "VALIDATION_ERROR",
            details: data,
          };

        case 500:
          return {
            message: "Internal server error. Please try again later.",
            status: 500,
            code: "SERVER_ERROR",
          };

        case undefined:
          // Network error
          return {
            message: "Unable to connect to server. Check your connection.",
            code: "NETWORK_ERROR",
          };

        default:
          return {
            message:
              data?.detail || data?.message || "An unexpected error occurred",
            status,
            code: "API_ERROR",
          };
      }
    }

    // Handle non-Axios errors
    if (error instanceof Error) {
      return {
        message: error.message,
        code: "GENERIC_ERROR",
      };
    }

    return {
      message: "An unknown error occurred",
      code: "UNKNOWN_ERROR",
    };
  }

  private static formatValidationError(data: any): string {
    // Safe handling of validation errors
    if (!data) {
      return "Validation error occurred";
    }

    // Handle array of validation errors (FastAPI format)
    if (Array.isArray(data?.detail)) {
      try {
        const errors = data.detail.map((err: any) => {
          // Safely handle error object structure
          if (typeof err === "string") {
            return err;
          }

          // Handle FastAPI validation error format
          if (err && typeof err === "object") {
            const field = Array.isArray(err.loc) ? err.loc.join(".") : "field";
            const message = err.msg || err.message || "invalid";
            return `${field}: ${message}`;
          }

          return "Unknown validation error";
        });

        return errors.length > 0
          ? `Validation errors: ${errors.join(", ")}`
          : "Validation error occurred";
      } catch (e) {
        // Fallback if any error during formatting
        console.error("Error formatting validation errors:", e);
        return "Validation error occurred";
      }
    }

    // Handle string detail
    if (typeof data?.detail === "string") {
      return data.detail;
    }

    // Handle object with message
    if (data?.message) {
      return data.message;
    }

    // Default fallback
    return "Invalid request data";
  }
}

export const handleApiError = ApiErrorHandler.handleError;
