# Week 7 — Known Production Limitations

Honest constraints for the VidoraX Android downloader after Day 4 Phase 3 freeze.
Unsupported behavior is **not** claimed as supported.

## Platform

| Limitation | Detail |
| ---------- | ------ |
| Android-first background | Foreground Service (FGS) protects transfers on Android development/release builds. |
| iOS background | iOS uses a no-op FGS controller. Transfers may pause when backgrounded; do not claim production background downloads on iOS. |
| Expo Go | Optional local notifications and native FGS require a development/release build — not Expo Go on Android. |

## Transfer engines

| Limitation | Detail |
| ---------- | ------ |
| DRM / encrypted HLS | Encrypted streams (AES-128, SAMPLE-AES) and DRM are rejected. |
| Live HLS | Live / event playlists are unsupported and rejected. |
| Multi-range | Progressive only, Android-capable path when Range + size eligibility pass. HLS never uses multi-range. |
| Multi-range fallback | No Range / HTTP 200 on probe / unknown size / small file / HLS → graceful single-path transfer (not a user-visible failure). |
| Source server limits | Hosts that break Range, change ETags mid-transfer, or throttle heavily may force restart/retry per existing policy. |

## Files & sharing

| Limitation | Detail |
| ---------- | ------ |
| Android Open via `file://` | Open uses `Linking.openURL` on the managed file URI. Some Android OEMs require a content `FileProvider` URI; failure surfaces a safe error — Share is the reliable handoff. |
| No FileProvider yet | Private-path content sharing is not wired through Android FileProvider. Documented for a follow-up; not expanded in this freeze. |
| Finalize | Completion verifies size when authoritative; do not assume cross-process atomic rename on every OEM filesystem. |

## Realtime

| Limitation | Detail |
| ---------- | ------ |
| Transport only | WebSocket patches UI; durable REST remains source of truth. |
| Query-token WS auth | Disabled when `NODE_ENV=production` unless `WS_ALLOW_QUERY_TOKEN=1`. Mobile uses `Sec-WebSocket-Protocol`. |
| Polling fallback | ~4s refresh while focused and WS down; not a substitute for durable API. |

## Product scope (frozen)

- No iOS production background downloader in Week 7.
- No new HLS formats (DASH/CMAF placeholders remain architecture-only).
- No new acceleration algorithms beyond existing multi-range.
- Engine architecture is feature-frozen; future changes require regression certification.
