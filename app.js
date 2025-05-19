require("dotenv").config();

const https = require("https");

const agent = new https.Agent({
  rejectUnauthorized: false,
});

const express = require("express");
const mongoose = require("mongoose");
const path = require("path");
const expressLayouts = require("express-ejs-layouts");
const nodemailer = require("nodemailer");
const Reminder = require("./models/reminder");
const { log } = require("console");
const { title } = require("process");
const cron = require("node-cron");

const app = express();

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.use(expressLayouts);

// EJS setup
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.set("layout", "layout"); // This refers to views/layout.ejs

// MongoDB
mongoose
  .connect(process.env.CONNECTION_URL)
  .then(() => console.log("Connected to DB"))
  .catch((error) =>
    console.log(`Error connecting to MongoDB: ${error.message}`)
  );

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER, // your Gmail address
    pass: process.env.EMAIL_PASS, // your Gmail App Password
  },
  tls: {
    rejectUnauthorized: false, // ← THIS bypasses self-signed cert error
  },
});

// Routes

app.get("/", (req, res) => {
  res.render("index", {
    title: "Email Reminder",
    currentPage: "home",
  });
});

app.get("/about", (req, res) => {
  res.render("about", {
    title: "About -Email reminder App",
    currentPage: "about",
  });
});

app.get("/schedule", (req, res) => {
  res.render("schedule", {
    title: "Schedule Reminder",
    currentPage: "schedule",
  });
});

//logic for schedule

app.post("/schedule", async (req, res) => {
  try {
    const { email, message, datetime } = req.body;

    const reminder = new Reminder({
      email,
      message,
      scheduleTime: new Date(datetime),
    });

    await reminder.save();
    console.log(reminder);

    res.redirect("/schedule?success=true");
  } catch (error) {
    console.log(error.message);

    res.redirect("/schedule?error=true");
  }
});

app.get("/reminders", async (req, res) => {
  try {
    const reminders = await Reminder.find().sort({ scheduleTime: 1 });

    res.render("reminders", {
      reminders,
      title: "",
      currentPage: "reminders",
    });
  } catch (error) {}
});

cron.schedule("* * * * *", async () => {
  try {
    const now = new Date();

    const reminders = await Reminder.find({
      scheduleTime: { $lte: now },
      sent: false,
    });

    for (const reminder of reminders) {
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: reminder.email,
        subject: "Reminder App",
        text: reminder.message, // ✅ fixed
      });

      console.log(`Reminder sent to ${reminder.email}`);

      reminder.sent = true;
      await reminder.save();
    }
  } catch (error) {
    console.log("Error sending reminder", error);
  }
});

const PORT = process.env.PORT || 3333;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
