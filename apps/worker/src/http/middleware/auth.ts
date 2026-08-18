import type {
  FastifyReply,
  FastifyRequest,
  DoneFuncWithErrOrRes,
} from "fastify";
import { env } from "../../config/env.js";
import { AppError } from "../../shared/errors.js";

export function serviceTokenAuth(
  request: FastifyRequest,
  _reply: FastifyReply,
  done: DoneFuncWithErrOrRes,
) {
  if (request.url === "/health" || request.url === "/ready") {
    done();
    return;
  }

  if (request.url.startsWith("/v1/integrations/mercadolivre/oauth/callback")) {
    done();
    return;
  }

  const auth = request.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) {
    done(
      new AppError(
        "UNAUTHORIZED",
        "Missing or invalid Authorization header",
        false,
        401,
      ),
    );
    return;
  }

  const token = Buffer.from(auth.slice(7));
  const expected = Buffer.from(env.WORKER_SERVICE_TOKEN);
  if (token.length !== expected.length || !timingSafeEqual(token, expected)) {
    done(new AppError("UNAUTHORIZED", "Invalid service token", false, 401));
    return;
  }

  done();
}
import { timingSafeEqual } from "node:crypto";
