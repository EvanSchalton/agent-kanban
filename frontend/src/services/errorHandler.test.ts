import { ApiErrorHandler } from "./errorHandler";
import { AxiosError } from "axios";

describe("ApiErrorHandler", () => {
  describe("handleError", () => {
    it("handles null/undefined errors safely", () => {
      const result = ApiErrorHandler.handleError(null);
      expect(result.message).toBe("An unknown error occurred");
      expect(result.code).toBe("UNKNOWN_ERROR");
    });

    it("handles 422 validation errors with FastAPI format", () => {
      const error = new AxiosError("Validation Error");
      error.response = {
        status: 422,
        data: {
          detail: [
            { loc: ["body", "column"], msg: "field required" },
            { loc: ["body", "position"], msg: "must be positive" },
          ],
        },
        statusText: "Unprocessable Entity",
        headers: {},
        config: {} as any,
      };

      const result = ApiErrorHandler.handleError(error);
      expect(result.status).toBe(422);
      expect(result.code).toBe("VALIDATION_ERROR");
      expect(result.message).toContain("body.column: field required");
      expect(result.message).toContain("body.position: must be positive");
    });

    it("handles 422 errors with string detail", () => {
      const error = new AxiosError("Validation Error");
      error.response = {
        status: 422,
        data: {
          detail: "Column not found",
        },
        statusText: "Unprocessable Entity",
        headers: {},
        config: {} as any,
      };

      const result = ApiErrorHandler.handleError(error);
      expect(result.status).toBe(422);
      expect(result.message).toBe("Column not found");
    });

    it("handles 422 errors with malformed data safely", () => {
      const error = new AxiosError("Validation Error");
      error.response = {
        status: 422,
        data: {
          detail: [
            null,
            undefined,
            "string error",
            { notStandardFormat: true },
            { loc: null, msg: "error message" },
          ],
        },
        statusText: "Unprocessable Entity",
        headers: {},
        config: {} as any,
      };

      const result = ApiErrorHandler.handleError(error);
      expect(result.status).toBe(422);
      expect(result.code).toBe("VALIDATION_ERROR");
      // Should not throw and provide a meaningful message
      expect(result.message).toBeTruthy();
      expect(result.message).toContain("string error");
    });

    it("handles errors without response property", () => {
      const error = new AxiosError("Network Error");
      // No response property set

      const result = ApiErrorHandler.handleError(error);
      expect(result.message).toBe(
        "Unable to connect to server. Check your connection.",
      );
      expect(result.code).toBe("NETWORK_ERROR");
    });

    it("handles generic Error instances", () => {
      const error = new Error("Something went wrong");

      const result = ApiErrorHandler.handleError(error);
      expect(result.message).toBe("Something went wrong");
      expect(result.code).toBe("GENERIC_ERROR");
    });

    it("handles unknown error types", () => {
      const result = ApiErrorHandler.handleError("string error");
      expect(result.message).toBe("An unknown error occurred");
      expect(result.code).toBe("UNKNOWN_ERROR");
    });
  });
});
