# PingMe

PingMe is an Expo + React Native app for short-lived activity pings shared between friends. The app includes email authentication, username search and friend requests, an active ping feed/map, ping creation, editing and acceptance, notification preferences, push registration, account deletion, and a rerunnable Supabase schema with row-level security.

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

`supabase/schema.sql` is the only database setup and update file. It includes tables, constraints, RLS policies, RPCs, triggers, and Realtime publication membership for all features, including attendee lists, contributions, and people limits. For initial setup or any schema update, paste the entire file into the Supabase SQL editor and run it, or use `psql -v ON_ERROR_STOP=1 "$DATABASE_URL" -f supabase/schema.sql`. The file includes an explicit transaction so a failure rolls back the whole update. There are no separate SQL patches to run.

Run it again whenever the file changes. It builds an empty database from scratch and, on a database that is already set up, applies only what has drifted without touching existing rows, so there is nothing to apply in order and no migration state to repair. Edit the file to describe the database you want; its header explains which objects it reconciles automatically and the one case (changing an existing column's type or default, or an existing key) that needs a line in its DRIFT section.

For claimable contributions, hosts can request up to six items when creating or editing a ping. Hosts and friends who have joined can claim available items and release their own claims. Leaving a ping releases that person's claims; removing a request or cancelling a ping clears the corresponding claims. Each item can have one claimant, enforced in the database. Demo mode includes sample contributions and works without a backend update.

The optional people limit counts everyone, including the host; leaving it off keeps a ping unlimited. Full pings stay visible with their going count, and attendees can leave to reopen a spot. Database triggers serialize joins and limit changes to prevent overbooking and reject lowering a limit below the number already going. Demo mode includes a four-person pickleball game with one spot left and a full six-person volleyball game.

The **going** count opens an attendee list with names and usernames, including the host. Its RPC and permissions are included in the same schema file.

Demo mode has nine plans, including an art hangout you host, a speech practice you have joined as timekeeper, shared taco prep, a photo walk, a workout buddy request, and a Lucid Hackathon invite with free pizza. Reset the demo from Settings to load fresh examples. Home shows invitations you have not joined; joined and hosted plans appear only in My Events. Claimed contributions show how friends share supplies, skills, and feedback, while several casual plans have no claimable items. The Art and Speech activity categories are included in `supabase/schema.sql`; reapply it before creating real pings in those categories.

Pings can also have an optional custom title (up to 80 characters). Blank titles fall back to the activity name. Open **Updates** on a card to read short notes (up to 200 characters each). Hosts and joined attendees can post; authors can delete their own notes, and hosts can moderate their event. Leaving removes that person's notes along with their contribution claims. Updates are visible to friends who can see the active ping, with blocked authors hidden, and refresh live in both tabs. The panel shows the latest 50 notes. Reapply the same schema file for titles and updates; redeploy `notify-ping` to include custom titles in remote push notifications. Demo mode includes example titles and collaborative notes without a backend update.

Deploy push delivery:

```sh
supabase functions deploy notify-ping
```

The function uses Supabase's `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` server secrets. Those are provisioned in hosted Supabase Functions automatically. It sends Expo Push messages only to accepted friends with a registered device and enabled global, sender, and activity preferences. Ping data remains saved if push delivery is unavailable.

## Push and store builds

Create/link an EAS project with `eas init`, set its project ID under `expo.extra.eas.projectId` in `app.json`, and add `GOOGLE_MAPS_API_KEY` to your local build environment and EAS environment variables. Enable Google Maps SDK for Android and restrict the key to this app's package and signing certificates. Register physical devices from Settings. Push notifications require an EAS development or production build and valid iOS/Android credentials. Set the final bundle identifier/package name before the first store submission. Build with `eas build --platform all --profile production`; store submission additionally needs the relevant App Store Connect and Google Play credentials.

## Privacy and MVP boundaries

Only accepted friends can read an active ping or accept it. People who can view an active ping can open its attendee list; blocked attendee identities remain hidden. The count RPC exposes aggregate counts to eligible friends. Location is optional, foreground-only, and attached to an individual ping. Location coordinates are never requested by the app unless the user chooses “Use my current location.” The app has list fallback when the map is unavailable. Friend-of-friend invites, groups, scheduling, and avatar customization remain outside this MVP.
