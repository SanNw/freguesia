import type { Logger } from "../../config/logger.js";
import { pinterestEnv as env } from "../../config/runtime.js";
import { AppError } from "../../shared/errors.js";

export interface PinterestPinInput {
  boardId: string;
  title: string;
  description: string;
  link: string;
  altText: string;
  imageUrl: string;
}

export class PinterestGateway {
  constructor(private readonly logger: Logger) {}

  async createPin(input: PinterestPinInput): Promise<{ id: string; url: string }> {
    const response = await fetch(`${env.PINTEREST_API_BASE_URL.replace(/\/$/, "")}/pins`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.PINTEREST_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        board_id: input.boardId,
        title: input.title,
        description: input.description,
        link: input.link,
        alt_text: input.altText,
        media_source: { source_type: "image_url", url: input.imageUrl },
      }),
      signal: AbortSignal.timeout(env.PINTEREST_REQUEST_TIMEOUT_MS),
    });
    const body = (await response.json().catch(() => ({}))) as {
      id?: string;
      code?: number;
      message?: string;
    };
    if (!response.ok || !body.id) {
      this.logger.warn(
        { status: response.status, code: body.code },
        "Pinterest rejected pin publication",
      );
      throw new AppError(
        "PUBLICATION_FAILED",
        body.message || `Pinterest returned HTTP ${response.status}`,
        response.status === 429 || response.status >= 500,
        response.status === 429 ? 429 : 502,
      );
    }
    return { id: body.id, url: `https://www.pinterest.com/pin/${body.id}/` };
  }
}
