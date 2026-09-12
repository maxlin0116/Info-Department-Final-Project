# MKS Reservation System

Service objects : NTUEE student

Functions: MakerSpace reservation system

Author: 曾竹慧、林孟希、許友懌

## Project Overview

This project is a reservation and registration system for managing the MKS space. Users can check the live status of different areas, create reservations, track their own reservation status, and submit reservations for administrator review through a web interface.

The system focuses on reservation and usage registration only. It does not include student ID card access control, card readers, or door lock integration.

## Current Implementation Status

The current codebase already includes the following end-to-end features:

- Centralized account provisioning and login with JWT-based sessions
- Public self-registration disabled (API returns `403 Forbidden`; accounts issued centrally)
- Batch account provisioning CLI (`npm run provision:users`) with roster import, random password generation, and credentials export
- Mandatory first-login password change flow (`mustChangePassword: true`)
- Web-based user management dashboard at `/admin/users` (password reset, role changes, account suspension, and safe deletion)
- Student ID validation (`1 letter + 8 digits`) on both frontend and backend
- Optional admin session login from the frontend using a server-side `ADMIN_ACCESS_PASSWORD`
- Automatic frontend logout when the JWT session expires
- Live area status driven by backend reservation data
- Area availability lookup for reservation time-slot selection
- Opening-hour-aware availability slots, including edge slots that align to the actual open/close times
- Reservation form fields for participant count, purpose, planned items, project notes, and when2meet link
- Prevention of reservations for past time slots
- New reservations created with `pending` status by default
- Pending reservations counted toward capacity before approval
- "My Reservations" panel with status badges for pending, upcoming, in-progress, completed, cancelled, and rejected reservations
- Reservation history separated from active reservations on the dashboard
- 6-hour cancellation restriction for regular users
- Admin review page for approving or rejecting pending reservations
- MakerSpace user check-in with administrator attendance confirmation
- Automatic no-show handling after a configurable grace period, releasing reserved capacity
- STL/3MF upload, browser model preview, basic Bambu-style print settings, and server-side P1S slicing
- Monthly 3DP quota accounting by estimated print minutes (default 600 minutes, admin configurable)
- Four-slot AMS color selection with admin reassignment
- DXF intake with manual admin duration review
- Fixed laser material/thickness choices: 3/5 mm MDF and 3/5 mm acrylic
- Separate FIFO queues for the single P1S and single laser cutter
- Public always-on display at `/display` with today's reservations, machine states, names, and both queues

## Fabrication Workflow

3DP and laser are queue services; MakerSpace is the single time-slot reservation resource. The legacy Soldering Table is retired and retained only in historical records.

### MakerSpace attendance

```txt
pending -> approved -> user check-in -> admin attendance confirmation -> in use -> completed
                    \-> no check-in after grace period -> no-show / capacity released
```

- Check-in opens 15 minutes before the reservation by default.
- An approved reservation is automatically marked `no_show` 15 minutes after its start if the user has not checked in.
- A pending reservation is automatically cancelled when its start time passes without approval.
- The administrator confirms physical attendance before the reservation becomes `in_use`.

### 3DP

```txt
upload STL/3MF -> import embedded Bambu settings -> adjust quality/strength/speed/support/other -> Linux worker slices
-> review estimated time -> choose an available AMS slot/color -> admin review
-> FIFO queue -> running -> completed/failed -> physical collection acknowledgement
```

- Target profile: one Bambu Lab P1S, stock 0.4 mm nozzle, Bambu PLA Basic.
- Bambu Studio 3MF project settings are read in the browser and mapped to the server's allow-listed P1S slicing controls. Embedded object transforms remain intact; STL files use the safe defaults.
- The preview uses a light Bambu-style workspace, a dark build plate, and live scale/orientation/brim feedback.
- After slicing, the material fee is `round(total filament grams / 2)` and is shown to the owner and administrators.
- Quota is reserved when the user confirms the estimate and consumed when the admin starts the job.
- Cancelling or rejecting a not-yet-started job returns reserved quota.
- The generated `.gcode.3mf` is available to the owner and admins.
- Slicing is a local file operation. The worker does **not** need to be on the P1S LAN because this implementation does not send jobs to or read telemetry from the printer.

### Laser

```txt
upload DXF + choose material/thickness -> admin downloads/checks file and enters minutes
-> FIFO queue -> running -> completed/failed -> physical collection acknowledgement
```

Laser quota is disabled by default. If an admin enables it, the manually entered duration becomes the quota value.

### Admin and public display

- `/`: read-only home overview with the five-day MakerSpace schedule and current 3DP/laser execution state.
- `/reserve`: interactive MakerSpace reservation calendar and the signed-in user's active reservations.
- `/fabrication/3dp`: 3DP upload, slicing settings, estimate, color selection, and queue submission.
- `/fabrication/laser`: DXF upload and administrator-estimated laser queue submission.
- `/admin/users`: manages student and admin accounts, issues temporary passwords, updates roles, suspends or deletes accounts.
- `/admin/reservations`: reviews reservations and confirms physical attendance or no-show status.
- `/admin/fabrication`: estimates laser jobs, reviews 3DP, changes AMS assignment, manages machines/colors/quotas, and advances job states.
- `/fabrication/jobs`: a user's own jobs and current 3DP quota.
- `/fabrication/queues`: public queue view.
- `/display`: kiosk-style always-on view, refreshed through SSE with a 30-second polling fallback.

Queue order is enforced FIFO by `queueEnteredAt`; an admin cannot start a later job while an earlier queued job remains.
The live queue shows waiting-for-review, queued, running, and completed jobs to
users and administrators. A completed job remains there until its owner or an
administrator confirms that the physical item was collected. The acknowledgement
removes it from the live queue while retaining it in job history.

## Linux Slicing Deployment

Production uses three containers sharing MongoDB and a persistent file volume:

```txt
web/API ---- MongoDB ---- slicer worker (Bambu Studio CLI)
   |                           |
   +------ shared files -------+
```

The Docker image is Debian Bookworm/glibc based rather than Alpine because the official Bambu Studio Linux build needs desktop runtime libraries. The slicing worker is independent from the web process, claims jobs atomically, and recovers stale claims after 15 minutes.

Before `docker compose up`:

1. Put a tested Linux launcher at `prod-support/bambu-studio/bambu-studio`.
2. Put full P1S/process/PLA configs in `prod-support/bambu-profiles/` as documented there.
3. Set secrets and paths in `prod-support/.env`.
4. Confirm the project's Bambu Studio AGPL-3.0 distribution/source-code arrangement. This repository does not bundle Bambu Studio.

The CLI/profile contract follows Bambu Studio's official command-line usage. Pin and acceptance-test a known-good Bambu Studio version before production; CLI behavior has varied between releases.

## Reservation Areas

Reservations are separated by area. Each area can have its own reservation limit and display rules.

| Area | Description | Reservation Limit |
| --- | --- | --- |
| MakerSpace | General project work, discussion, and equipment use | 8 people by default |
| 3DP Area | Used for 3D printing | Based on printer availability; users can also check whether someone is currently printing |
| Heavy Processing Area | Used for heavier machining or processing work | Based on equipment availability and safety rules |

## Goals

- Provide online reservation for different MKS areas
- Show the current usage status of each area in real time
- Show whether the 3DP area currently has active printing jobs
- Allow users to register current or future usage
- Set reservation limits based on the selected area
- Record reservation history
- Allow administrators to review, update, or cancel reservations

## Local Development

### Backend

1. Create `backend/.env` with at least:

```txt
PORT=8000
MONGODB_URI=<your mongodb connection string>
JWT_SECRET=<your jwt secret>
ADMIN_ACCESS_PASSWORD=<your admin access password>
RESERVATION_QUOTA_LIMIT=64
FRONTEND_ORIGIN=http://localhost:5173
MAIL_PROVIDER=gmail_api
GMAIL_CLIENT_ID=<your google oauth client id>
GMAIL_CLIENT_SECRET=<your google oauth client secret>
GMAIL_REFRESH_TOKEN=<your google oauth refresh token>
GMAIL_SENDER_EMAIL=<your gmail address>
RESEND_API_KEY=<optional resend api key>
EMAIL_API_TIMEOUT_MS=15000
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
SMTP_CONNECTION_TIMEOUT_MS=15000
SMTP_GREETING_TIMEOUT_MS=10000
SMTP_SOCKET_TIMEOUT_MS=20000
EMAIL_FROM="MakerSpace <your-gmail-address>"
PASSWORD_RESET_URL_BASE=http://localhost:5173
PASSWORD_RESET_TOKEN_TTL_MINUTES=15
```

2. Install dependencies and start the API:

```bash
cd backend
pnpm install
pnpm start
```

3. Optional seed commands:

```bash
cd backend
npm run seed:areas
npm run seed:opening-hours
```

### Frontend

```bash
cd frontend
pnpm install
pnpm run dev
```

Default local URLs:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:8000`

### Account Provisioning & Administration

Public self-registration is disabled. User accounts are centrally provisioned via the batch provisioning CLI tool or managed through the web interface.

#### 1. Batch Account Provisioning CLI

The `provisionUsers.js` utility imports a roster of students from a CSV or JSON file, validates records, generates secure random passwords, hashes them with `bcrypt`, marks them for mandatory password reset on first login (`mustChangePassword: true`), and exports a timestamped CSV of credentials for distribution.

##### Run Provisioning:

```bash
cd backend
# Dry run to validate the file without database changes:
npm run provision:users -- --input scripts/sample_roster.csv --dry-run

# Provision users into MongoDB:
npm run provision:users -- --input scripts/sample_roster.csv
```

##### Input Roster Format (CSV):

Prepare a CSV file with the following headers (see `backend/scripts/sample_roster.csv` for a template):

```csv
studentId,name,grade,personalEmail,role
b11901001,Alice Chen,Junior,b11901001@ntu.edu.tw,user
b11901002,Bob Lin,Senior,b11901002@ntu.edu.tw,user
b10901099,Admin Assistant,Senior,labadmin@ntu.edu.tw,admin
```

- `studentId`: Must match `1 letter + 8 digits` (e.g. `b11901001`).
- `name`: Student or lab member's full name.
- `grade`: e.g. `Freshman`, `Sophomore`, `Junior`, `Senior`, `Master's`, `PhD`.
- `personalEmail`: Valid email format for notifications.
- `role`: Optional. Either `user` (default) or `admin`.

##### CLI Options:

| Option | Description |
| --- | --- |
| `--input <path>` | Path to the input roster CSV or JSON file (required). |
| `--output <path>` | Custom path to save the generated credentials CSV. Defaults to `backend/scripts/output/credentials_<timestamp>.csv`. |
| `--skip-existing` | Skip student IDs that already exist in the database (default behavior). |
| `--update-existing` | Update details and regenerate a new temporary password for existing student IDs. |
| `--dry-run` | Validates file format and schema constraints without connecting to MongoDB or writing credentials. |
| `--help`, `-h` | Display command usage and option flags. |

> [!NOTE]
> **Security Notice**: The generated credentials file contains temporary plaintext passwords. Deliver these credentials through official university channels, instruct students to change their password upon their first sign-in, and securely delete or archive the exported credentials file. Credentials files in `scripts/output/` are automatically excluded by `.gitignore`.

#### 2. Web-Based User Administration (`/admin/users`)

Administrators can also manage accounts interactively through the frontend:

1. Log in with admin privileges (check "Admin login" on the login page and enter the configured `ADMIN_ACCESS_PASSWORD`).
2. Click **USERS_ADMIN** in the top navigation bar (or navigate to `/admin/users`).
3. Available actions:
   - **Add User**: Manually create an individual account with custom or generated passwords.
   - **Reset Password**: Instantly generate a temporary password for a student, presented in a copyable modal.
   - **Role Toggle**: Promote a student to `admin` or demote an `admin` to `user`.
   - **Account Suspension**: Toggle accounts between `Active` and `Suspended` without losing reservation history.
   - **Safe Deletion**: Permanently delete accounts (prevented if active reservations exist).

## Render + Vercel Deployment From Scratch

This is the recommended deployment path for the current hosted project:

```txt
browser
  |
  v
Vercel static frontend
  |
  | REST API requests
  v
Render Node/Express backend
  |
  | Mongoose
  v
MongoDB Atlas

Render backend
  |
  | HTTPS Gmail API
  v
Google Workspace / Gmail password reset emails
```

Render Free cannot send email through normal SMTP ports, so password reset email should use `MAIL_PROVIDER=gmail_api`.
Do not use a Google App Password on Render Free for this project.

### 1. Push the Repository to GitHub

Render and Vercel both deploy from GitHub in this setup.

1. Make sure the latest code is pushed to the branch you want to deploy, usually `main`.
2. Confirm the repository contains both `backend/` and `frontend/`.
3. Do not commit `.env`, OAuth secrets, Gmail refresh tokens, MongoDB passwords, or API keys.

Useful local checks:

```bash
git status
git log --oneline --max-count=5
```

### 2. Create MongoDB Atlas Database

The Render backend needs a MongoDB connection string in `MONGODB_URI`.
MongoDB Atlas is the simplest hosted option.

1. Open MongoDB Atlas and create a project.
2. Create a free/shared cluster if this is for class or small usage.
3. Create a database user with username and password authentication.
4. Open `Network Access`.
5. Add an IP access rule that allows Render to connect.
   - Better production practice: allow only Render outbound IPs if available for your plan.
   - Simpler class-project setup: allow `0.0.0.0/0`, but understand this allows any IP to try connecting, so the database password must be strong.
6. Open the cluster's `Connect` dialog.
7. Select `Connect your application`.
8. Copy the `mongodb+srv://...` connection string.
9. Replace `<username>`, `<password>`, and database name as needed.

Example:

```txt
MONGODB_URI=mongodb+srv://<db-user>:<db-password>@cluster0.xxxxx.mongodb.net/mks_reservation?retryWrites=true&w=majority
```

If the database password contains special characters such as `@`, `/`, `:`, or `#`, URL-encode the password before putting it in the URI.

### 3. Deploy the Backend on Render

Create the backend first, because the frontend needs the Render backend URL.

1. Open Render Dashboard.
2. Click `New +`.
3. Select `Web Service`.
4. Connect the GitHub repository.
5. Use these service settings:

| Render Field | Value |
| --- | --- |
| Name | `mks-reservation-api` or any backend service name |
| Runtime | `Node` |
| Branch | `main` |
| Root Directory | `backend` |
| Build Command | `npm install` |
| Start Command | `npm run prod` |
| Plan | `Free` |

`npm run prod` runs:

```bash
node src/database/ensureSeedData.js && node src/app.js
```

This seeds reservation areas and opening hours when the related collections are empty, then starts the Express API.

### 4. Add Render Environment Variables

In the Render backend service, open `Environment` and add:

```txt
NODE_ENV=production
NODE_VERSION=20
MONGODB_URI=<your MongoDB Atlas connection string>
JWT_SECRET=<long random string>
ADMIN_ACCESS_PASSWORD=<admin shared access password>
RESERVATION_QUOTA_LIMIT=64
AUTO_SEED_DATA=true
FRONTEND_ORIGIN=https://<your-vercel-domain>
FRONTEND_ORIGINS=
MAIL_PROVIDER=gmail_api
GMAIL_CLIENT_ID=<Google OAuth client ID>
GMAIL_CLIENT_SECRET=<Google OAuth client secret>
GMAIL_REFRESH_TOKEN=<Google OAuth refresh token>
GMAIL_SENDER_EMAIL=<sender Gmail address>
EMAIL_FROM="MakerSpace <sender Gmail address>"
PASSWORD_RESET_URL_BASE=https://<your-vercel-domain>
PASSWORD_RESET_TOKEN_TTL_MINUTES=15
EMAIL_API_TIMEOUT_MS=15000
```

Generate strong local values for secrets:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Use one generated value for `JWT_SECRET`.
Use a different strong value for `ADMIN_ACCESS_PASSWORD`.

Do not set these SMTP variables on Render Free:

```txt
SMTP_HOST
SMTP_PORT
SMTP_SECURE
SMTP_USER
SMTP_PASS
```

Render Free blocks outbound SMTP traffic on ports `25`, `465`, and `587`.
If the app shows an error such as `connect ENETUNREACH ... :587`, the service is still trying to use SMTP.
Set `MAIL_PROVIDER=gmail_api`, remove SMTP variables, save, and redeploy.

After saving environment variables, click:

```txt
Manual Deploy -> Clear build cache & deploy
```

When Render finishes, open:

```txt
https://<your-render-service>.onrender.com/api/health
```

Expected response:

```json
{ "ok": true }
```

### 5. Deploy the Frontend on Vercel

1. Open Vercel Dashboard.
2. Click `Add New...`.
3. Select `Project`.
4. Import the same GitHub repository.
5. Configure the Vite frontend:

| Vercel Field | Value |
| --- | --- |
| Framework Preset | `Vite` |
| Root Directory | `frontend` |
| Build Command | `npm run build` |
| Output Directory | `dist` |

6. Add this Vercel environment variable:

```txt
VITE_API_BASE_URL=https://<your-render-service>.onrender.com
```

Do not add a trailing slash.

7. Deploy the project.

The frontend includes `frontend/vercel.json`:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

This lets direct browser refresh work on React routes such as `/forgot-password`, `/reset-password`, and `/privacy`.

After Vercel gives you the production URL, return to Render and update:

```txt
FRONTEND_ORIGIN=https://<your-vercel-domain>
PASSWORD_RESET_URL_BASE=https://<your-vercel-domain>
```

Then redeploy the Render backend.

### 6. Create Google Cloud Project for Gmail API

The password reset flow sends email through Gmail API over HTTPS.
This works on Render Free because it does not use SMTP.

1. Open Google Cloud Console.
2. Create or select a project, for example `MakerSpace RSVN SYS`.
3. Search for `Gmail API`.
4. Open `Gmail API`.
5. Click `Enable`.

### 7. Configure Google OAuth Brand and Audience

Open `Google Auth Platform`.

In `Brand`, fill:

```txt
App name: MakerSpace RSVN SYS
User support email: <sender Gmail address>
Developer contact email: <sender Gmail address>
Homepage URL: https://<your-vercel-domain>
Privacy Policy URL: https://<your-vercel-domain>/privacy
```

The frontend contains a public privacy policy page at:

```txt
https://<your-vercel-domain>/privacy
```

In `Audience`:

1. Select `External`.
2. Add the sender Gmail address as a test user if the app is still in testing.
3. Publish the app to production when the brand page is complete.

Production mode avoids the fixed 7-day refresh token behavior that appears while the OAuth app is in testing.

### 8. Create Google OAuth Client

In Google Cloud:

1. Open `APIs & Services`.
2. Open `Credentials`.
3. Click `Create Credentials`.
4. Select `OAuth client ID`.
5. Choose `Web application`.
6. Name it `MakerSpace Gmail Sender`.
7. Add this authorized redirect URI:

```txt
https://developers.google.com/oauthplayground
```

8. Create the client.
9. Copy the generated `Client ID` and `Client Secret`.

Do not commit or screenshot these values.

### 9. Generate Gmail Refresh Token

Open OAuth 2.0 Playground:

```txt
https://developers.google.com/oauthplayground
```

1. Click the gear icon.
2. Set `OAuth flow` to `Server-side`.
3. Set `Access type` to `Offline`.
4. Set `Force prompt` to `Consent Screen`.
5. Enable `Use your own OAuth credentials`.
6. Paste the OAuth `Client ID` and `Client Secret`.
7. Close the settings panel.
8. In Step 1, enter this scope:

```txt
https://www.googleapis.com/auth/gmail.send
```

9. Click `Authorize APIs`.
10. Select the Gmail account that will send password reset emails.
11. Allow the app to send email.
12. Back in OAuth Playground, click `Exchange authorization code for tokens`.
13. Copy the `Refresh token`.

Use the copied value as:

```txt
GMAIL_REFRESH_TOKEN=<copied refresh token>
```

Confirm the token response does not include:

```txt
refresh_token_expires_in
```

If `refresh_token_expires_in` appears with a value around `604799`, the refresh token is time-limited to about 7 days.
Make sure the OAuth app is in production, remove the old app connection from the Google Account permissions page, and generate the token again.

The OAuth Playground `Auto-refresh the token before it expires` checkbox is only for testing inside the Playground.
It does not affect the Render backend.

### 10. Security Rules for Google Tokens

Treat these as secrets:

```txt
GMAIL_CLIENT_SECRET
GMAIL_REFRESH_TOKEN
JWT_SECRET
ADMIN_ACCESS_PASSWORD
MONGODB_URI
```

Do not paste them in chat, commit them to GitHub, or put them in frontend/Vercel variables unless the frontend explicitly needs them.
For this project, Gmail secrets belong only in Render backend environment variables.

If a token or client secret is exposed:

1. Go to Google Cloud `Credentials`.
2. Regenerate the OAuth client secret or create a new OAuth client.
3. Re-run OAuth Playground with the new secret.
4. Replace `GMAIL_CLIENT_SECRET` and `GMAIL_REFRESH_TOKEN` in Render.
5. Redeploy Render.

Refresh tokens are long-lived when they are not time-limited, but they can still stop working if:

- the Google Account owner removes app access
- the Gmail password is changed
- the token is unused for a long period
- too many refresh tokens are created for the same account/client
- Google or an administrator applies a security policy

If Render logs show `invalid_grant`, generate a new refresh token and update Render.

### 11. End-to-End Deployment Test

After Render and Vercel are both deployed:

1. Open the Vercel frontend.
2. Register a user with a real `personal_email`.
3. Open `/forgot-password`.
4. Enter the registered email or student ID.
5. Submit the reset request.
6. Check the recipient inbox and spam folder.
7. Open the reset link.
8. Set a new password.
9. Log in with the new password.

Expected behavior:

- the forgot-password page shows a success message
- the email is sent from the configured Gmail account
- the reset link points to the Vercel frontend domain
- the reset token expires after `PASSWORD_RESET_TOKEN_TTL_MINUTES`
- the same reset token cannot be reused after the password is changed

### 12. Common Render and Email Errors

| Error | Meaning | Fix |
| --- | --- | --- |
| `SMTP_HOST environment variable is not configured` | The backend is not configured for Gmail API, or old code is deployed | Set `MAIL_PROVIDER=gmail_api`, deploy the latest GitHub commit |
| `connect ENETUNREACH ... :587` | The backend is trying to use SMTP on Render Free | Remove SMTP variables, set `MAIL_PROVIDER=gmail_api`, redeploy |
| `GMAIL_REFRESH_TOKEN environment variable is not configured` | Missing Render env var | Add `GMAIL_REFRESH_TOKEN` in Render and redeploy |
| `invalid_grant` | Refresh token is revoked, expired, or does not match the OAuth client | Generate a new refresh token with the same client ID/secret |
| `redirect_uri_mismatch` | OAuth client does not allow OAuth Playground redirect URL | Add `https://developers.google.com/oauthplayground` as an authorized redirect URI |
| `access_denied` during Google consent | User is not allowed to authorize the testing app | Add the Gmail account as a test user, or publish the OAuth app |
| `CORS blocked for origin` | Render does not allow the Vercel origin | Set `FRONTEND_ORIGIN=https://<your-vercel-domain>` and redeploy |
| Vercel frontend calls localhost | `VITE_API_BASE_URL` is missing or old | Add `VITE_API_BASE_URL=https://<your-render-service>.onrender.com` and redeploy Vercel |
| Reset link opens the wrong domain | `PASSWORD_RESET_URL_BASE` is wrong | Set it to the Vercel production URL and redeploy Render |

### 13. Official Deployment References

- Render first deploy: <https://render.com/docs/your-first-deploy>
- Render MongoDB Atlas connection guide: <https://render.com/docs/connect-to-mongodb-atlas>
- Render Free SMTP limitation: <https://render.com/changelog/free-web-services-will-no-longer-allow-outbound-traffic-to-smtp-ports>
- MongoDB Atlas IP access list: <https://www.mongodb.com/docs/atlas/security/add-ip-address-to-list/>
- Vercel Vite deployment: <https://vercel.com/docs/frameworks/frontend/vite>
- Vercel environment variables: <https://vercel.com/docs/environment-variables>
- Gmail API `users.messages.send`: <https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages/send>
- Google OAuth 2.0 overview: <https://developers.google.com/identity/protocols/oauth2>
- OAuth 2.0 Playground: <https://developers.google.com/oauthplayground/>

## Department Server Docker Deployment

This repository now includes a deployment setup that matches the department server flow from class:

```txt
browser -> Nginx Proxy Manager -> web container -> MongoDB container
```

In this setup:

- the frontend is built by Vite during the Docker image build
- the backend serves the built `frontend/dist`
- MongoDB stays inside the compose network
- Nginx Proxy Manager forwards external traffic to the web container

### Files Added for Deployment

- `prod-support/Dockerfile`
- `prod-support/docker-compose.yml`
- `prod-support/.env.example`
- `backend/.env.example`

### 1. Prepare Environment Variables

Copy the production example file:

```bash
cd prod-support
cp .env.example .env
```

Update at least:

```txt
JWT_SECRET=<long-random-secret>
ADMIN_ACCESS_PASSWORD=<admin-password>
RESERVATION_QUOTA_LIMIT=64
FRONTEND_ORIGIN=https://your-domain.ntuee.org
MAIL_PROVIDER=gmail_api
GMAIL_CLIENT_ID=<your google oauth client id>
GMAIL_CLIENT_SECRET=<your google oauth client secret>
GMAIL_REFRESH_TOKEN=<your google oauth refresh token>
GMAIL_SENDER_EMAIL=<your gmail address>
RESEND_API_KEY=<optional resend api key>
EMAIL_API_TIMEOUT_MS=15000
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
SMTP_CONNECTION_TIMEOUT_MS=15000
SMTP_GREETING_TIMEOUT_MS=10000
SMTP_SOCKET_TIMEOUT_MS=20000
EMAIL_FROM="MakerSpace <your-gmail-address>"
PASSWORD_RESET_URL_BASE=https://your-domain.ntuee.org
PASSWORD_RESET_TOKEN_TTL_MINUTES=15
```

Notes:

- `MONGODB_URI` already defaults to the compose MongoDB service name
- `AUTO_SEED_DATA=true` will seed reservation areas and opening hours only when those collections are empty
- if you later need multiple allowed frontend origins, use `FRONTEND_ORIGINS` as a comma-separated list or wildcard pattern
- password reset email supports `MAIL_PROVIDER=gmail_api`, `MAIL_PROVIDER=resend`, or SMTP with `SMTP_HOST` and `EMAIL_FROM`
- Render free web services cannot send outbound SMTP traffic on ports `25`, `465`, or `587`; set `MAIL_PROVIDER=gmail_api` or `MAIL_PROVIDER=resend` to use an HTTPS email API on Render Free
- Resend's default `onboarding@resend.dev` sender is only for testing to your own Resend account email; verify your own domain in Resend before sending password reset emails to general users
- Gmail API does not require a custom domain, but it sends from the Gmail account that granted the refresh token and is subject to Gmail sending limits

### 2. Create the Shared Nginx Network

The compose file expects the same external Docker network used by Nginx Proxy Manager:

```bash
docker network create nginx
```

You only need to do this once on the server.

### 3. Build and Start the Containers

From the `prod-support` directory:

```bash
docker compose up -d --build
```

This starts:

- `mks-reservation-web`
- `mks-reservation-slicer`
- `mks-reservation-mongo`

The web app listens on port `4000` inside the container and also publishes `4000:4000` on the host for debugging.

### 4. Configure Nginx Proxy Manager

Create a new Proxy Host with:

- Domain Names: your final domain, for example `mks.ntuee.org`
- Scheme: `http`
- Forward Hostname / IP: `mks-reservation-web`
- Forward Port: `4000`

If the proxy host is on the same Docker network, Nginx Proxy Manager can reach the container by service/container name directly.

### 5. Configure DNS

In Cloudflare DNS, point your subdomain to the department server:

```txt
Type: A
Name: mks
Content: <server IPv4>
```

After DNS resolves correctly, the domain should reach Nginx Proxy Manager, which then forwards traffic to the app container.

### 6. Enable HTTPS

After the HTTP proxy host works:

1. Request an SSL certificate in Nginx Proxy Manager.
2. Enable HTTPS for the proxy host.
3. Keep `FRONTEND_ORIGIN` aligned with the final `https://...` domain.

### 7. Useful Checks

Container status:

```bash
docker compose ps
docker compose logs -f mks-reservation-web
docker compose logs -f mks-reservation-slicer
docker compose logs -f mks-reservation-mongo
```

Health check:

```txt
https://your-domain.ntuee.org/api/health
```

Expected response:

```json
{ "ok": true }
```

### Production Notes

- Same-origin requests are allowed automatically when the frontend is served by the same container as the API.
- If you deploy a separate frontend later, set `FRONTEND_ORIGIN` or `FRONTEND_ORIGINS` explicitly.
- The backend falls back to API-only mode if `frontend/dist` is not present.
- The SPA router is supported in production, so browser refresh on nested routes still returns `index.html`.

## Account Requirements

Users need to create an account before making reservations.

Required account information:

| Field | Description |
| --- | --- |
| name | User's real name |
| grade | User's grade or year, selected from the built-in dropdown |
| student_id | Used as the login account. Format: `1 letter + 8 digits` |
| password | Set by the user |
| personal_email | Personal email used for contact and reservation notifications |

Users do not need to register before browsing the website, but they must register before submitting a reservation.

The current implementation also supports an **admin session login** from the normal login page. A user logs in with their normal student ID and password, then optionally enables admin login and provides the server-side `ADMIN_ACCESS_PASSWORD`.

Current registration form options for `grade` are:

- `Freshman`
- `Sophomore`
- `Junior`
- `Senior`
- `Master's`
- `PhD`

## Reservation Form Requirements

Each reservation should include:

| Field | Description |
| --- | --- |
| area | Selected area: Meeting Area, Soldering Table, 3DP Area, or Heavy Processing Area |
| start_time | Reservation start time |
| end_time | Reservation end time |
| participant_count | Total number of people using the area |
| plannedItems | Optional list of items or equipment the user plans to use. Each item can include category, name, and quantity |
| purpose | Purpose of use |
| when2meet | Optional scheduling reference or when2meet link. The current system stores and displays this value for users and admins, but does not auto-parse or sync When2meet availability |
| project | Optional project name or project description |

## Planned Item Options

Users can optionally select or write the items they expect to use.

### Development Boards

| Item |
| --- |
| Arduino series |
| ESP series |
| RPi |
| STM32 |

### Modules

For modules, users should also write the expected quantity.

| Item |
| --- |
| TB6612 |
| Servo motor |
| Buck converter |
| MFRC522 |
| DHT11 |
| Photoresistor |
| Buzzer |

Example `plannedItems` data:

```js
[
  {
    category: "development_board",
    name: "Arduino series",
    quantity: 1
  },
  {
    category: "module",
    name: "TB6612",
    quantity: 2
  }
]
```

## Reservation Rules

- Reservation limits depend on the selected area.
- The Soldering Table has 8 available seats.
- The 3DP Area should show whether there are active printing reservations.
- New reservations are created as `pending` and still count toward capacity.
- Pending and approved future reservations also count toward each user's reservation quota.
- Each 30-minute time slot costs 1 quota point per participant, controlled by `RESERVATION_QUOTA_LIMIT`.
- Users cannot create reservations for past time slots.
- Reservation availability follows the configured opening-hour blocks and break periods.
- Users can cancel their own reservations no later than 6 hours before the reservation start time.
- Reservations that start in less than 6 hours cannot be changed by regular users.
- Admins can approve or reject pending reservations from the admin review page.
- Reservations for different areas should be separated clearly on the frontend dashboard.
- If a user needs multiple areas, the system should create or display separate reservations for each area.

## User Roles

| Role | Permissions |
| --- | --- |
| Admin | Can review pending reservations, approve or reject reservations, and cancel reservations |
| Regular user | Can register usage and reserve MKS areas during opening hours |
| Guest | Can only view public reservation information |

## System Architecture

The system can be divided into three main parts:

```txt
Frontend Website
  |
  | REST API / JSON
  v
Backend Server
  |
  | Mongoose / MongoDB
  v
Database
```

## Recommended Tech Stack

For a full version:

```txt
Frontend: React / Next.js
Backend: Node.js + Express
Database: MongoDB
Auth: Session / JWT
```

For a simpler final project version:

```txt
Frontend: HTML + CSS + JavaScript
Backend: Node.js + Express
Database: MongoDB
```

## Suggested Folder Structure

```txt
mks-reservation-system/
|-- frontend/
|   |-- src/
|   |   |-- pages/
|   |   |   |-- LoginPage.jsx
|   |   |   |-- RegisterPage.jsx
|   |   |   |-- DashboardPage.jsx
|   |   |   |-- CalendarPage.jsx
|   |   |   |-- MyReservationsPage.jsx
|   |   |   `-- AdminPage.jsx
|   |   |-- components/
|   |   |   |-- AreaStatusCard.jsx
|   |   |   |-- Calendar.jsx
|   |   |   |-- ReservationModal.jsx
|   |   |   |-- ReservationForm.jsx
|   |   |   `-- Navbar.jsx
|   |   |-- api/
|   |   |   |-- authApi.js
|   |   |   |-- areaApi.js
|   |   |   `-- reservationApi.js
|   |   `-- App.jsx
|   `-- package.json
|
|-- backend/
|   |-- src/
|   |   |-- app.js
|   |   |-- routes/
|   |   |   |-- auth.routes.js
|   |   |   |-- area.routes.js
|   |   |   |-- reservation.routes.js
|   |   |   `-- admin.routes.js
|   |   |-- controllers/
|   |   |   |-- auth.controller.js
|   |   |   |-- area.controller.js
|   |   |   |-- reservation.controller.js
|   |   |   `-- admin.controller.js
|   |   |-- services/
|   |   |   |-- auth.service.js
|   |   |   |-- area.service.js
|   |   |   `-- reservation.service.js
|   |   |-- models/
|   |   |   |-- user.model.js
|   |   |   |-- area.model.js
|   |   |   |-- reservation.model.js
|   |   |   `-- openingHour.model.js
|   |   |-- middlewares/
|   |   |   |-- auth.middleware.js
|   |   |   `-- role.middleware.js
|   |   `-- database/
|   |       |-- db.js
|   |       |-- seedAreas.js
|   |       `-- seedOpeningHours.js
|   `-- package.json
|
`-- README.md
```

## Backend Layer Design

### routes

Routes define API paths and should not contain business logic.

```js
router.post("/reservations", createReservation);
router.get("/areas/status", getAreaStatus);
```

### controllers

Controllers receive requests, call services, and return responses.

```js
async function createReservation(req, res) {
  const result = await reservationService.create(req.user, req.body);
  res.json(result);
}
```

### services

Services contain the main business logic, such as:

- Checking whether a time is within opening hours
- Checking whether an area has enough capacity
- Checking whether a reservation conflicts with another reservation in the same area
- Finding the current usage status of each area
- Showing whether 3DP has active printing reservations
- Creating, updating, approving, or rejecting reservations

### models

Models handle table definitions and database operations, such as:

- User
- Area
- Reservation
- OpeningHour

## Main Pages

| Page | Features |
| --- | --- |
| Register Page | Create an account using name, grade, student ID, password, and personal email, with frontend validation for student ID format |
| Login Page | User login using student ID and password, with optional admin session login using the server-side admin access password |
| Dashboard / Current Status Page | Shows current usage status, allows creating reservations, and includes active reservations plus reservation history |
| Admin Reservation Review | Allows administrators to review pending reservations and approve or reject them |

## API Design

### Auth

```txt
POST /api/auth/register
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/me
PATCH /api/auth/password
POST /api/auth/password-reset/request
POST /api/auth/password-reset/confirm
```

The current implementation does **not** auto-create user accounts during the reservation flow. Registration must be completed first.

`POST /api/auth/login` also supports requesting an admin session when the user provides valid account credentials plus the server-side admin access password.

### Areas

```txt
GET /api/areas
GET /api/areas/status
GET /api/areas/:id/availability
GET /api/areas/:id/status
```

### Reservations

```txt
GET    /api/reservations
GET    /api/reservations/current
GET    /api/reservations/my
GET    /api/reservations/quota
POST   /api/reservations
PATCH  /api/reservations/:id
POST   /api/reservations/:id/check-in
DELETE /api/reservations/:id
```

### Admin

```txt
GET   /api/admin/users
PATCH /api/admin/users/:id/role
GET   /api/admin/reservations/pending
PATCH /api/admin/reservations/:id/approve
PATCH /api/admin/reservations/:id/reject
PATCH /api/admin/reservations/:id/confirm-attendance
PATCH /api/admin/reservations/:id/no-show
```

## Current Area Status Logic

The current area status logic should be placed in:

```txt
backend/src/services/area.service.js
```

Decision flow:

1. Get the current time
2. For each area, search for `approved` and `pending` reservations where the current time is between `start_time` and `end_time`
3. Count how many seats, machines, or slots are currently being used
4. Compare the current usage with the area's reservation limit
5. Show whether the area is available, partially occupied, or full
6. For the 3DP area, also show whether there are active printing jobs

Availability lookup for the reservation modal is derived from `opening_hours` plus overlapping `pending` and `approved` reservations. The backend returns per-day slots with:

- `time`
- `endTime`
- `occupiedCount`
- `remainingCapacity`
- `isFull`
- `hasReservation`

Example:

```js
async function getAreaStatus(currentTime) {
  const areas = await areaModel.findAll();

  return Promise.all(
    areas.map(async (area) => {
      const currentReservations = await reservationModel.findCurrentByArea(
        area.id,
        currentTime
      );

      const usedCount = currentReservations.reduce(
        (sum, reservation) => sum + reservation.participantCount,
        0
      );

      return {
        area,
        currentReservations,
        usedCount,
        maxCapacity: area.maxCapacity,
        isFull: usedCount >= area.maxCapacity,
        hasActivePrinting: area.type === "3dp" && currentReservations.length > 0
      };
    })
  );
}
```

## Reservation Logic

The reservation logic should be placed in:

```txt
backend/src/services/reservation.service.js
```

Decision flow:

1. Check whether the requested time range is within opening hours
2. Check the selected area's reservation limit
3. Check whether the new reservation would exceed the area's capacity
4. If the area still has enough capacity, create the reservation
5. If the area is full, reject the reservation
6. New reservations are created with `pending` status by default
7. Pending reservations also count toward availability until reviewed
8. Admins can approve or reject pending reservations
9. Reservations for past time slots are rejected
10. Regular users cannot modify reservations that start in less than 6 hours

Example:

```js
async function createReservation(user, data) {
  const area = await areaModel.findById(data.areaId);

  const isOpen = await openingHourService.isRangeOpen(
    data.startTime,
    data.endTime
  );

  if (!isOpen) {
    throw new Error("Reservation time is outside opening hours");
  }

  const usedCount = await reservationModel.countParticipantsInRange(
    data.areaId,
    data.startTime,
    data.endTime
  );

  const nextCount = usedCount + data.participantCount;

  if (nextCount > area.maxCapacity) {
    throw new Error("This area does not have enough available capacity");
  }

  return reservationModel.create({
    areaId: data.areaId,
    userId: user.id,
    purpose: data.purpose,
    plannedItems: data.plannedItems,
    participantCount: data.participantCount,
    startTime: data.startTime,
    endTime: data.endTime,
    status: "pending"
  });
}
```

## Cancellation Logic

The cancellation logic should be placed in:

```txt
backend/src/services/reservation.service.js
```

Decision flow:

1. Find the reservation by ID
2. Check whether the current user owns the reservation
3. If the user is an admin, allow cancellation
4. If the user is not an admin, compare the current time with the reservation start time
5. If the reservation starts in more than 6 hours, allow cancellation
6. If the reservation starts in less than 6 hours, reject the cancellation

Example:

```js
async function cancelReservation(user, reservationId, currentTime) {
  const reservation = await reservationModel.findById(reservationId);

  if (!reservation) {
    throw new Error("Reservation not found");
  }

  if (user.role === "admin") {
    return reservationModel.cancel(reservationId);
  }

  if (reservation.userId !== user.id) {
    throw new Error("You can only cancel your own reservations");
  }

  const sixHoursBeforeStart = new Date(reservation.startTime);
  sixHoursBeforeStart.setHours(sixHoursBeforeStart.getHours() - 6);

  if (currentTime > sixHoursBeforeStart) {
    throw new Error("Reservations can only be cancelled at least 6 hours before the start time");
  }

  return reservationModel.cancel(reservationId);
}
```

## MongoDB Collection Design

### users

| Field | Description |
| --- | --- |
| id | User ID |
| name | User's real name |
| grade | User's grade or year |
| student_id | Student ID, used as login account. Format: `1 letter + 8 digits` |
| password_hash | Hashed password |
| personal_email | User's personal email |
| role | User role |
| created_at | Creation time |

### areas

| Field | Description |
| --- | --- |
| id | Area ID |
| name | Area name |
| type | Area type, such as meeting, soldering, 3dp, or heavy_processing |
| max_capacity | Maximum reservation capacity |
| description | Area description |
| showPrintingStatus | Whether the frontend should show current printing status for this area. This is `true` for the 3DP Area |
| is_active | Whether this area is available for reservation |

Default area data can be inserted with:

```txt
cd backend
npm run seed:areas
```

### reservations

| Field | Description |
| --- | --- |
| id | Reservation ID |
| user_id | Reservation owner ID |
| area_id | Reserved area ID |
| purpose | Purpose of use |
| plannedItems | Optional list of planned tools, machines, materials, or equipment. Each item contains category, name, and quantity |
| participant_count | Total number of people |
| when2meet | Optional when2meet link or scheduling reference |
| project | Optional project name or description |
| start_time | Start time |
| end_time | End time |
| status | Reservation status, such as pending, approved, rejected, or cancelled |
| created_at | Creation time |

### opening_hours

| Field | Description |
| --- | --- |
| id | Opening hour ID |
| dayOfWeek | Day of week, from 1 to 5 |
| dayLabel | Day label, such as Monday or Tuesday |
| slot | Time slot key, such as morning, afternoonA, afternoonB, eveningA, or eveningB |
| slotLabel | Time slot label |
| openTime | Opening time |
| closeTime | Closing time |
| staffName | Staff member responsible for this time slot |
| isOpen | Whether the space is open during this time slot |

Default opening hour data can be inserted with:

```txt
cd backend
npm run seed:opening-hours
```

All default seed data can be inserted with:

```txt
cd backend
npm run seed
```

## MVP Scope

If time is limited, the minimum viable version should include:

1. User registration with student ID, password, and personal email
2. User login
3. Area list: Meeting Area, Soldering Table, 3DP Area, and Heavy Processing Area
4. Current usage status for each area
5. Create, view, and cancel reservations
6. Reservation limit checking based on selected area
7. Dashboard sections separated by reservation area
8. Pending reservation review for admins

After completing the MVP, the following features can be added:

- Special opening hour settings
- User permission management
- Reservation history search
- 3DP printing progress notes
