import nodemailer from "nodemailer";

/**
 * Create a reusable Gmail SMTP transport.
 * Uses the same GMAIL_USER and GMAIL_APP_PASSWORD env vars
 * that the IMAP reader uses.
 */
function getTransport() {
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });
}

/**
 * Send the results email to a client.
 *
 * @param {object}  opts
 * @param {string}  opts.to          – recipient email
 * @param {string}  opts.clientName  – client's first name (for greeting)
 * @param {string}  opts.resultsUrl  – full URL to the results page
 * @param {string}  opts.aiSummary   – the (possibly edited) AI summary text
 * @param {string}  [opts.agentName] – agent name to sign with (default: Lorenzo Foster)
 */
export async function sendResultsEmail({
  to,
  clientName,
  resultsUrl,
  aiSummary,
  agentName = "Lorenzo Foster",
}) {
  const transport = getTransport();

  const firstName = clientName?.split(" ")[0] || "there";

  const summaryHtml = aiSummary
    ? `<div style="background:#f0f4ff;border-left:4px solid #1a3c5e;padding:16px 20px;border-radius:6px;margin:20px 0;font-size:15px;line-height:1.7;color:#1e1e1e;">
        ${aiSummary.replace(/\n/g, "<br>")}
      </div>`
    : "";

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#1e1e1e;line-height:1.6;max-width:600px;margin:0 auto;padding:20px;">
  
  <div style="text-align:center;padding:24px 0 16px;">
    <h1 style="color:#1a3c5e;font-size:22px;margin:0;">Foster &amp; Keys</h1>
    <p style="color:#6b7280;font-size:14px;margin:4px 0 0;">Your Apartment Matches Are Ready</p>
  </div>

  <hr style="border:none;border-top:1px solid #e2e5ea;margin:0 0 24px;">

  <p style="font-size:16px;">Hi ${firstName},</p>

  <p style="font-size:15px;">
    Great news! I've put together a personalized list of apartment matches based on your preferences. 
    Click below to view your results:
  </p>

  ${summaryHtml}

  <div style="text-align:center;margin:28px 0;">
    <a href="${resultsUrl}" 
       style="display:inline-block;background:#1a3c5e;color:#ffffff;text-decoration:none;padding:14px 36px;border-radius:8px;font-size:16px;font-weight:600;">
      View Your Matches
    </a>
  </div>

  <p style="font-size:14px;color:#6b7280;">
    Or copy this link into your browser:<br>
    <a href="${resultsUrl}" style="color:#2a5a8a;word-break:break-all;">${resultsUrl}</a>
  </p>

  <hr style="border:none;border-top:1px solid #e2e5ea;margin:24px 0;">

  <p style="font-size:15px;margin-bottom:4px;">Best regards,</p>
  <p style="font-size:15px;font-weight:600;color:#1a3c5e;margin:0;">${agentName}</p>
  <p style="font-size:13px;color:#6b7280;margin:2px 0 0;">Foster &amp; Keys Real Estate</p>

</body>
</html>`;

  const text = `Hi ${firstName},

Great news! I've put together a personalized list of apartment matches based on your preferences.

${aiSummary ? aiSummary + "\n\n" : ""}View your matches here: ${resultsUrl}

Best regards,
${agentName}
Foster & Keys Real Estate`;

  await transport.sendMail({
    from: `"${agentName} — Foster & Keys" <${process.env.GMAIL_USER}>`,
    to,
    subject: `Your Apartment Matches Are Ready — Foster & Keys`,
    text,
    html,
  });
}
