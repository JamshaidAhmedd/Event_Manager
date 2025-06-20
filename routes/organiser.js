/**
 * routes/organiser.js - Routes for organiser (admin) functionality.
 * Includes login/logout, managing events (create, edit, publish, delete), site settings, and viewing bookings.
 */
const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');

// Utility function to get current timestamp in "YYYY-MM-DD HH:MM" format
function getCurrentTimestamp() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hour = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hour}:${min}`;
}

/** 
 * GET /organiser/login 
 * Purpose: Render the organiser login page (password entry).
 * Inputs: Query param `error` (optional) - if set, indicates a previous login failure.
 * Outputs: Login form page. If already logged in, redirects to organiser home.
 */
router.get('/login', (req, res) => {
  if (req.session.loggedIn) {
    // If already authenticated, go straight to organiser home
    return res.redirect('/organiser');
  }
  const errorFlag = req.query.error;
  res.render('organiser_login', { error: errorFlag });
});

/** 
 * POST /organiser/login 
 * Purpose: Authenticate the organiser using a preset password and start a session.
 * Inputs: password (from login form)
 * Outputs: Redirects to organiser home on success, or back to login with error on failure.
 */
router.post('/login', 
  // Validate that password field is not empty
  body('password').notEmpty(), 
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      // If password was not provided, redirect to login with error
      return res.redirect('/organiser/login?error=1');
    }
    const inputPassword = req.body.password;
    const adminPassword = process.env.ORGANISER_PASSWORD || process.env.ADMIN_PASSWORD || 'admin';  // expected password
    if (inputPassword === adminPassword) {
      // Password correct: establish session
      req.session.loggedIn = true;
      return res.redirect('/organiser');
    } else {
      // Password incorrect: redirect back to login with error indicator
      return res.redirect('/organiser/login?error=1');
    }
});

/** 
 * GET /organiser/logout
 * Purpose: Log out the organiser by destroying the session.
 * Inputs: None (uses session cookie to identify session)
 * Outputs: Ends session and redirects to main home page.
 */
router.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');  // Redirect to main page after logout
  });
});

// Middleware to protect all following organiser routes (must be logged in)
router.use((req, res, next) => {
  if (!req.session.loggedIn) {
    return res.redirect('/organiser/login');
  }
  next();
});

/** 
 * GET /organiser 
 * Purpose: Display organiser dashboard/home page with site info and lists of events.
 * Inputs: Session (ensures user is authenticated).
 * Outputs: Renders organiser_home.ejs with site name/description, published events, and draft events.
 */
router.get('/', (req, res) => {
  const db = req.app.locals.db;
  // DB: Retrieve site information (name and description)
  db.get('SELECT name, description FROM site_info WHERE site_id = 1', (err, site) => {
    if (err) {
      console.error("Database error fetching site info:", err.message);
      return res.status(500).send("Database error");
    }
    // DB: Retrieve all published events with their details and sold tickets count
    const publishedSql = `
      SELECT 
        event_id, title, description, event_date, tickets_full_count, tickets_concession_count,
        full_price, concession_price, created_at, published_at,
        -- Calculate sold tickets for each type via subqueries
        (SELECT COALESCE(SUM(full_count), 0) FROM bookings WHERE event_id = events.event_id) AS sold_full,
        (SELECT COALESCE(SUM(concession_count), 0) FROM bookings WHERE event_id = events.event_id) AS sold_concession
      FROM events
      WHERE published = 1
      ORDER BY event_date ASC
    `;
    db.all(publishedSql, (err, publishedEvents) => {
      if (err) {
        console.error("Error fetching published events:", err.message);
        return res.status(500).send("Database error");
      }
      // DB: Retrieve all draft (unpublished) events with their details
      const draftSql = `
        SELECT 
          event_id, title, description, event_date, tickets_full_count, tickets_concession_count,
          full_price, concession_price, created_at, published_at,
          (SELECT COALESCE(SUM(full_count), 0) FROM bookings WHERE event_id = events.event_id) AS sold_full,
          (SELECT COALESCE(SUM(concession_count), 0) FROM bookings WHERE event_id = events.event_id) AS sold_concession
        FROM events
        WHERE published = 0
        ORDER BY created_at DESC
      `;
      db.all(draftSql, (err, draftEvents) => {
        if (err) {
          console.error("Error fetching draft events:", err.message);
          return res.status(500).send("Database error");
        }
        // Compute remaining tickets for each event (initial minus sold), and prepare share links for published
        publishedEvents.forEach(ev => {
          const remainFull = ev.tickets_full_count - ev.sold_full;
          const remainConc = ev.tickets_concession_count - ev.sold_concession;
          ev.remain_full = remainFull < 0 ? 0 : remainFull;
          ev.remain_concession = remainConc < 0 ? 0 : remainConc;
          // Create the attendee page share URL for this event
          ev.shareLink = `${req.protocol}://${req.get('host')}/attendee/event/${ev.event_id}`;
          // If event_date not set, mark as TBA for display
          if (!ev.event_date) ev.event_date = 'TBA';
        });
        draftEvents.forEach(ev => {
          const remainFull = ev.tickets_full_count - ev.sold_full;
          const remainConc = ev.tickets_concession_count - ev.sold_concession;
          ev.remain_full = remainFull < 0 ? 0 : remainFull;
          ev.remain_concession = remainConc < 0 ? 0 : remainConc;
          if (!ev.event_date) ev.event_date = 'TBA';
        });
        res.render('organiser_home', { 
          siteName: site ? site.name : 'Event Manager', 
          siteDescription: site ? site.description : '',
          publishedEvents: publishedEvents,
          draftEvents: draftEvents 
        });
      });
    });
  });
});

/** 
 * GET /organiser/settings
 * Purpose: Show the site settings page where organiser can update site name/description.
 * Inputs: None (just session for auth).
 * Outputs: Renders organiser_settings.ejs with current site name and description.
 */
router.get('/settings', (req, res) => {
  const db = req.app.locals.db;
  // DB: fetch current site settings
  db.get('SELECT name, description FROM site_info WHERE site_id = 1', (err, site) => {
    if (err) {
      console.error("Error loading site settings:", err.message);
      return res.status(500).send("Database error");
    }
    res.render('organiser_settings', { 
      name: site ? site.name : '', 
      description: site ? site.description : '', 
      error: null 
    });
  });
});

/** 
 * POST /organiser/settings
 * Purpose: Update the site name and description.
 * Inputs: name, description (from settings form)
 * Outputs: On success, updates DB and redirects to organiser home. On validation failure, re-renders form with error.
 */
router.post('/settings', 
  // Validate that both fields are filled out (non-empty)
  body('name').trim().notEmpty(),
  body('description').trim().notEmpty(),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      // Validation failed: one or more fields empty
      return res.render('organiser_settings', {
        name: req.body.name,
        description: req.body.description,
        error: 'All fields are required.'  // show error message on page
      });
    }
    const db = req.app.locals.db;
    const newName = req.body.name.trim();
    const newDesc = req.body.description.trim();
    // DB: update site_info with new values (using parameterized query to prevent SQL injection)
    db.run('UPDATE site_info SET name = ?, description = ? WHERE site_id = 1', [newName, newDesc], (err) => {
      if (err) {
        console.error("Error updating site settings:", err.message);
        return res.status(500).send("Database error");
      }
      // Redirect back to organiser home to see updated name/description
      return res.redirect('/organiser');
    });
  }
);

/** 
 * POST /organiser/event/new
 * Purpose: Create a new draft event and redirect to its edit page.
 * Inputs: None (triggered by "Create New Event" button).
 * Outputs: Inserts a new event (with default placeholder values) into the database and redirects to its edit form.
 */
router.post('/event/new', (req, res) => {
  const db = req.app.locals.db;
  const now = getCurrentTimestamp();
  // Prepare default values for a new event (draft)
  const title = 'Untitled Event';
  const description = '';
  const eventDate = null;  // not set yet
  const fullCount = 0;
  const concCount = 0;
  const fullPrice = 0;
  const concPrice = 0;
  // DB: Insert a new event record (draft state)
  db.run(
    `INSERT INTO events 
      (title, description, event_date, tickets_full_count, tickets_concession_count, full_price, concession_price, created_at, updated_at, published) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
    [title, description, eventDate, fullCount, concCount, fullPrice, concPrice, now, now],
    function(err) {
      if (err) {
        console.error("Error creating new event:", err.message);
        return res.status(500).send("Database error");
      }
      // Get the new event's ID and redirect to its edit page
      const newEventId = this.lastID;
      return res.redirect(`/organiser/event/${newEventId}`);
    }
  );
});

/** 
 * GET /organiser/event/:id
 * Purpose: Render the organiser edit-event page for a specific event.
 * Inputs: URL parameter :id (event ID)
 * Outputs: Renders organiser_event_edit.ejs with event data (or 404 if not found).
 */
router.get('/event/:id', (req, res) => {
  const eventId = req.params.id;
  const db = req.app.locals.db;
  // DB: Fetch the event to edit by ID
  db.get('SELECT * FROM events WHERE event_id = ?', [eventId], (err, event) => {
    if (err) {
      console.error("Error loading event for edit:", err.message);
      return res.status(500).send("Database error");
    }
    if (!event) {
      // No such event found
      return res.status(404).send("Event not found");
    }
    // Prepare event date in a format suitable for the datetime-local input (replace space with 'T')
    let eventDateValue = '';
    if (event.event_date) {
      eventDateValue = event.event_date.replace(' ', 'T');
    }
    // Render the edit form with the event data
    res.render('organiser_event_edit', { event: event, eventDateValue: eventDateValue, error: null });
  });
});

/** 
 * POST /organiser/event/:id
 * Purpose: Handle submission of the edit-event form and save changes.
 * Inputs: title, description, event_date, tickets_full_count, tickets_concession_count, full_price, concession_price (from form)
 * Outputs: On success, updates event in DB and redirects to organiser home. On validation error, re-renders form with error messages.
 */
router.post('/event/:id', 
  // Validate and sanitize input fields
  body('title').trim().notEmpty(),
  body('description').trim().notEmpty(),
  body('event_date').notEmpty(),  // must choose a date/time
  body('tickets_full_count').isInt({ min: 0 }),
  body('tickets_concession_count').isInt({ min: 0 }),
  body('full_price').isFloat({ min: 0 }),
  body('concession_price').isFloat({ min: 0 }),
  (req, res) => {
    const errors = validationResult(req);
    const eventId = req.params.id;
    if (!errors.isEmpty()) {
      // Validation failed - re-render edit page with entered values and an error message
      const eventData = { ...req.body };
      eventData.event_id = eventId;
      // Use provided created_at from hidden field (if present) or fetch from DB if missing
      if (!eventData.created_at) {
        eventData.created_at = getCurrentTimestamp();  // fallback (should not happen if hidden field is set)
      }
      // event_date from req.body is already in "YYYY-MM-DDTHH:MM" format (from datetime-local input)
      // We'll use eventDateValue for the input value
      const eventDateValue = req.body.event_date;
      return res.render('organiser_event_edit', { 
        event: eventData, 
        eventDateValue: eventDateValue, 
        error: 'Please fill in all fields correctly.' 
      });
    }
    // All inputs are valid - proceed to update the event
    const db = req.app.locals.db;
    // Prepare updated values
    const updatedTitle = req.body.title.trim();
    const updatedDesc = req.body.description.trim();
    // Convert datetime-local string to space format for storage (e.g., "2025-07-01T14:00" -> "2025-07-01 14:00")
    const eventDate = req.body.event_date ? req.body.event_date.replace('T', ' ') : null;
    const fullCount = parseInt(req.body.tickets_full_count);
    const concCount = parseInt(req.body.tickets_concession_count);
    const fullPrice = parseFloat(req.body.full_price);
    const concPrice = parseFloat(req.body.concession_price);
    const now = getCurrentTimestamp();
    // DB: Update the event record with new values
    db.run(
      `UPDATE events 
       SET title = ?, description = ?, event_date = ?, 
           tickets_full_count = ?, tickets_concession_count = ?, 
           full_price = ?, concession_price = ?, 
           updated_at = ? 
       WHERE event_id = ?`,
      [ updatedTitle, updatedDesc, eventDate, fullCount, concCount, fullPrice, concPrice, now, eventId ],
      (err) => {
        if (err) {
          console.error("Error updating event:", err.message);
          return res.status(500).send("Database error");
        }
        // Successfully saved changes - redirect to organiser home page
        return res.redirect('/organiser');
      }
    );
  }
);

/** 
 * POST /organiser/event/:id/publish
 * Purpose: Publish a draft event (set it to published state and timestamp it).
 * Inputs: None (URL param :id identifies the event)
 * Outputs: Updates the event in DB, then redirects to organiser home.
 */
router.post('/event/:id/publish', (req, res) => {
  const eventId = req.params.id;
  const db = req.app.locals.db;
  const now = getCurrentTimestamp();
  // DB: Update event state to published (only if currently draft)
  db.run(
    'UPDATE events SET published = 1, published_at = ? WHERE event_id = ? AND published = 0',
    [ now, eventId ],
    (err) => {
      if (err) {
        console.error("Error publishing event:", err.message);
        return res.status(500).send("Database error");
      }
      // Redirect back to organiser home to show updated lists
      return res.redirect('/organiser');
    }
  );
});

/** 
 * POST /organiser/event/:id/delete
 * Purpose: Delete an event (draft or published) and all its bookings.
 * Inputs: None (URL param :id identifies the event to delete)
 * Outputs: Removes the event from DB and redirects to organiser home.
 */
router.post('/event/:id/delete', (req, res) => {
  const eventId = req.params.id;
  const db = req.app.locals.db;
  // DB: Delete the event (bookings will cascade delete via foreign key)
  db.run('DELETE FROM events WHERE event_id = ?', [eventId], (err) => {
    if (err) {
      console.error("Error deleting event:", err.message);
      return res.status(500).send("Database error");
    }
    // After deletion, redirect to organiser home page
    return res.redirect('/organiser');
  });
});

/** 
 * GET /organiser/bookings
 * Purpose: Display a page listing all bookings for all events (admin view).
 * Inputs: None
 * Outputs: Renders organiser_bookings.ejs with a list of all booking records (including event info).
 */
router.get('/bookings', (req, res) => {
  const db = req.app.locals.db;
  // DB: Query all bookings joined with their event information
  const sql = `
    SELECT b.booking_id, b.name, b.full_count, b.concession_count,
           e.title, e.event_date 
    FROM bookings AS b 
    JOIN events AS e ON b.event_id = e.event_id
    -- order first by event date then by booking ID
    ORDER BY e.event_date ASC, b.booking_id ASC
  `;
  db.all(sql, (err, rows) => {
    if (err) {
      console.error("Error fetching bookings list:", err.message);
      return res.status(500).send("Database error");
    }
    // Format event date for display, and mark if missing
    rows.forEach(r => {
      if (!r.event_date) {
        r.event_date = 'TBA';
      }
    });
    res.render('organiser_bookings', { bookings: rows });
  });
});

module.exports = router;
