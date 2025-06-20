# Event Manager

This demo Express application provides a simple event management system with organiser and attendee sections. The organiser dashboard uses the AdminKit template for a modern sidebar layout. All pages now share a unified navbar and the landing page displays a full-width hero background.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Build the SQLite database:
   ```bash
   npm run build-db
   ```
3. Start the server:
   ```bash
   npm start
   ```

The application will be available at `http://localhost:3000`.

## Features

- Organiser login protected by a password (`ORGANISER_PASSWORD` env var, default `admin`).
- Manage site settings, create/edit/publish events and view all bookings.
- Bookings list is ordered by event date and then by booking ID.
- Attendees can view published events and book tickets while availability lasts.
- Landing page with hero background and modern navigation.

All routes use parameterised queries and server-side validation. The interface is styled with the AdminKit template and custom CSS located in `public/main.css`.
