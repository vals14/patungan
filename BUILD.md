# Building & updating Patungan

How to ship an installable app to friends and push new versions over the air.
`eas.json` (build profiles) and `app.json` (`runtimeVersion`) are already set up.

## 0. One-time setup

```bash
npm install -g eas-cli          # the EAS command-line tool
eas login                       # log in to your (free) Expo account
eas init                        # links this repo to an Expo project (adds extra.eas.projectId to app.json)
eas update:configure            # installs expo-updates + adds updates.url (enables OTA)
```

### Supabase keys (do NOT skip — the built app can't reach Supabase without this)
The app reads `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` from
`.env.local`, which is **not** included in a build. Register them with EAS so builds
and updates get them:

```bash
eas env:create --name EXPO_PUBLIC_SUPABASE_URL --value "https://YOUR-PROJECT.supabase.co" --visibility plaintext --environment preview --environment production
eas env:create --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "YOUR-ANON-KEY" --visibility sensitive --environment preview --environment production
```
(The anon key is safe to ship — it's the public client key, protected by RLS.)

## 1. Build an installable app for friends

### Android (easy, free)
```bash
eas build --platform android --profile preview
```
EAS builds in the cloud (~10–20 min) and gives you a **link/QR**. Friends open it,
download the **APK**, accept "install from unknown source", done. No Play Store.

### iOS (needs a paid Apple Developer account, $99/yr)
```bash
eas device:create        # register each tester's device (their UDID)
eas build --platform ios --profile preview
```
Or use **TestFlight** (nicer for more testers) via the `production` profile +
`eas submit`. Without a paid Apple account there's no way to sideload on iOS.

## 2. Push a new version (over the air, no reinstall)

For **JS / UI / feature** changes (most of what we build), publish an OTA update —
testers just reopen the app:
```bash
eas update --channel preview --message "what changed"
```
Builds made with the `preview` profile pull from the `preview` channel, so everyone
on that build gets it.

**When you need a NEW build instead of an update:** you added or upgraded a *native*
module (e.g. a new `expo-*` package with native code), or changed `app.json` native
config (icons, permissions, plugins). Bump `version` in `app.json` and rebuild — the
`runtimeVersion` policy (`appVersion`) makes sure old builds don't pull incompatible
updates.

## 3. Versioning

- `version` in `app.json` is the human version ("1.0.0" → "1.1.0" …). Bump it when you
  make a new native build.
- Build numbers (Android `versionCode` / iOS `buildNumber`) are managed by EAS
  automatically (`appVersionSource: "remote"`, `autoIncrement` on production).

## Gotchas

1. **Google sign-in on device** — native uses the `patungan://` scheme. Add that
   redirect in **Supabase → Auth → URL Configuration** (redirect URLs) and in the
   Google Cloud console, or Google login fails on the phone. Email/password works
   without this.
2. **Migrations** — the app depends on your Supabase database. Testers hit the same
   Supabase project you've been using, so make sure all migrations in
   `supabase/migrations/` are applied before sharing the build.
