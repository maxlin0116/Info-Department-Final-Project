# MKS Reservation System

Service objects : NTUEE student

Functions: MakerSpace reservation system

Author: 曾竹慧、林孟希、許友懌

## Project Overview

This project is a reservation and registration system for managing the MKS space. Users can check the current room status, register current usage, and reserve available time slots through a website.

The main goal is to make it easy for NTUEE students to know whether MKS is currently being used, who has reserved future time slots, and which time slots are still available.

This project focuses on registration and reservation only. It does not include student ID card access control, card readers, or door lock integration.

## Goals

- Provide online reservation for the MKS space
- Show the current MKS usage status in real time
- Allow users to register current or future usage
- Support priority levels based on user role and activity type
- Record reservation history
- Allow administrators to review, update, or cancel reservations

## User Roles

| Role | Permissions |
| --- | --- |
| Admin | Can view all reservations, manage users, approve reservations, and edit reservation records |
| High-priority user | For events such as school visits, dance club activities, engineering camps, or major activities. Can request higher-priority reservations |
| Regular user | Can register usage and reserve MKS during opening hours |
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
Database: PostgreSQL or MySQL
Auth: Session / JWT
```

For a simpler final project version:

```txt
Frontend: HTML + CSS + JavaScript
Backend: Node.js + Express
Database: SQLite
```

## Suggested Folder Structure

```txt
mks-reservation-system/
|-- frontend/
|   |-- src/
|   |   |-- pages/
|   |   |   |-- LoginPage.jsx
|   |   |   |-- DashboardPage.jsx
|   |   |   |-- CalendarPage.jsx
|   |   |   |-- MyReservationsPage.jsx
|   |   |   `-- AdminPage.jsx
|   |   |-- components/
|   |   |   |-- Calendar.jsx
|   |   |   |-- ReservationModal.jsx
|   |   |   |-- CurrentStatusCard.jsx
|   |   |   `-- Navbar.jsx
|   |   |-- api/
|   |   |   `-- reservationApi.js
|   |   `-- App.jsx
|   `-- package.json
|
|-- backend/
|   |-- src/
|   |   |-- app.js
|   |   |-- routes/
|   |   |   |-- auth.routes.js
|   |   |   |-- reservation.routes.js
|   |   |   `-- admin.routes.js
|   |   |-- controllers/
|   |   |   |-- auth.controller.js
|   |   |   |-- reservation.controller.js
|   |   |   `-- admin.controller.js
|   |   |-- services/
|   |   |   |-- reservation.service.js
|   |   |   |-- priority.service.js
|   |   |   `-- auth.service.js
|   |   |-- models/
|   |   |   |-- user.model.js
|   |   |   |-- reservation.model.js
|   |   |   `-- openingHour.model.js
|   |   |-- middlewares/
|   |   |   |-- auth.middleware.js
|   |   |   `-- role.middleware.js
|   |   `-- database/
|   |       `-- db.js
|   `-- package.json
|
`-- README.md
```

## Backend Layer Design

### routes

Routes define API paths and should not contain business logic.

```js
router.post("/reservations", createReservation);
router.get("/reservations/current", getCurrentReservation);
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
- Checking whether a reservation conflicts with another reservation
- Determining user priority
- Creating, updating, approving, or rejecting reservations
- Finding the current active reservation

### models

Models handle table definitions and database operations, such as:

- User
- Reservation
- OpeningHour

### middlewares

Middlewares handle shared request logic, such as:

- Checking whether the user is logged in
- Checking user role and permission
- Handling error responses

## Main Pages

| Page | Features |
| --- | --- |
| Login Page | User login |
| Dashboard / Current Status Page | Shows whether MKS is currently occupied, the current user, and the next reservation |
| Reservation Calendar Page | Shows all reservations and allows users to create new reservations |
| My Reservations | Allows users to view, update, or cancel their own reservations |
| Admin Dashboard | Allows administrators to manage users, reservations, and approvals |

## API Design

### Auth

```txt
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/me
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

## Current Usage Logic

The current usage logic should be placed in:

```txt
backend/src/services/reservation.service.js
```

Decision flow:

1. Get the current time
2. Search for an approved reservation where the current time is between `start_time` and `end_time`
3. If a reservation exists, show the current user, activity title, and end time
4. If no reservation exists, show that MKS is currently available
5. Also show the next upcoming reservation

Example:

```js
async function getCurrentReservation(currentTime) {
  const currentReservation = await reservationModel.findCurrent(currentTime);
  const nextReservation = await reservationModel.findNext(currentTime);

  return {
    isOccupied: Boolean(currentReservation),
    currentReservation,
    nextReservation
  };
}
```

## Reservation Logic

The reservation logic should be placed in:

```txt
backend/src/services/reservation.service.js
```

Decision flow:

1. Check whether the requested time range is within opening hours
2. Check whether the time slot conflicts with an existing approved reservation
3. If there is no conflict, create the reservation directly
4. If there is a conflict, compare the applicant's priority level
5. A high-priority request can be marked as pending for admin review
6. A normal conflicting request should be rejected

Example:

```js
async function createReservation(user, data) {
  const isOpen = await openingHourService.isRangeOpen(
    data.startTime,
    data.endTime
  );

  if (!isOpen) {
    throw new Error("Reservation time is outside opening hours");
  }

  const conflict = await reservationModel.findConflict(
    data.startTime,
    data.endTime
  );

  if (!conflict) {
    return reservationModel.create({
      ...data,
      userId: user.id,
      priority: user.priority,
      status: "approved"
    });
  }

  if (user.priority > conflict.priority) {
    return reservationModel.create({
      ...data,
      userId: user.id,
      priority: user.priority,
      status: "pending"
    });
  }

  throw new Error("This time slot is already reserved");
}
```

## Database Design

### users

| Field | Description |
| --- | --- |
| id | User ID |
| name | User name |
| email | Email address |
| student_id | Student ID |
| role | User role |
| priority | Reservation priority level |
| created_at | Creation time |

### reservations

| Field | Description |
| --- | --- |
| id | Reservation ID |
| user_id | Reservation owner ID |
| title | Reservation title |
| purpose | Purpose of use |
| start_time | Start time |
| end_time | End time |
| status | Reservation status, such as approved, pending, or rejected |
| priority | Reservation priority level |
| created_at | Creation time |

### opening_hours

| Field | Description |
| --- | --- |
| id | Opening hour ID |
| day_of_week | Day of week |
| open_time | Opening time |
| close_time | Closing time |
| is_open | Whether the space is open on that day |

## MVP Scope

If time is limited, the minimum viable version should include:

1. User login
2. Current MKS usage status
3. Create, view, and cancel reservations
4. Admin view for all reservations
5. Basic reservation conflict checking

After completing the MVP, the following features can be added:

- Reservation approval workflow
- High-priority and low-priority override rules
- Special opening hour settings
- User permission management
- Reservation history search
