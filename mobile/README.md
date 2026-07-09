# VidoraX Mobile

React Native mobile client for VidoraX, built with Expo SDK 57 and Expo Router.

## Tech Stack

- React Native 0.86
- Expo SDK 57
- TypeScript
- Expo Router (file-based routing)

## Prerequisites

- Node.js 20 LTS (or later)
- npm 10+
- Android Studio (for Android emulator and builds)
- [Expo Go](https://expo.dev/go) (optional, for quick device testing)

## Getting Started

```bash
# From the mobile directory
npm install
npx expo start
```

### Run on Android

```bash
npm run android
```

Press `a` in the Expo CLI terminal to open on an Android emulator.

## Project Structure

```
mobile/
├── app/              # Expo Router screens and layouts
├── assets/           # Images, fonts, and static files
├── components/       # Shared React components
├── constants/        # App-wide constants
├── hooks/            # Custom React hooks
├── scripts/          # Utility scripts
├── app.json          # Expo configuration
└── tsconfig.json     # TypeScript configuration
```

## Scripts

| Command            | Description                    |
| ------------------ | ------------------------------ |
| `npm start`        | Start Expo development server  |
| `npm run android`  | Start and open on Android      |
| `npm run ios`      | Start and open on iOS          |
| `npm run web`      | Start web development server   |
| `npm run lint`     | Run ESLint                     |

## Environment

Environment-specific configuration will be added as the project evolves. Use Expo's built-in support for `app.config.ts` and environment variables when needed.

## Related

- [Root README](../README.md)
- [Backend README](../backend/README.md)
- [Documentation](../docs/)
