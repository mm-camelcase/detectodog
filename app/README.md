# DetectoDog app

One Expo codebase targets Android, iOS, and the installable web application.

## Configuration

Use Node.js 20 or newer. Copy `.env.example` to `.env` and set `EXPO_PUBLIC_API_URL` to the deployed API Gateway URL before building. The URL is compiled into web and native builds.

## Web/PWA

```bash
npm install
npm run export:web
```

The build is written to `dist/`. The export command also copies the manifest, service worker, and scalable maskable icon. Deployment commands are documented in `infrastructure/terraform/README.md`.

## Android APK

The `preview` EAS profile produces a directly installable APK:

```bash
npx eas login
npm run build:apk
```

When the cloud build finishes, EAS provides an APK download URL. This does not require a Google Play developer account. Android users must permit installation from the browser or file manager used to open the APK.

The generated `android/` project is included for an optional local build. A local release requires Android Studio/SDK with `ANDROID_HOME` configured:

```bash
cd android
./gradlew assembleRelease
```

The APK appears under `android/app/build/outputs/apk/release/`.
