const nodemailer = require("nodemailer");

const requiredMailSettings = ["MAIL_USER", "MAIL_PASS", "MAIL_TO"];

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

function getRequestBody(req) {
  if (typeof req.body === "string") {
    return JSON.parse(req.body);
  }

  return req.body || {};
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ message: "Method not allowed." });
  }

  let body;

  try {
    body = getRequestBody(req);
  } catch (error) {
    return res.status(400).json({ message: "Invalid JSON request body." });
  }

  const { name, email, project, message } = body;
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
    console.log("New inquiry received. Add Vercel environment variables to send emails:");
    console.table(inquiry);
    return res.json({
      message: "Inquiry received. Add email settings in Vercel to send mail.",
    });
  }

  try {
    await sendInquiryEmail(inquiry);

    return res.json({ message: "Inquiry sent successfully." });
  } catch (error) {
    console.error("Mail error:", error.message);
    return res.status(500).json({ message: "Could not send inquiry." });
  }
};
