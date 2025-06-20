/**
 * routes/attendee.js - Routes for attendee-facing pages (event listings and booking page).
 */
const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');

/** 
 * GET /attendee 
 * Purpose: Show the attendee home page with a list of all published events.
 * Inputs: None
 * Outputs: Renders attendee_home.ejs with site name/description and a list of upcoming published events.
 */
router.get('/', (req, res) => {
  const db = req.app.locals.db;
  // DB: fetch site information (name and description) for display
  db.get('SELECT name, description FROM site_info WHERE site_id = 1', (err, site) => {
    if (err) {
      console.error("Error fetching site info for attendee page:", err.message);
      return res.status(500).send("Database error");
    }
    // DB: fetch all published events, sorted by event date (ascending)
    const sql = `
      SELECT 
        events.event_id, events.title, events.event_date, 
        events.tickets_full_count, events.tickets_concession_count,
        (SELECT COALESCE(SUM(full_count + concession_count), 0) FROM bookings WHERE event_id = events.event_id) AS sold_total
      FROM events
      WHERE published = 1
      ORDER BY event_date ASC
    `;
    db.all(sql, (err, events) => {
      if (err) {
        console.error("Error fetching published events for attendee:", err.message);
        return res.status(500).send("Database error");
      }
      // Calculate remaining tickets for each event (total remaining = total initial - total sold)
      events.forEach(ev => {
        const totalInitial = ev.tickets_full_count + ev.tickets_concession_count;
        const soldTotal = ev.sold_total || 0;
        let totalRemain = totalInitial - soldTotal;
        if (totalRemain < 0) totalRemain = 0;
        ev.totalRemaining = totalRemain;
        // If event_date is null/empty, mark as TBA for display
        if (!ev.event_date) {
          ev.event_date = 'TBA';
        }
      });
      res.render('attendee_home', { 
        siteName: site ? site.name : 'Events', 
        siteDescription: site ? site.description : '',
        events: events 
      });
    });
  });
});

/** 
 * GET /attendee/event/:id 
 * Purpose: Show details of a specific event and the booking form.
 * Inputs: URL param :id (event ID)
 * Outputs: Renders attendee_event.ejs for the event if published, otherwise 404 if not found or not published.
 */
router.get('/event/:id', (req, res) => {
  const eventId = req.params.id;
  const db = req.app.locals.db;
  // DB: Fetch the event and compute sold tickets for each type
  const sql = `
    SELECT 
      events.event_id, events.title, events.description, events.event_date,
      events.tickets_full_count, events.tickets_concession_count,
      events.full_price, events.concession_price,
      (SELECT COALESCE(SUM(full_count), 0) FROM bookings WHERE event_id = events.event_id) AS sold_full,
      (SELECT COALESCE(SUM(concession_count), 0) FROM bookings WHERE event_id = events.event_id) AS sold_concession
    FROM events
    WHERE event_id = ? AND published = 1
  `;
  db.get(sql, [eventId], (err, event) => {
    if (err) {
      console.error("Error fetching event details for attendee:", err.message);
      return res.status(500).send("Database error");
    }
    if (!event) {
      // Event not found or not published
      return res.status(404).send("Event not available");
    }
    // Calculate remaining tickets for each category
    const remainFull = event.tickets_full_count - event.sold_full;
    const remainConc = event.tickets_concession_count - event.sold_concession;
    event.remain_full = remainFull < 0 ? 0 : remainFull;
    event.remain_concession = remainConc < 0 ? 0 : remainConc;
    // Prepare display of date (if not set, will show 'To be announced')
    if (!event.event_date) {
      event.event_date = null;
    }
    // Check if redirected with success flag
    const successFlag = req.query.success;
    const success = successFlag !== undefined;
    res.render('attendee_event', { event: event, error: null, success: success });
  });
});

/** 
 * POST /attendee/event/:id 
 * Purpose: Process a booking form submission for an event (reserve tickets).
 * Inputs: name (attendee name), full_count, concession_count (number of tickets requested)
 * Outputs: If successful, creates a booking in DB and redirects to event page with success message. On error, re-renders event page with error.
 */
router.post('/event/:id', 
  // Validate form fields
  body('name').trim().notEmpty(),
  body('full_count').optional().isInt({ min: 0 }),
  body('concession_count').optional().isInt({ min: 0 }),
  (req, res) => {
    const errors = validationResult(req);
    const eventId = req.params.id;
    const db = req.app.locals.db;
    // Parse requested ticket quantities (missing fields treated as 0)
    const reqFull = parseInt(req.body.full_count || '0');
    const reqConc = parseInt(req.body.concession_count || '0');
    const attendeeName = req.body.name ? req.body.name.trim() : '';
    if (!errors.isEmpty()) {
      // Name was empty or numbers invalid (should not happen if only optional ints)
      // Fetch event data again to re-render page with error
      const sql = `
        SELECT 
          events.event_id, events.title, events.description, events.event_date,
          events.tickets_full_count, events.tickets_concession_count,
          events.full_price, events.concession_price,
          (SELECT COALESCE(SUM(full_count), 0) FROM bookings WHERE event_id = events.event_id) AS sold_full,
          (SELECT COALESCE(SUM(concession_count), 0) FROM bookings WHERE event_id = events.event_id) AS sold_concession
        FROM events
        WHERE event_id = ? AND published = 1
      `;
      return db.get(sql, [eventId], (err, event) => {
        if (err || !event) {
          console.error("Error loading event for re-render:", err ? err.message : 'Not found');
          return res.status(500).send("Error processing request");
        }
        // Recompute remaining
        const remainFull = event.tickets_full_count - event.sold_full;
        const remainConc = event.tickets_concession_count - event.sold_concession;
        event.remain_full = remainFull < 0 ? 0 : remainFull;
        event.remain_concession = remainConc < 0 ? 0 : remainConc;
        if (!event.event_date) event.event_date = null;
        // Preserve user inputs
        event.bookingNameAttempt = attendeeName;
        event.full_count_attempt = reqFull;
        event.concession_count_attempt = reqConc;
        return res.render('attendee_event', { 
          event: event, 
          error: 'Please enter your name to book tickets.', 
          success: false 
        });
      });
    }
    // At this point, name is provided and ticket quantities are numeric
    // DB: Get current availability for the event to check against request
    const availabilitySql = `
      SELECT tickets_full_count, tickets_concession_count,
             (SELECT COALESCE(SUM(full_count), 0) FROM bookings WHERE event_id = events.event_id) AS sold_full,
             (SELECT COALESCE(SUM(concession_count), 0) FROM bookings WHERE event_id = events.event_id) AS sold_concession
      FROM events
      WHERE event_id = ? AND published = 1
    `;
    db.get(availabilitySql, [eventId], (err, ev) => {
      if (err || !ev) {
        console.error("Error checking availability:", err ? err.message : 'Event not found');
        return res.status(500).send("Could not process booking");
      }
      // Calculate remaining tickets in the database
      const remainFull = ev.tickets_full_count - ev.sold_full;
      const remainConc = ev.tickets_concession_count - ev.sold_concession;
      // Additional validations: must request at least one ticket, and not exceed remaining
      let availabilityError = null;
      if (reqFull === 0 && reqConc === 0) {
        availabilityError = 'Select at least one ticket to book.';
      }
      if (reqFull > remainFull || reqConc > remainConc) {
        availabilityError = 'Not enough tickets available for your request.';
      }
      if (availabilityError) {
        // If availability check fails, re-render page with error and preserve inputs
        const eventData = {
          event_id: eventId,
          title: req.body.title,        // not provided in form, we will fetch from DB again for consistency
          description: req.body.description,  // not in form either
        };
        // Fetch the full event details for rendering (to get title/desc)
        return db.get(
          'SELECT title, description, event_date, full_price, concession_price FROM events WHERE event_id = ?', 
          [eventId], 
          (e, eventInfo) => {
            if (eventInfo) {
              eventData.title = eventInfo.title;
              eventData.description = eventInfo.description;
              eventData.event_date = eventInfo.event_date;
              eventData.full_price = eventInfo.full_price;
              eventData.concession_price = eventInfo.concession_price;
            }
            // Use the computed remain values (ensuring non-negative)
            eventData.remain_full = remainFull < 0 ? 0 : remainFull;
            eventData.remain_concession = remainConc < 0 ? 0 : remainConc;
            if (!eventData.event_date) eventData.event_date = null;
            // Preserve user input for re-display
            eventData.bookingNameAttempt = attendeeName;
            eventData.full_count_attempt = reqFull;
            eventData.concession_count_attempt = reqConc;
            return res.render('attendee_event', { 
              event: eventData, 
              error: availabilityError, 
              success: false 
            });
          }
        );
      }
      // All good: perform the booking
      // DB: Insert a new booking record
      const insertSql = `INSERT INTO bookings (event_id, name, full_count, concession_count) VALUES (?, ?, ?, ?)`;
      db.run(insertSql, [eventId, attendeeName, reqFull, reqConc], (err) => {
        if (err) {
          console.error("Error saving booking:", err.message);
          return res.status(500).send("Database error - booking not saved");
        }
        // Booking saved successfully. Redirect to the same event page with success indicator.
        return res.redirect(`/attendee/event/${eventId}?success=1`);
      });
    });
  }
);

module.exports = router;
