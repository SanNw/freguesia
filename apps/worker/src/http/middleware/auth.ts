import type { FastifyReply, FastifyRequest, DoneFuncWithErrOrRes } from "fastify";
import { env } from "../../config/env.js";
import { AppError } from "../../shared/errors.js";

export function serviceTokenAuth(
  request: FastifyRequest,
  reply: FastifyReply,
  done: DoneFuncWithErrOrRes,
) {
  if (request.url === "/health" || request.url === "/ready") {
    done();
    return;
  }

  const auth = request.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) {
    done(new AppError("UNAUTHORIZED", "Missing or invalid Authorization header", false, 401));
    return;
  }

  const token = auth.slice(7);
  if (token !== env.WORKER_SERVICE_TOKEN) {
    done(new AppError("UNAUTHORIZED", "Invalid service token", false, 401));
    return;
  }

  done();
}
