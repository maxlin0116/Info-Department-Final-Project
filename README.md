# MKS Reservation System

Service objects : NTUEE student

Functions: MakerSpace reservation system

Author: 曾竹慧、林孟希、許友懌

## Project Overview

This project is a reservation and registration system for managing the MKS space. Users can check the current status of different areas, register current usage, and reserve available time slots through a website.

The system focuses on reservation and usage registration only. It does not include student ID card access control, card readers, or door lock integration.

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

## Account Requirements

Users need to create an account before making reservations.

Required account information:

| Field | Description |
| --- | --- |
| name | User's real name |
| grade | User's grade or year |
| student_id | Used as the login account |
| password | Set by the user |
| personal_email | Personal email used for contact and reservation notifications. It should not be an `ntu.edu.tw` email |

Users do not need to register before browsing the website. If a user makes a reservation for the first time, the system should create an account during the reservation process.

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
| when2meet | Optional scheduling reference or when2meet link |
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
- Users can cancel their own reservations no later than 6 hours before the reservation start time.
- Reservations that start in less than 6 hours cannot be changed by regular users.
- Reservations for different areas should be separated clearly on the frontend dashboard.
- If a user needs multiple areas, the system should create or display separate reservations for each area.

## User Roles

| Role | Permissions |
| --- | --- |
| Admin | Can view all reservations, manage users, approve reservations, and edit reservation records |
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
  | ORM / SQL
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
| Register Page | Create an account using student ID, password, and personal email |
| Login Page | User login using student ID and password |
| Dashboard / Current Status Page | Shows current usage status for Meeting Area, Soldering Table, 3DP Area, and Heavy Processing Area in separate sections |
| Reservation Calendar Page | Shows reservations by area and allows users to create new reservations |
| My Reservations | Allows users to view, update, or cancel their own reservations |
| Admin Dashboard | Allows administrators to manage users, areas, reservations, and approvals |

## API Design

### Auth

```txt
POST /api/auth/register
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/me
```

The first reservation flow can also create a user account if the student ID does not exist yet.

### Areas

```txt
GET /api/areas
GET /api/areas/status
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
2. For each area, search for approved reservations where the current time is between `start_time` and `end_time`
3. Count how many seats, machines, or slots are currently being used
4. Compare the current usage with the area's reservation limit
5. Show whether the area is available, partially occupied, or full
6. For the 3DP area, also show whether there are active printing jobs

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
7. Admins can approve or reject pending reservations

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
| student_id | Student ID, used as login account |
| password_hash | Hashed password |
| personal_email | User's personal email, excluding `ntu.edu.tw` email addresses |
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
7. First-time reservation account creation
8. Dashboard sections separated by reservation area
9. Admin view for all reservations

After completing the MVP, the following features can be added:

- Reservation approval workflow
- Special opening hour settings
- User permission management
- Reservation history search
- 3DP printing progress notes
