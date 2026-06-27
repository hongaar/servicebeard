import { ApiError } from "./api";

export interface RouteErrorDetails {
  title: string;
  hint: string;
  status?: number;
  technical: string;
}

export function describeRouteError(error: unknown): RouteErrorDetails {
  if (error instanceof ApiError) {
    if (error.status >= 500) {
      return {
        title: "Server error",
        hint: "Something went wrong on our end while loading this page. Try again in a moment, or return to the dashboard.",
        status: error.status,
        technical: error.message,
      };
    }
    if (error.status === 404) {
      return {
        title: "Not found",
        hint: "The page or resource you requested doesn't exist or may have been removed.",
        status: error.status,
        technical: error.message,
      };
    }
    if (error.status === 403) {
      return {
        title: "Access denied",
        hint: "You don't have permission to view this page.",
        status: error.status,
        technical: error.message,
      };
    }
    if (error.status === 401) {
      return {
        title: "Sign in required",
        hint: "Your session may have expired. Sign in again and retry.",
        status: error.status,
        technical: error.message,
      };
    }
    return {
      title: "Request failed",
      hint: "We couldn't complete this request. Check the details below or try again.",
      status: error.status,
      technical: error.message,
    };
  }

  if (error instanceof Error) {
    return {
      title: "Something went wrong",
      hint: "We couldn't load this page. Try again, or head back to the dashboard.",
      technical: error.message,
    };
  }

  return {
    title: "Something went wrong",
    hint: "An unexpected error occurred. Try again, or head back to the dashboard.",
    technical: String(error),
  };
}

export function shouldReportRouteError(error: unknown) {
  if (error instanceof ApiError && error.status < 500) return false;
  return true;
}
