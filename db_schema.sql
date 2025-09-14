-- Drop existing tables if they exist (including template sample tables)
DROP TABLE IF EXISTS bookings;

DROP TABLE IF EXISTS events;

DROP TABLE IF EXISTS site_info;

DROP TABLE IF EXISTS users;

DROP TABLE IF EXISTS email_accounts;

-- Site information table (holds site name and description)
CREATE TABLE
    site_info (
        site_id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT NOT NULL
    );

--validation rules
--notEmpty();
--inFloat({min:0});
--trim();
-- Events table (holds event details)
CREATE TABLE
    events (
        event_id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        event_date TEXT, -- when the event is scheduled (null or empty if not set)
        tickets_full_count INTEGER NOT NULL,
        tickets_concession_count INTEGER NOT NULL,
        full_price REAL NOT NULL,
        concession_price REAL NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        published INTEGER NOT NULL DEFAULT 0,
        published_at TEXT
    );

-- Bookings table (holds attendee bookings for events)
CREATE TABLE
    bookings (
        booking_id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id INTEGER NOT NULL,
        name TEXT NOT NULL, -- attendee name
        full_count INTEGER NOT NULL, -- number of full-price tickets booked
        concession_count INTEGER NOT NULL, -- number of concession tickets booked
        FOREIGN KEY (event_id) REFERENCES events (event_id) ON DELETE CASCADE
    );

-- Insert default site info (initial site name and description)
INSERT INTO
    site_info (site_id, name, description)
VALUES
    (1, 'My Event Manager', 'Event management system');