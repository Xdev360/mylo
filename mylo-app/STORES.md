# Mylo on the App Store and Google Play

The native apps are Capacitor 7 shells around the same Mylo the web serves, so
the code and the release are one. Everything needed to build is in this folder;
what is left is the accounts and the signing, which cost money and are yours.

## What is set up
- `capacitor.config.ts`: app id `com.staymylo.app`, name Mylo, loads
  `MYLO_APP_URL` (default `https://app.staymylo.com`). `native-shell/` is the
  page shown with no connection.
- `android/`: the Android Studio project (Gradle), icons and splash generated
  from the new logo (`assets/`).
- `ios/`: the Xcode project, using Swift Package Manager (no Podfile), with
  the same icons and splash.
- Plugins: haptics (the handoff asks for them on tick, level up and chest
  open), status bar, splash screen.
- `store/app-icon-1024.png`: the store listing icon.

## Before the first submission
1. **Host the app** at `app.staymylo.com` (or set `MYLO_APP_URL`) and run
   `npx cap sync`.
2. **Apple** (Apple Developer Program, $99 a year): open `ios/App/App.xcodeproj`
   in Xcode, pick your team under Signing, set the version, then Product >
   Archive > Distribute. Apple reviews apps that only show a website strictly
   (guideline 4.2): the native features (push notifications, haptics, widgets
   from WG1/WG2) are what make the case; push needs an APNs key.
3. **Google** (Play Console, $25 once): open `android/` in Android Studio,
   Build > Generate Signed App Bundle, create and keep the upload key safe,
   upload the `.aab` to an internal test track first.
4. **Store listings:** screenshots at 6.7" and 6.5" for iPhone, phone and
   7"/10" for Play; privacy policy URL `https://www.staymylo.com/privacy`;
   age rating (the app is 13+, S1 checks it); data safety answers (email,
   name, photos, messages, all used for the service, none sold).

## Every release after that
Deploy the web app. The store apps pick it up on next open. Only native
changes (plugins, icons, permissions) need a new store build:
`npx cap sync`, then archive in Xcode and Android Studio as above.
