export interface RichButton {
  text: string;
  style?: "danger" | "success" | "primary" | "link";
  url?: string;
  callbackData?: string;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export function buildRichButtonRows(rows: RichButton[][]): string {
  return rows
    .map(
      (row) =>
        `<tg-button-row>${row
          .map((button) => {
            const type = button.url ? "url" : "callback_data";
            const action = button.url
              ? `url="${escapeHtml(button.url)}"`
              : `data="${escapeHtml(button.callbackData ?? "")}"`;
            const style = button.style ? ` style="${button.style}"` : "";
            return `<tg-button type="${type}"${style} ${action}>${escapeHtml(button.text)}</tg-button>`;
          })
          .join("")}</tg-button-row>`,
    )
    .join("\n");
}
