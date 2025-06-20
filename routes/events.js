const express = require("express");
const router = express.Router();

// list all events
router.get("/list-events", (req, res, next) => {
    const query = "SELECT * FROM events";
    global.db.all(query, [], function(err, rows) {
        if (err) {
            next(err);
        } else {
            res.render("list-events.ejs", { events: rows });
        }
    });
});

// display form to add event
router.get("/add-event", (req, res) => {
    res.render("add-event.ejs");
});

// create a new event
router.post("/add-event", (req, res, next) => {
    const query = "INSERT INTO events (event_name, event_date, capacity, published) VALUES (?, ?, ?, 0)";
    const params = [req.body.event_name, req.body.event_date, req.body.capacity];
    global.db.run(query, params, function(err) {
        if (err) {
            next(err);
        } else {
            res.redirect('/events/list-events');
        }
    });
});

module.exports = router;
