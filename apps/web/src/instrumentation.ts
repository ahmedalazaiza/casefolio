import type { Instrumentation } from "next";
import { captureServerException } from "@/lib/monitoring/sentry";

export async function register() {
  // Server instrumentation registered for Casefolio production monitoring.
}

export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  await captureServerException(err, {
    route: context.routePath || request.path,
    method: request.method,
    routeType: context.routeType,
    tags: {
      router_kind: context.routerKind,
    },
  });
};
