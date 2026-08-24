# Week 7 — Production Performance Budgets

Values below are the **configured** caps already shipping in code — not aspirational limits invented for documentation.

## Queue & workers (mobile)

| Budget | Value | Source |
| ------ | ----- | ------ |
| Queue concurrency (user setting) | 1–4 (default 2) | `DEFAULT_DOWNLOAD_SETTINGS` / `AdmissionScheduler` |
| Fallback max concurrent | 2 | `DOWNLOAD_ENGINE.maxConcurrentDownloads` |
| Max range workers per file | 4 | `DOWNLOAD_ENGINE.maxRangesPerFile` |
| Global network workers | 6 | `DOWNLOAD_ENGINE.maxGlobalNetworkWorkers` |
| Multi-range min size | 8 MiB | `DOWNLOAD_ENGINE.minMultiRangeBytes` |
| Auto-retry maximum | 3 | `MAX_AUTO_RETRY_ATTEMPTS` |
| Retry backoff base / max | 1s / 60s | `retryBackoffBaseMs` / `retryBackoffMaxMs` |

## Progress & notifications (mobile)

| Budget | Value | Source |
| ------ | ----- | ------ |
| UI progress patch interval | 250 ms | `DOWNLOAD_ENGINE.uiProgressIntervalMs` |
| Backend progress PATCH interval | 2500 ms | `DOWNLOAD_ENGINE.backendProgressIntervalMs` |
| FGS notification summary throttle | 750 ms | `FGS_SUMMARY_THROTTLE_MS` |
| Multi-range persist interval | 3000 ms | `DOWNLOAD_ENGINE.multiRangePersistIntervalMs` |

## Realtime

| Budget | Value | Source |
| ------ | ----- | ------ |
| WS progress emit coalesce | 750 ms | `REALTIME_CONSTANTS.progressThrottleMs` |
| WS heartbeat interval / timeout | 30s / 60s | `REALTIME_CONSTANTS` |
| WS backpressure skip threshold | 256 KiB | `REALTIME_CONSTANTS.backpressureBytes` |
| Mobile polling fallback | 4000 ms | `REALTIME_CLIENT.pollingIntervalMs` |
| WS reconnect base / max delay | 1s / 30s | `REALTIME_CLIENT.reconnectBaseMs` / `reconnectMaxMs` |

## Disk safety (mobile)

| Budget | Value | Source |
| ------ | ----- | ------ |
| Min free disk to start | 8 MiB | `minFreeDiskBytes` |
| Disk safety margin | 4 MiB | `diskSafetyMarginBytes` |
| Multi-range extra disk margin | 16 MiB | `multiRangeDiskMarginBytes` |
