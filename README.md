# PingMe

PingMe is an Expo + React Native app for short-lived activity pings shared between friends. The app includes email authentication, username search and friend requests, an active ping feed/map, ping creation, editing and acceptance, notification preferences, push registration, account deletion, and a Supabase migration with row-level security.

## Run locally

1. Install Node.js 22.13 or later, Expo Go for initial development, and the Supabase CLI if you plan to deploy the backend.
2. Create a Supabase project. In **Authentication → URL Configuration**, set **Site URL** to `pingme://auth/callback` for an app-only setup (or to your real website URL if you have one). Under **Redirect URLs**, add `exp://**` for Expo Go testing and `pingme://**` for EAS builds. Keep the **Confirm signup** email link set to `{{ .ConfirmationURL }}`; a custom template that hardcodes `{{ .SiteURL }}` can send users to `localhost:3000` instead of the requested callback. Supabase only honors callback URLs in the allowlist.
3. Copy `.env.example` to `.env` and set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` from the Supabase Connect panel. The client key is safe to ship because all data access is protected by RLS; never put the service role key in the app.
4. Install dependencies and launch:

   ```sh
   npm install
   npx expo install --fix
   npx expo start
   ```

The project pins Expo SDK 58 to match your Expo Go release; `expo install --fix` aligns platform packages with the installed SDK. Signup now generates the callback URL for the current environment: Expo Go gets an `exp://` link, and an installed PingMe build gets `pingme://`. The default Expo development server opens on web, iOS simulator, Android emulator, or a device using the Expo Go QR code. The map and remote push require a native development or production build. For store builds, the Android Google Maps key is injected by `app.config.js` from `GOOGLE_MAPS_API_KEY`.

## Backend setup

`supabase/schema.sql` is the whole database, as one rerunnable file rather than a migration history. It creates profile, friendship, ping, acceptance, notification preference, push device, block, and report tables; RLS policies; account deletion and count RPCs; and Realtime publication membership. Apply it by pasting it into the Supabase SQL editor, which runs it in a single transaction, or with `psql "$DATABASE_URL" -f supabase/schema.sql`.

Run it again whenever the file changes. It builds an empty database from scratch and, on a database that is already set up, applies only what has drifted without touching existing rows, so there is nothing to apply in order and no migration state to repair. Edit the file to describe the database you want; its header explains which objects it reconciles automatically and the one case (changing an existing column's type or default, or an existing key) that needs a line in its DRIFT section.

Deploy push delivery:

```sh
supabase functions deploy notify-ping
```

The function uses Supabase's `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` server secrets. Those are provisioned in hosted Supabase Functions automatically. It sends Expo Push messages only to accepted friends with a registered device and enabled global, sender, and activity preferences. Ping data remains saved if push delivery is unavailable.

## Push and store builds

Create/link an EAS project with `eas init`, set its project ID under `expo.extra.eas.projectId` in `app.json`, and add `GOOGLE_MAPS_API_KEY` to your local build environment and EAS environment variables. Enable Google Maps SDK for Android and restrict the key to this app's package and signing certificates. Register physical devices from Settings. Push notifications require an EAS development or production build and valid iOS/Android credentials. Set the final bundle identifier/package name before the first store submission. Build with `eas build --platform all --profile production`; store submission additionally needs the relevant App Store Connect and Google Play credentials.

## Privacy and MVP boundaries

Only accepted friends can read an active ping or accept it. The ping creator can see the names of responders; the count RPC exposes aggregate counts to eligible friends. Location is optional, foreground-only, and attached to an individual ping. Location coordinates are never requested by the app unless the user chooses “Use my current location.” The app has list fallback when the map is unavailable. Friend-of-friend invites, groups, scheduling, and avatar customization remain outside this MVP.
