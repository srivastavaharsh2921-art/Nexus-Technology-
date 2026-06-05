const express = require("express");
const cors = require("cors");
const nodemailer = require("nodemailer");
const path = require("path");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5000;
const frontendPath = path.join(__dirname, "..", "..", "frontend");
const requiredMailSettings = ["MAIL_USER", "MAIL_PASS", "MAIL_TO"];
const allowedOrigins = (process.env.FRONTEND_ORIGIN || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

function getMailTransportConfig() {
  if (process.env.MAIL_HOST) {
    const port = Number(process.env.MAIL_PORT || 587);

    return {
      host: process.env.MAIL_HOST,
      port,
      secure: process.env.MAIL_SECURE === "true" || port === 465,
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS,
      },
    };
  }

  return {
    service: process.env.MAIL_SERVICE || "gmail",
    auth: {
      user: process.env.MAIL_USER,
      pass: process.env.MAIL_PASS,
    },
  };
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function createInquiryEmail(inquiry) {
  const subject = `New ${inquiry.project} inquiry from ${inquiry.name}`;
  const text = `
Name: ${inquiry.name}
Email: ${inquiry.email}
Project Type: ${inquiry.project}
Received: ${inquiry.receivedAt}

Message:
${inquiry.message}
  `;
  const safeInquiry = {
    name: escapeHtml(inquiry.name),
    email: escapeHtml(inquiry.email),
    project: escapeHtml(inquiry.project),
    receivedAt: escapeHtml(inquiry.receivedAt),
    message: escapeHtml(inquiry.message).replace(/\n/g, "<br>"),
  };
  const html = `
    <h2>New website inquiry</h2>
    <p><strong>Name:</strong> ${safeInquiry.name}</p>
    <p><strong>Email:</strong> ${safeInquiry.email}</p>
    <p><strong>Project Type:</strong> ${safeInquiry.project}</p>
    <p><strong>Received:</strong> ${safeInquiry.receivedAt}</p>
    <p><strong>Message:</strong></p>
    <p>${safeInquiry.message}</p>
  `;

  return { subject, text, html };
}

async function sendInquiryEmail(inquiry) {
  const email = createInquiryEmail(inquiry);
  const transporter = nodemailer.createTransport(getMailTransportConfig());

  await transporter.sendMail({
    from: process.env.MAIL_USER,
    to: process.env.MAIL_TO,
    replyTo: inquiry.email,
    subject: email.subject,
    text: email.text,
    html: email.html,
  });
}

app.use(
  cors({
    origin(origin, callback) {
      const isLocalhost =
        !origin ||
        origin === "null" ||
        /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);

      if (isLocalhost || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("Not allowed by CORS"));
    },
  })
);
app.use(express.json());
app.use(express.static(frontendPath));

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", service: "Nexus Technologies backend" });
});

app.post("/api/contact", async (req, res) => {
  const { name, email, project, message } = req.body;
  const trimmedName = name?.trim();
  const trimmedEmail = email?.trim();
  const trimmedMessage = message?.trim();
  const selectedProject = project?.trim() || "General Inquiry";

  if (!trimmedName || !trimmedEmail || !trimmedMessage) {
    return res.status(400).json({ message: "Name, email, and message are required." });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
    return res.status(400).json({ message: "Please enter a valid email address." });
  }

  const inquiry = {
    name: trimmedName,
    email: trimmedEmail,
    project: selectedProject,
    message: trimmedMessage,
    receivedAt: new Date().toISOString(),
  };

  const mailReady = requiredMailSettings.every((key) => Boolean(process.env[key]));

  if (!mailReady) {
    console.log("New inquiry received. Add mail settings in .env to send emails:");
    console.table(inquiry);
    return res.json({
      message: "Inquiry received in development mode. Add email settings to send mail.",
    });
  }

  try {
    await sendInquiryEmail(inquiry);

    res.json({ message: "Inquiry sent successfully." });
  } catch (error) {
    console.error("Mail error:", error.message);
    res.status(500).json({ message: "Could not send inquiry." });
  }
});

app.get("/", (req, res) => {
  res.sendFile(path.join(frontendPath, "index.html"));
});

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
