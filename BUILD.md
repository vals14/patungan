# Building & updating Patungan

How to ship an installable app to friends and push new versions over the air.
`eas.json` (build profiles) and `app.json` (`runtimeVersion`) are already set up.

## Where do I run these commands?

In a **terminal on your own computer**, opened **inside this project folder**
(`...\Claude Works\patungan`). Not in Supabase, not in the browser.

**Open a terminal in the folder (Windows 11):**
1. Open File Explorer and go to the `patungan` folder.
2. Click the address bar, type `powershell`, press Enter — a terminal opens
   already pointed at this folder. (Or right-click empty space → "Open in Terminal".)

You'll also need a free Expo account first → sign up at https://expo.dev.

> Note: run every EAS command with `npx eas-cli@latest ...` — no global install
> needed (that's what was failing). The first time, npx asks to install it: press `y`.

## 0. One-time setup

```bash
npx eas-cli@latest login             # log in to your Expo account
npx eas-cli@latest init              # links this repo to an Expo project (adds extra.eas.projectId to app.json)
npx eas-cli@latest update:configure  # installs expo-updates + adds updates.url (enables OTA)
```

### Supabase keys (do NOT skip — the built app can't reach Supabase without this)
The app reads `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` from
`.env.local`, which is **not** included in a build. Register them with EAS:

```bash
npx eas-cli@latest env:create --name EXPO_PUBLIC_SUPABASE_URL --value "https://YOUR-PROJECT.supabase.co" --visibility plaintext --environment preview --environment production
npx eas-cli@latest env:create --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "YOUR-ANON-KEY" --visibility sensitive --environment preview --environment production
```
(The anon key is safe to ship — it's the public client key, protected by RLS.)

## 1. Build an installable app for friends

### Android (easy, free)
```bash
npx eas-cli@latest build --platform android --profile preview
```
EAS builds in the cloud (~10–20 min) and gives you a **link/QR**. Friends open it,
download the **APK**, accept "install from unknown source", done. No Play Store.

### iOS (needs a paid Apple Developer account, $99/yr)
```bash
npx eas-cli@latest device:create   # register each tester's device (their UDID)
npx eas-cli@latest build --platform ios --profile preview
```
Or use **TestFlight** (nicer for more testers) via the `production` profile +
`npx eas-cli@latest submit`. Without a paid Apple account there's no way to
sideload on iOS.

## 2. Push a new version (over the air, no reinstall)

For **JS / UI / feature** changes (most of what we build), publish an OTA update —
testers just reopen the app:
```bash
npx eas-cli@latest update --channel preview --environment preview --message "what changed"
```
- `--channel preview` = which builds receive it; **must match the build's channel**
  (your `preview` APK), or the update reaches nobody.
- `--environment preview` = which EAS env vars (your Supabase keys) get bundled in.

Keep everything on `preview` for testing. Only use `--channel production
--environment production` once you ship a real app-store release.

**When you need a NEW build instead of an update:** you added or upgraded a *native*
module (a new `expo-*` package with native code), or changed `app.json` native config
(icons, permissions, plugins). Bump `version` in `app.json` and rebuild — the
`runtimeVersion` policy (`appVersion`) keeps old builds from pulling incompatible
updates.

## 3. Versioning

- `version` in `app.json` is the human version ("1.0.0" → "1.1.0" …). Bump it when you
  make a new native build.
- Build numbers (Android `versionCode` / iOS `buildNumber`) are managed by EAS
  automatically (`appVersionSource: "remote"`, `autoIncrement` on production).

## Gotchas

1. **Google sign-in on device** — native uses the `patungan://` scheme. Add that
   redirect in **Supabase → Auth → URL Configuration** and in the Google Cloud
   console, or Google login fails on the phone. Email/password works without this.
2. **Migrations** — testers hit the same Supabase project you've been using, so make
   sure every migration in `supabase/migrations/` is applied before sharing the build.
