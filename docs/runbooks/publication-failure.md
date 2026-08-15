# Runbook — Publication Failure

## Symptoms

- Telegram API returns error for `sendPhoto` or `sendMessage`
- Publication status remains `publishing` or transitions to `failed`
- Alert sent to `ALERT_TELEGRAM_CHAT_ID`

## Investigation

1. Check `publications.error_code` and `publications.error_detail`
2. Verify `TELEGRAM_PUBLIC_CHANNEL_ID` is correct
3. Verify bot is admin in the channel with post permissions
4. Check if image URL is accessible by Telegram servers

## Common Issues

### Image download failure
- Fallback to `sendMessage` with preview if `IMAGE_FALLBACK_TO_TELEGRAM_PREVIEW=true`
- If preview also fails, publish text-only

### Caption too long
- Telegram limit: 1024 chars for photo caption
- Check `TELEGRAM_MAX_CAPTION_LENGTH` setting
- Worker truncates automatically

### Channel permission error
- Verify bot is admin in the public channel
- Verify bot has "Post Messages" permission
- Verify bot has "Edit Messages" permission if editing after publish

## Prevention

- Always test in private channel first
- idempotency_key prevents duplicate publications on retry
