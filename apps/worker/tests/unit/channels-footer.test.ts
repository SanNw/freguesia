import { describe, expect, it } from "vitest";
import {
  appendChannelsFooter,
  CHANNELS_FOOTER,
} from "../../src/domain/channels-footer.js";

describe("channels footer", () => {
  it("adds the clickable channels message to a caption", () => {
    expect(appendChannelsFooter("Oferta")).toBe(`Oferta\n\n${CHANNELS_FOOTER}`);
    expect(CHANNELS_FOOTER).toContain(
      '<a href="https://t.me/addlist/hrnEPhgLIMoxNjVh">canais de promoção</a>',
    );
  });

  it("does not duplicate the footer", () => {
    const caption = appendChannelsFooter("Oferta");
    expect(appendChannelsFooter(caption)).toBe(caption);
  });
});
