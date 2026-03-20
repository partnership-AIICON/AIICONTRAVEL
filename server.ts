import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import nodemailer from "nodemailer";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import axios from "axios";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());
  app.use(cookieParser());

  // Email sending endpoint
  app.post("/api/send-email", async (req, res) => {
    const { formData } = req.body;

    if (!formData) {
      return res.status(400).json({ error: "No form data provided" });
    }

    // Configure SMTP
    // These variables should be set in the environment
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || "587"),
      secure: process.env.SMTP_SECURE?.toLowerCase() === "true", // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const isPostEvent = formData.status === 'POST_EVENT';
    const subjectPrefix = isPostEvent ? "FINAL MISSION REPORT" : "PRE-EVENT STRATEGY";

    const mailOptions = {
      from: `"AI ICON Strategic Portal" <${process.env.SMTP_USER}>`,
      to: "info@aiicon.org, partnership@aiicon.org",
      subject: `[${subjectPrefix}] ${formData.eventName} - ${formData.teamMemberName}`,
      text: `A ${isPostEvent ? 'final mission report' : 'pre-event strategic document'} has been submitted.\n\n` +
            `Event: ${formData.eventName}\n` +
            `Team Member: ${formData.teamMemberName}\n` +
            `Status: ${formData.status}\n\n` +
            `Details:\n` +
            `Location: ${formData.location}\n` +
            `Dates: ${formData.startDate} to ${formData.endDate}\n` +
            `Total Travel Pay: $${formData.totalTravelPay}\n` +
            `${isPostEvent ? `\nStrategic Takeaways:\n- ${formData.takeawayA}\n- ${formData.takeawayB}` : ''}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #00FF00; border-radius: 12px; background: #fafafa;">
          <div style="background: #000; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
            <h1 style="color: #00FF00; margin: 0; font-size: 20px; letter-spacing: 2px;">${subjectPrefix}</h1>
          </div>
          <div style="padding: 20px; background: white; border: 1px solid #eee; border-top: none; border-radius: 0 0 8px 8px;">
            <p style="font-size: 16px; color: #333;">A new <strong>${isPostEvent ? 'Final Mission Report' : 'Pre-Event Strategic Document'}</strong> has been authorized by <strong>${formData.teamMemberName}</strong>.</p>
            
            <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee; color: #666;">Event Name</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee; font-weight: bold; text-align: right;">${formData.eventName}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee; color: #666;">Location</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee; font-weight: bold; text-align: right;">${formData.location}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee; color: #666;">Dates</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee; font-weight: bold; text-align: right;">${formData.startDate} - ${formData.endDate}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee; color: #666;">Travel Pay</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee; font-weight: bold; text-align: right; color: #008000;">$${formData.totalTravelPay}</td>
              </tr>
            </table>

            ${formData.aiAnalysis ? `
            <div style="background: #000; padding: 15px; border-radius: 8px; border: 1px solid #00FF00; margin-bottom: 20px;">
              <h3 style="margin-top: 0; color: #00FF00; font-size: 14px; letter-spacing: 1px;">AI STRATEGIC BRIEFING</h3>
              <p style="color: #fff; font-size: 12px; font-family: monospace; white-space: pre-wrap;">${formData.aiAnalysis}</p>
            </div>
            ` : ''}

            ${isPostEvent ? `
            <div style="background: #f0fff0; padding: 15px; border-radius: 8px; border: 1px solid #00FF00;">
              <h3 style="margin-top: 0; color: #000;">Strategic Takeaways</h3>
              <p><strong>A:</strong> ${formData.takeawayA}</p>
              <p><strong>B:</strong> ${formData.takeawayB}</p>
            </div>
            ` : ''}

            <p style="margin-top: 20px; font-size: 12px; color: #999; text-align: center;">
              This is an automated notification from the AI ICON Strategic Portal.
            </p>
          </div>
        </div>
      `,
    };

    try {
      // Handle Email Notification
      // Only attempt to send if SMTP is configured
      if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
        await transporter.sendMail(mailOptions);
        console.log("Email sent successfully to info@aiicon.org and partnership@aiicon.org");
        res.json({ 
          success: true, 
          message: "Mission data processed successfully",
          emailSent: true
        });
      } else {
        console.warn("SMTP not configured. Email not sent, but logging submission.");
        res.json({ 
          success: true, 
          message: "Mission data logged, but email skipped (SMTP not configured).",
          emailSent: false,
          warning: "Email notification was skipped because SMTP is not configured in environment variables."
        });
      }
    } catch (error) {
      console.error("Error sending email:", error);
      res.status(500).json({ error: "Failed to send email notification" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
