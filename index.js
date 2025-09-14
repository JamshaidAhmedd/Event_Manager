/**
 * index.js - Main application entry point.
 * Sets up the Express server, connects to SQLite database, configures middleware (session, static files, etc.),
 * and defines top-level routes.
 */
const express = require("express");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();
const session = require("express-session");
const { open } = require("sqlite3"); // (optional: not used directly)
require("dotenv").config(); //process.env

const app = express();
const PORT = process.env.PORT || 3000;

// Security best practice: hide Express tech header
app.disable("x-powered-by");

// Set EJS as templating engine and point to views directory
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views")); //routes/views

// Body parser middleware to handle form submissions
app.use(express.urlencoded({ extended: true }));

// Serve static files from "public" directory (for CSS, client-side JS, etc.)
app.use(express.static(path.join(__dirname, "public")));

// Configure session for organiser login (uses a secret from .env or default)
app.use(
  session({
    secret: process.env.SESSION_SECRET || "secret",
    resave: false,
    saveUninitialized: false,
    // Cookie settings (HttpOnly, etc.) - adjust secure flag as needed for production
    cookie: { httpOnly: true, secure: false, sameSite: true },
  })
);
// forums - script
// Connect to SQLite database file
const db = new sqlite3.Database("database.db", (err) => {
  if (err) {
    console.error("Error opening database:", err.message);
  } else {
    console.log("Connected to SQLite database.");
    // Enable foreign key constraints for referential integrity
    db.run("PRAGMA foreign_keys = ON");
  }
});
// Make the database connection accessible in routes via app.locals
app.locals.db = db;

// Define the main home page route (links to organiser and attendee sections)
app.get("/", (req, res) => {
  res.render("main");
});

//http://localhost:3000/attendee/event/123

// Mount the organiser and attendee routers
const organiserRouter = require("./routes/organiser");
const attendeeRouter = require("./routes/attendee");
app.use("/organiser", organiserRouter);
app.use("/attendee", attendeeRouter);

// Start the server on the specified PORT
app.listen(PORT, () => {
  console.log(`Event Manager app listening at http://localhost:${PORT}/`);
});

//GET    /, /organiser, /attendee/event/5
//POST   /organiser/event/new  , /organiser/event/123

//function
