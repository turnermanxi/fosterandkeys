import nodemailer from "nodemailer";
import { generateSqftRange } from "./propertyFormatters";

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
 * @param {array}   [opts.properties] – array of property objects to display
 * @param {string}  [opts.agentName] – agent name to sign with (default: Lorenzo Foster)
 */
export async function sendResultsEmail({
  to,
  clientName,
  resultsUrl,
  aiSummary,
  properties = [],
  agentName = "Lorenzo Foster",
}) {
  const transport = getTransport();

  const firstName = clientName?.split(" ")[0] || "there";

  const summaryHtml = aiSummary
    ? `<div style="background:#f0f4ff;border-left:4px solid #1a3c5e;padding:16px 20px;border-radius:6px;margin:20px 0;font-size:15px;line-height:1.7;color:#1e1e1e;">
        ${aiSummary.replace(/\n/g, "<br>")}
      </div>`
    : "";

  // Build properties list HTML
  let propertiesHtml = "";
  if (properties && properties.length > 0) {
    const propertyCards = properties
      .map((prop) => {
        return `
        <div style="border: 1px solid #ddd; padding: 16px; margin: 16px 0; border-radius: 8px; background: #f9f9f9;">
          <h3 style="margin-top: 0; color: #065f46;">${prop.property_name || "Property"}</h3>
          <p style="margin: 8px 0;">
            <strong>${prop.address}</strong><br>
            ${prop.city}, ${prop.state} ${prop.zip || ""}
          </p>
          ${
            prop.price_min || prop.price_max
              ? `<p style="font-size: 18px; color: #065f46; font-weight: bold; margin: 8px 0;">
                  $${Number(prop.price_min || 0).toLocaleString()} – $${Number(prop.price_max || 0).toLocaleString()}/mo
                </p>`
              : ""
          }
          <p style="margin: 8px 0;">
            <strong>${prop.bedrooms || "–"} BD</strong> | <strong>${prop.bathrooms || "–"} BA</strong>
            ${prop.sqft_min || prop.sqft_max || prop.sqft ? `| <strong>${generateSqftRange(prop)}</strong>` : ""}
          </p>
          ${
            prop.amenities && typeof prop.amenities === "object" && Object.keys(prop.amenities).length > 0
              ? `
            <p style="margin: 8px 0;">
              <strong>Amenities:</strong> ${Object.keys(prop.amenities)
                .filter((k) => prop.amenities[k])
                .join(", ")}
            </p>
          `
              : ""
          }
          ${
            prop.pet_friendly
              ? '<p style="margin: 8px 0;"><strong>✓ Pet Friendly</strong></p>'
              : ""
          }
          ${
            prop.contact_phone || prop.contact_email
              ? `
            <p style="margin: 8px 0;">
              <strong>Contact:</strong>
              ${prop.contact_name ? `${prop.contact_name}` : ""} 
              ${prop.contact_phone ? `| ${prop.contact_phone}` : ""}
              ${prop.contact_email ? `| <a href="mailto:${prop.contact_email}">${prop.contact_email}</a>` : ""}
            </p>
          `
              : ""
          }
          ${
            prop.website
              ? `<p style="margin: 8px 0;"><a href="${prop.website}" style="color: #065f46; text-decoration: none; font-weight: bold;">View Property →</a></p>`
              : ""
          }
          ${
            prop.notes
              ? `<p style="margin: 8px 0; font-style: italic; color: #666;"><strong>Notes:</strong> ${prop.notes}</p>`
              : ""
          }
        </div>
      `;
      })
      .join("");

    propertiesHtml = `<div style="margin: 24px 0;">
      <h2 style="color: #1a3c5e; margin-bottom: 16px;">Featured Properties</h2>
      ${propertyCards}
    </div>`;
  }

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

  <p style="font-size:14px;color:#6b7280;text-align:center;">
    <a href="${resultsUrl}" style="color:#2a5a8a;">Click here to see all your matches</a>
  </p>

  ${propertiesHtml}

  <hr style="border:none;border-top:1px solid #e2e5ea;margin:24px 0;">

  <p style="font-size:15px;margin-bottom:4px;">Best regards,</p>
  <p style="font-size:15px;font-weight:600;color:#1a3c5e;margin:0;">${agentName}</p>
  <p style="font-size:13px;color:#6b7280;margin:2px 0 0;">Foster &amp; Keys Real Estate</p>

</body>
</html>`;

  const text = `Hi ${firstName},

Great news! I've put together a personalized list of apartment matches based on your preferences.

${aiSummary ? aiSummary + "\n\n" : ""}${
    properties && properties.length > 0
      ? `Featured Properties:\n\n${properties
          .map(
            (p) =>
              `${p.property_name || "Property"}\n${p.address}, ${p.city}, ${p.state} ${p.zip || ""}\nPrice: $${Number(
                p.price_min || 0
              ).toLocaleString()} – $${Number(p.price_max || 0).toLocaleString()}/mo\n${p.bedrooms || "–"} BD | ${
                p.bathrooms || "–"
              } BA\n${p.website ? `Visit: ${p.website}` : ""}\n---\n`
          )
          .join("\n")}\n\n`
      : ""
  }View your matches here: ${resultsUrl}

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

/**
 * Send tour confirmation email to client.
 *
 * @param {object}  opts
 * @param {string}  opts.to              – recipient email
 * @param {string}  opts.clientName      – client's first name (for greeting)
 * @param {string}  opts.tourDate        – tour date (YYYY-MM-DD format)
 * @param {string}  [opts.tourTime]      – tour time (HH:MM format) - deprecated
 * @param {array}   opts.properties      – array of {name, bedrooms, bathrooms, rent_range, time} or just {name, bedrooms, bathrooms, rent_range}
 * @param {string}  opts.confirmationUrl – link to tour confirmation page
 * @param {string}  [opts.agentName]     – agent name to sign with
 */
export async function sendTourConfirmationEmail({
  to,
  clientName,
  properties = [],
  confirmationUrl,
  agentName = "Lorenzo Foster",
}) {
  const transport = getTransport();

  const firstName = clientName?.split(" ")[0] || "there";

  // Check if properties have individual dates (new format with per-property scheduling)
  const hasPerPropertyDates = properties.some(p => p.tour_date);
  
  // Format date helper
  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    const dateObj = new Date(dateStr + "T00:00:00");
    return dateObj.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  // Format time helper
  const formatTime = (timeStr) => {
    if (!timeStr) return "";
    const [hours, minutes] = timeStr.split(":");
    const timeObj = new Date(2000, 0, 1, parseInt(hours), parseInt(minutes));
    return timeObj.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const propertiesHtml = properties
    .map((p) => {
      const hasTourInfo = p.tour_date && p.tour_time;
      let tourInfo = "";
      
      if (hasTourInfo) {
        const formattedDate = formatDate(p.tour_date);
        const formattedTime = formatTime(p.tour_time);
        tourInfo = `<br><strong>Scheduled:</strong> ${formattedDate} at ${formattedTime}`;
      }

      // Handle apartment vs unit/property pricing display
      let priceDisplay = "Contact for pricing";
      if (p.type === "apartment") {
        const depositStr = p.deposit ? `Deposit: $${Number(p.deposit).toLocaleString()}` : "";
        const feeStr = p.app_fee ? `App Fee: $${Number(p.app_fee).toLocaleString()}` : "";
        priceDisplay = [depositStr, feeStr].filter(Boolean).join(" • ");
        if (!priceDisplay) priceDisplay = "Contact for pricing";
      } else {
        priceDisplay = p.rent_range || p.price_range || "Contact for pricing";
      }
      
      return `<div style="background:#f9fafb;border-left:3px solid #3b82f6;padding:12px 16px;margin:10px 0;border-radius:4px;">
        <p style="margin:0;font-weight:600;color:#1f2937;">${p.name}</p>
        <p style="margin:4px 0 0;font-size:14px;color:#6b7280;">
          ${p.bedrooms || "?"} bed / ${p.bathrooms || "?"} bath • ${priceDisplay}${tourInfo}
        </p>
      </div>`;
    })
    .join("");

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#1e1e1e;line-height:1.6;max-width:600px;margin:0 auto;padding:20px;">
  
  <div style="text-align:center;padding:24px 0 16px;">
    <h1 style="color:#1a3c5e;font-size:22px;margin:0;">Foster &amp; Keys</h1>
    <p style="color:#6b7280;font-size:14px;margin:4px 0 0;">Your Tours Are Confirmed!</p>
  </div>

  <hr style="border:none;border-top:1px solid #e2e5ea;margin:0 0 24px;">

  <p style="font-size:16px;">Hi ${firstName},</p>

  <p style="font-size:15px;">
    Perfect! I've confirmed your apartment tour schedule. Here are the details:
  </p>

  <div style="background:#ecf5ff;border-left:4px solid #0284c7;padding:20px;border-radius:6px;margin:20px 0;">
    <p style="margin:0 0 12px;font-weight:600;font-size:16px;color:#0c4a6e;">📅 Tour Schedule</p>
    ${hasPerPropertyDates ? `
    <p style="margin:0;font-size:15px;color:#1e293b;">
      Each property has been assigned an individual date and time (see details below).
    </p>
    ` : `
    <p style="margin:0;font-size:15px;color:#1e293b;">
      Refer to the properties below for your scheduled times.
    </p>
    `}
  </div>

  <p style="font-size:15px;font-weight:600;margin:20px 0 12px;">Your Scheduled Properties:</p>
  ${propertiesHtml}

  <p style="font-size:15px;margin:24px 0;">
    Please let me know how the tours go! Once you've visited the properties, 
    click the button below to share your feedback:
  </p>

  <div style="text-align:center;margin:28px 0;">
    <a href="${confirmationUrl}" 
       style="display:inline-block;background:#10b981;color:#ffffff;text-decoration:none;padding:14px 36px;border-radius:8px;font-size:16px;font-weight:600;">
      Confirm Tour Completed
    </a>
  </div>

  <p style="font-size:14px;color:#6b7280;">
    Or copy this link:<br>
    <a href="${confirmationUrl}" style="color:#059669;word-break:break-all;">${confirmationUrl}</a>
  </p>

  <hr style="border:none;border-top:1px solid #e2e5ea;margin:24px 0;">

  <p style="font-size:15px;margin-bottom:4px;">Best regards,</p>
  <p style="font-size:15px;font-weight:600;color:#1a3c5e;margin:0;">${agentName}</p>
  <p style="font-size:13px;color:#6b7280;margin:2px 0 0;">Foster &amp; Keys Real Estate</p>

</body>
</html>`;

  const textPropertiesStr = properties.map((p) => {
    let timeDisplay = "";
    if (p.tour_date && p.tour_time) {
      const formattedDate = formatDate(p.tour_date);
      const formattedTime = formatTime(p.tour_time);
      timeDisplay = ` - Scheduled: ${formattedDate} at ${formattedTime}`;
    }
    
    // Handle apartment vs unit/property pricing display
    let priceDisplay = "Contact for pricing";
    if (p.type === "apartment") {
      const depositStr = p.deposit ? `Deposit: $${Number(p.deposit).toLocaleString()}` : "";
      const feeStr = p.app_fee ? `App Fee: $${Number(p.app_fee).toLocaleString()}` : "";
      priceDisplay = [depositStr, feeStr].filter(Boolean).join(" / ");
      if (!priceDisplay) priceDisplay = "Contact for pricing";
    } else {
      priceDisplay = p.rent_range || p.price_range || "Contact for pricing";
    }
    
    return `• ${p.name} - ${p.bedrooms || "?"} bed / ${p.bathrooms || "?"} bath (${priceDisplay})${timeDisplay}`;
  }).join("\n");

  const text = `Hi ${firstName},

Perfect! I've confirmed your apartment tour schedule.

📅 Tour Schedule
Each property has been assigned an individual date and time (see details below).

Properties Scheduled:
${textPropertiesStr}

Please let me know how the tours go! Once you've visited the properties, confirm here:
${confirmationUrl}

Best regards,
${agentName}
Foster & Keys Real Estate`;

  // Create subject line with tour summary
  const subjectLine = hasPerPropertyDates 
    ? "Your Tours Are Confirmed! — Each property has been scheduled"
    : "Your Tours Are Confirmed!";

  await transport.sendMail({
    from: `"${agentName} — Foster & Keys" <${process.env.GMAIL_USER}>`,
    to,
    subject: subjectLine,
    text,
    html,
  });
}

/**
 * Send application reminder email to client.
 *
 * @param {object}  opts
 * @param {string}  opts.to              – recipient email
 * @param {string}  opts.clientName      – client's name
 * @param {array}   opts.properties      – array of {name} for property names
 * @param {string}  opts.decisionUrl     – link to application decision page
 * @param {string}  [opts.agentName]     – agent name to sign with
 */
export async function sendApplicationReminderEmail({
  to,
  clientName,
  properties = [],
  decisionUrl,
  agentName = "Lorenzo Foster",
}) {
  const transport = getTransport();

  const firstName = clientName?.split(" ")[0] || "there";

  const propertiesHtml = properties
    .map((p) => `<li style="margin:8px 0;">${p.name}</li>`)
    .join("");

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#1e1e1e;line-height:1.6;max-width:600px;margin:0 auto;padding:20px;">
  
  <div style="text-align:center;padding:24px 0 16px;">
    <h1 style="color:#1a3c5e;font-size:22px;margin:0;">Foster &amp; Keys</h1>
    <p style="color:#6b7280;font-size:14px;margin:4px 0 0;">Next Steps for Your Application</p>
  </div>

  <hr style="border:none;border-top:1px solid #e2e5ea;margin:0 0 24px;">

  <p style="font-size:16px;">Hi ${firstName},</p>

  <p style="font-size:15px;">
    Thank you for touring the properties! Now let's get your application started. 
    Here's what you need to do next:
  </p>

  <div style="background:#fef3c7;border-left:4px solid #f59e0b;padding:20px;border-radius:6px;margin:20px 0;">
    <p style="margin:0 0 12px;font-weight:600;font-size:16px;color:#92400e;">📋 Next Steps</p>
    <ul style="margin:0;padding-left:20px;font-size:15px;">
      <li style="margin:8px 0;">Contact the leasing office directly or visit in person</li>
      <li style="margin:8px 0;">Complete the rental application form</li>
      <li style="margin:8px 0;">Provide required documentation (ID, proof of income, references)</li>
    </ul>
  </div>

  <p style="font-size:15px;font-weight:600;margin:20px 0 12px;">Properties You Toured:</p>
  <ul style="margin:0;padding-left:20px;font-size:15px;">${propertiesHtml}</ul>

  <div style="background:#f0fdf4;border-left:4px solid #10b981;padding:20px;border-radius:6px;margin:20px 0;">
    <p style="margin:0 0 12px;font-weight:600;font-size:16px;color:#065f46;">✓ Guest Card Information</p>
    <p style="margin:0;font-size:14px;color:#1e7e5a;">
      Ask about move in specials
    </p>
  </div>

  <p style="font-size:15px;margin:20px 0;">
    Once you've heard back from the properties about your application, let me know the results!
  </p>

  <div style="text-align:center;margin:28px 0;">
    <a href="${decisionUrl}" 
       style="display:inline-block;background:#1a3c5e;color:#ffffff;text-decoration:none;padding:14px 36px;border-radius:8px;font-size:16px;font-weight:600;">
      Report Application Decision
    </a>
  </div>

  <p style="font-size:14px;color:#6b7280;">
    Or copy this link:<br>
    <a href="${decisionUrl}" style="color:#2a5a8a;word-break:break-all;">${decisionUrl}</a>
  </p>

  <hr style="border:none;border-top:1px solid #e2e5ea;margin:24px 0;">

  <p style="font-size:15px;margin-bottom:4px;">Best regards,</p>
  <p style="font-size:15px;font-weight:600;color:#1a3c5e;margin:0;">${agentName}</p>
  <p style="font-size:13px;color:#6b7280;margin:2px 0 0;">Foster &amp; Keys Real Estate</p>

</body>
</html>`;

  const text = `Hi ${firstName},

Thank you for touring the properties! Now let's get your application started.

Next Steps:
1. Contact the leasing office directly or visit in person
2. Complete the rental application form
3. Provide required documentation (ID, proof of income, references)

Properties You Toured:
${properties.map((p) => `• ${p.name}`).join("\n")}

Guest Card Information:
Ask about move in specials

Once you've heard back from the properties about your application, let me know the results:
${decisionUrl}

Best regards,
${agentName}
Foster & Keys Real Estate`;

  await transport.sendMail({
    from: `"${agentName} — Foster & Keys" <${process.env.GMAIL_USER}>`,
    to,
    subject: `Next Steps for Your Application — Foster & Keys`,
    text,
    html,
  });
}

/**
 * Send a property match email with HTML content
 *
 * @param {object}  opts
 * @param {string}  opts.to        – recipient email
 * @param {string}  opts.subject   – email subject
 * @param {string}  opts.html      – rendered HTML email body
 * @param {string}  [opts.from]    – from email (agent email)
 * @param {string}  [opts.agentName] – agent name for signature
 */
export async function sendPropertyEmail({
  to,
  subject,
  html,
  from = process.env.GMAIL_USER,
  agentName = "Lorenzo Foster",
}) {
  const transport = getTransport();

  // Wrap HTML in basic structure if not already wrapped
  const wrappedHtml = html.includes("<html>")
    ? html
    : `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#1e1e1e;line-height:1.6;max-width:600px;margin:0 auto;padding:20px;">
  ${html}
</body>
</html>`;

  await transport.sendMail({
    from: `"${agentName} — Foster & Keys" <${from}>`,
    to,
    subject,
    html: wrappedHtml,
  });
}

/**
 * Send agent notification email when a lead is forwarded to them
 *
 * @param {object}  opts
 * @param {string}  opts.to            – agent email
 * @param {string}  opts.agent_name    – agent name
 * @param {object}  opts.lead          – lead object with details
 * @param {string}  opts.fromAgent     – name of agent forwarding (Lorenzo)
 * @param {string}  opts.dashboardUrl  – URL to dashboard
 */
export async function sendAgentNotificationEmail({
  to,
  agent_name,
  lead,
  fromAgent = "Lorenzo Foster",
}) {
  const transport = getTransport();

  const budgetRange =
    lead.budget_min && lead.budget_max
      ? `$${Number(lead.budget_min).toLocaleString()} – $${Number(lead.budget_max).toLocaleString()}/mo`
      : lead.budget_min
      ? `$${Number(lead.budget_min).toLocaleString()}+/mo`
      : "Contact for pricing";

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#1e1e1e;line-height:1.6;max-width:600px;margin:0 auto;padding:20px;">
  
  <div style="text-align:center;padding:24px 0 16px;">
    <h1 style="color:#1a3c5e;font-size:22px;margin:0;">Foster &amp; Keys</h1>
    <p style="color:#6b7280;font-size:14px;margin:4px 0 0;">New Lead Assignment</p>
  </div>

  <hr style="border:none;border-top:1px solid #e2e5ea;margin:0 0 24px;">

  <p style="font-size:16px;">Hi ${agent_name},</p>

  <p style="font-size:15px;">
    ${fromAgent} has forwarded a lead to you. Here are the details:
  </p>

  <div style="background:#f0f4ff;border-left:4px solid #2563eb;padding:20px;border-radius:6px;margin:20px 0;">
    <h3 style="margin-top:0;color:#1a3c5e;font-size:16px;">Lead: ${lead.name}</h3>
    
    <p style="margin:12px 0 0;">
      <strong>Email:</strong> ${lead.email || "Not provided"}<br>
      <strong>Phone:</strong> ${lead.phone || "Not provided"}<br>
      <strong>Budget:</strong> ${budgetRange}<br>
      ${lead.bedrooms ? `<strong>Bedrooms:</strong> ${lead.bedrooms}` : ""}${lead.bathrooms ? `<br><strong>Bathrooms:</strong> ${lead.bathrooms}` : ""}<br>
      <strong>Desired Location:</strong> ${lead.desired_location || "Not specified"}<br>
      <strong>Move-in Timeline:</strong> ${lead.move_in_timeline || "Not specified"}
    </p>
  </div>

  ${
    lead.notes
      ? `
  <div style="background:#fef3c7;border-left:4px solid #f59e0b;padding:20px;border-radius:6px;margin:20px 0;">
    <p style="margin-top:0;font-weight:600;color:#92400e;">Additional Notes:</p>
    <p style="margin:8px 0 0;font-size:14px;white-space:pre-wrap;">${lead.notes}</p>
  </div>
  `
      : ""
  }

  ${
    lead.cx_feedback
      ? `
  <div style="background:#dbeafe;border-left:4px solid #0284c7;padding:20px;border-radius:6px;margin:20px 0;">
    <p style="margin-top:0;font-weight:600;color:#0c4a6e;">Client Feedback:</p>
    <p style="margin:8px 0 0;font-size:14px;white-space:pre-wrap;">${lead.cx_feedback}</p>
  </div>
  `
      : ""
  }

  <p style="font-size:15px;margin:20px 0;">
    <strong>Round:</strong> Round ${lead.current_round || 1}
  </p>

  <hr style="border:none;border-top:1px solid #e2e5ea;margin:24px 0;">

  <p style="font-size:15px;margin-bottom:4px;">Best regards,</p>
  <p style="font-size:15px;font-weight:600;color:#1a3c5e;margin:0;">${fromAgent}</p>
  <p style="font-size:13px;color:#6b7280;margin:2px 0 0;">Foster &amp; Keys Real Estate</p>

</body>
</html>`;

  const text = `Hi ${agent_name},

${fromAgent} has forwarded a lead to you.

Lead: ${lead.name}
Email: ${lead.email || "Not provided"}
Phone: ${lead.phone || "Not provided"}
Budget: ${budgetRange}
${lead.bedrooms ? `Bedrooms: ${lead.bedrooms}\n` : ""}${lead.bathrooms ? `Bathrooms: ${lead.bathrooms}\n` : ""}Desired Location: ${lead.desired_location || "Not specified"}
Move-in Timeline: ${lead.move_in_timeline || "Not specified"}

${lead.notes ? `Additional Notes:\n${lead.notes}\n\n` : ""}${lead.cx_feedback ? `Client Feedback:\n${lead.cx_feedback}\n\n` : ""}Round: Round ${lead.current_round || 1}

Best regards,
${fromAgent}
Foster & Keys Real Estate`;

  await transport.sendMail({
    from: `"${fromAgent} — Foster & Keys" <${process.env.GMAIL_USER}>`,
    to,
    subject: `Lead Forwarded: ${lead.name} — Foster & Keys`,
    text,
    html,
  });
}
