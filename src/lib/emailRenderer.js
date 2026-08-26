/**
 * Render an email template with property and lead data
 * Supports {{property.field}} and {{lead.field}} placeholders
 */
import { generateSqftRange } from "./propertyFormatters";

export function renderEmailTemplate(templateBody, properties, lead, agent) {
  let html = templateBody;

  // Replace lead placeholders
  if (lead) {
    html = html.replace(/\{\{lead\.full_name\}\}/g, lead.full_name || "");
    html = html.replace(/\{\{lead\.desired_location\}\}/g, lead.desired_location || "");
    html = html.replace(/\{\{lead\.email\}\}/g, lead.email || "");
  }

  // Replace agent placeholder
  if (agent) {
    html = html.replace(/\{\{agent\.name\}\}/g, agent.name || "");
    html = html.replace(/\{\{agent\.email\}\}/g, agent.email || "");
  }

  // Build properties list HTML
  let propertiesHtml = "";
  if (properties && properties.length > 0) {
    propertiesHtml = properties
      .map((prop) => {
        return `
        <div style="border: 1px solid #ddd; padding: 16px; margin: 16px 0; border-radius: 8px; background: #f9f9f9;">
          <h3 style="margin-top: 0; color: #065f46;">${prop.property_name || "Property"}</h3>
          <p style="margin: 8px 0;">
            <strong>${prop.address}</strong><br>
            ${prop.city}, ${prop.state} ${prop.zip || ""}
          </p>
          <p style="font-size: 18px; color: #065f46; font-weight: bold; margin: 8px 0;">
            $${Number(prop.price_min || 0).toLocaleString()} – $${Number(prop.price_max || 0).toLocaleString()}
          </p>
          <p style="margin: 8px 0;">
            <strong>${prop.bedrooms || "–"} BD</strong> | <strong>${prop.bathrooms || "–"} BA</strong>
            ${prop.sqft_min || prop.sqft_max || prop.sqft ? `| <strong>${generateSqftRange(prop)}</strong>` : ""}
          </p>
          ${
            prop.amenities && typeof prop.amenities === "object"
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
  }

  // Replace properties placeholder
  html = html.replace(/\{\{properties_list\}\}/g, propertiesHtml);
  html = html.replace(/\{\{#each properties\}\}.*?\{\{\/each\}\}/gs, propertiesHtml);

  return html;
}
