# Project Changes Log

## [2026-06-04] Added Seat Occupancy Display to Reservation Calendar

- **File Modified:** [ReservationModal.tsx](file:///c:/Codes/Info-Department-Final-Project/frontend/src/app/components/ReservationModal.tsx)
- **Feature description:** Added a visual indicator showing the number of occupied seats vs total capacity (e.g. `3/8`) directly within each grid slot in the availability matrix. This specifically helps users see the live occupancy of the Soldering Table (which has 8 seats) and other collaborative areas at any given time.
- **Verification:** Verified that the backend correctly calculates seat usage for overlapping time periods using participant counts and that the frontend displays it inside the grid buttons.
