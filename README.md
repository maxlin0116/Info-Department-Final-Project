# MKS Reservation System

Service objects : NTUEE student

Functions: MakerSpace reservation system

Author: 曾竹慧、林孟希、許友懌

## Project Overview

This project is a reservation and registration system for managing the MKS space. Users can check the live status of different areas, create reservations, track their own reservation status, and submit reservations for administrator review through a web interface.

The system focuses on reservation and usage registration only. It does not include student ID card access control, card readers, or door lock integration.

## Current Implementation Status

The current codebase already includes the following end-to-end features:

- User registration and login with JWT-based sessions
- Student ID validation (`1 letter + 8 digits`) on both frontend and backend
- Grade selection from a predefined dropdown on the registration page
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

## Reservation Areas

Reservations are separated by area. Each area can have its own reservation limit and display rules.

| Area | Description | Reservation Limit |
| --- | --- | --- |
| Meeting Area | Used for meetings, discussions, and group work | Based on the meeting area's capacity |
| Soldering Table | Used for soldering and electronics work | 8 seats |
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
```

2. Install dependencies and start the API:

```bash
cd backend
npm install
npm start
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
npm install
npm run dev
```

Default local URLs:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:8000`

## Production Deployment

Recommended production setup for this project:

- Frontend: Vercel
- Backend: Render Web Service
- Database: MongoDB Atlas

### 1. MongoDB Atlas

Create or reuse an Atlas cluster, then prepare:

- A database user for the application
- A connection string for `MONGODB_URI`
- A project IP Access List entry that allows your deployed backend to connect

Atlas only allows clients whose IP or CIDR is listed in the project's IP Access List. If you cannot provide a fixed backend egress address, the simplest hosted setup is often to temporarily allow `0.0.0.0/0`, but Atlas warns that this allows access from anywhere and should be used carefully with strong database credentials.

### 2. Deploy the Backend to Render

Create a new Render Web Service from this repository and set the service root directory to `backend`.

Recommended Render settings:

- Build Command: `npm install`
- Start Command: `npm start`

Required environment variables:

- `MONGODB_URI`
- `JWT_SECRET`
- `ADMIN_ACCESS_PASSWORD`
- `FRONTEND_ORIGIN`

Example:

```txt
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>/<database>?retryWrites=true&w=majority
JWT_SECRET=<long-random-secret>
ADMIN_ACCESS_PASSWORD=<admin-password>
FRONTEND_ORIGIN=https://your-frontend.vercel.app
```

The backend also exposes a health endpoint at:

```txt
/api/health
```

### 3. Deploy the Frontend to Vercel

Create a Vercel project that uses the `frontend` directory as the project root.

Required environment variable:

```txt
VITE_API_BASE_URL=https://your-backend.onrender.com
```

This repository includes `frontend/vercel.json` so browser refreshes and direct links in the React SPA rewrite to `index.html`.

### 4. Update CORS

After the Vercel project has a stable production domain, set Render's:

```txt
FRONTEND_ORIGIN=https://your-frontend.vercel.app
```

If you also want Vercel preview deployments to work against the same backend, you can provide a comma-separated list or a wildcard pattern such as:

```txt
FRONTEND_ORIGINS=https://your-frontend.vercel.app,https://*-your-team.vercel.app
```

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
POST   /api/reservations
PATCH  /api/reservations/:id
DELETE /api/reservations/:id
```

### Admin

```txt
GET   /api/admin/users
PATCH /api/admin/users/:id/role
GET   /api/admin/reservations/pending
PATCH /api/admin/reservations/:id/approve
PATCH /api/admin/reservations/:id/reject
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
