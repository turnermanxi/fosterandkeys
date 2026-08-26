/**
 * Property Extractor
 * 
 * Handles OpenAI-powered extraction of property data from HTML.
 * This is NOT an autonomous agent - only parses and normalizes data per backend instructions.
 */

import { OpenAI } from 'openai';
import { chromium } from 'playwright';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Extraction schema - defines what fields we expect to extract
 */
const EXTRACTION_SCHEMA = {
  property_name: { type: 'string', description: 'Name or title of the property' },
  address: { type: 'string', description: 'Full street address' },
  city: { type: 'string', description: 'City name' },
  state: { type: 'string', description: 'State code (e.g., TX)' },
  zip: { type: 'string', description: 'Zip code' },
  bedrooms: { type: 'integer', description: 'Number of bedrooms (single value, deprecated - use bedrooms_min/max)' },
  bedrooms_min: { type: 'integer', description: 'Minimum bedrooms available (e.g., studios are 0)' },
  bedrooms_max: { type: 'integer', description: 'Maximum bedrooms available' },
  bathrooms: {
    type: 'number',
    description: 'Number of bathrooms (can be decimal)',
  },
  sqft_min: { type: 'integer', description: 'Minimum square footage (for floor plans with ranges)' },
  sqft_max: { type: 'integer', description: 'Maximum square footage (for floor plans with ranges)' },
  sqft: { type: 'integer', description: 'Square footage (single value, use sqft_min and sqft_max for ranges)' },
  price_min: { type: 'number', description: 'Minimum rent/price' },
  price_max: { type: 'number', description: 'Maximum rent/price' },
  property_type: {
    type: 'string',
    enum: ['apartment', 'house', 'condo', 'townhouse', 'other'],
    description: 'Type of property',
  },
  pet_friendly: { type: 'boolean', description: 'Are pets allowed?' },
  accepts_evictions: {
    type: 'boolean',
    description: 'Does landlord accept tenants with evictions?',
  },
  accepts_broken_leases: {
    type: 'boolean',
    description: 'Does landlord accept broken leases?',
  },
  accepts_low_credit: {
    type: 'boolean',
    description: 'Does landlord accept low credit scores?',
  },
  app_fee: { type: 'number', description: 'Application fee' },
  admin_fee: { type: 'number', description: 'Admin or processing fee' },
  deposit_info: { type: 'string', description: 'Deposit requirements' },
  amenities: {
    type: 'array',
    items: { type: 'string' },
    description: 'List of amenities',
  },
  contact_name: { type: 'string', description: 'Contact person name' },
  contact_phone: { type: 'string', description: 'Contact phone number' },
  contact_email: { type: 'string', description: 'Contact email address' },
  website: { type: 'string', description: 'Official website URL' },
  specials: { type: 'string', description: 'Current specials, promotions, or move-in offers' },
};

/**
 * Extract property data from HTML using OpenAI
 * 
 * @param {string} htmlContent - Raw HTML content from property page
 * @param {string} sourceUrl - Source URL (for context)
 * @param {object} existingProperty - Optional existing property data (for context)
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
 */
export async function extractPropertyDataFromHTML(
  htmlContent,
  sourceUrl,
  existingProperty = null
) {
  try {
    // Validate inputs
    if (!htmlContent || typeof htmlContent !== 'string') {
      throw new Error('Invalid HTML content provided');
    }

    // Truncate HTML to reasonable size to avoid token limits
    const truncatedHTML = htmlContent.substring(0, 15000);

    // Build system prompt
    const systemPrompt = `You are a structured data extraction assistant for real estate property listings.
Your ONLY job is to extract and normalize factual data from provided HTML.
You are NOT an agent. You follow this schema strictly and return valid JSON.
Return ONLY valid JSON with no explanations or markdown formatting.
For fields you cannot find, use null (not undefined).
Never invent or assume data.

IMPORTANT BEDROOM EXTRACTION RULES:
- Extract bedrooms_min and bedrooms_max to support properties with multiple floor plans
- Studios are bedrooms_min=0
- If you find "1BR/2BR/3BR available", set bedrooms_min=1, bedrooms_max=3
- If property offers units with 0-3 bedrooms, set bedrooms_min=0, bedrooms_max=3
- The legacy "bedrooms" field should only be used if ONLY ONE specific bedroom count is mentioned
- Always prefer the min/max format when property offers multiple bedroom options`;

    // Build user prompt
    const userPrompt = `Extract property information from this HTML. 
Source URL: ${sourceUrl}
${existingProperty ? `Current property ID: ${existingProperty.id}` : ''}

Return a JSON object with these fields (use null for missing values):
${JSON.stringify(EXTRACTION_SCHEMA, null, 2)}

BEDROOM EXTRACTION GUIDANCE:
- Look for phrases like "Studio through 3 bedroom", "0-3 BR", "available in 1, 2, and 3 bedroom"
- Extract the minimum and maximum bedroom counts available
- For properties with just one floor plan, use bedrooms_min and bedrooms_max to capture that single value range

HTML Content:
${truncatedHTML}`;

    // Call OpenAI with structured output
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0,
      max_tokens: 2000,
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: userPrompt,
        },
      ],
    });

    const responseText = response.choices[0]?.message?.content?.trim();

    if (!responseText) {
      throw new Error('No response from OpenAI');
    }

    // Parse JSON response - handle markdown code blocks
    let extractedData;
    try {
      // Strip markdown code block formatting if present
      let jsonText = responseText.trim();
      if (jsonText.startsWith('```json')) {
        jsonText = jsonText.slice(7); // Remove ```json
      } else if (jsonText.startsWith('```')) {
        jsonText = jsonText.slice(3); // Remove ```
      }
      if (jsonText.endsWith('```')) {
        jsonText = jsonText.slice(0, -3); // Remove trailing ```
      }
      jsonText = jsonText.trim();
      
      extractedData = JSON.parse(jsonText);
    } catch (parseError) {
      throw new Error(`Failed to parse OpenAI response as JSON: ${parseError.message}`);
    }

    // Validate extracted data
    const validatedData = validateExtractedData(extractedData);

    return {
      success: true,
      data: validatedData,
      rawResponse: extractedData,
    };
  } catch (error) {
    console.error('Error extracting property data:', error);
    return {
      success: false,
      error: error.message || 'Unknown extraction error',
    };
  }
}

/**
 * Validate and normalize extracted data
 * 
 * @param {object} data - Raw extracted data from OpenAI
 * @returns {object} Validated and normalized data
 */
function validateExtractedData(data) {
  const validated = {};

  // String fields
  const stringFields = [
    'property_name',
    'address',
    'city',
    'state',
    'zip',
    'property_type',
    'deposit_info',
    'contact_name',
    'contact_phone',
    'contact_email',
    'website',
    'specials',
  ];
  stringFields.forEach((field) => {
    if (data[field] && typeof data[field] === 'string') {
      validated[field] = data[field].trim() || null;
    } else {
      validated[field] = null;
    }
  });

  // Integer fields
  const intFields = ['bedrooms', 'bedrooms_min', 'bedrooms_max', 'sqft', 'sqft_min', 'sqft_max'];
  intFields.forEach((field) => {
    if (data[field] !== null && data[field] !== undefined) {
      const num = parseInt(data[field], 10);
      // For bedrooms_min, allow 0 (studios); for others require > 0
      if (field === 'bedrooms_min') {
        validated[field] = !isNaN(num) && num >= 0 ? num : null;
      } else {
        validated[field] = !isNaN(num) && num > 0 ? num : null;
      }
    } else {
      validated[field] = null;
    }
  });

  // Decimal fields
  const decimalFields = ['bathrooms', 'price_min', 'price_max', 'app_fee', 'admin_fee'];
  decimalFields.forEach((field) => {
    if (data[field] !== null && data[field] !== undefined) {
      const num = parseFloat(data[field]);
      validated[field] = !isNaN(num) && num >= 0 ? num : null;
    } else {
      validated[field] = null;
    }
  });

  // Boolean fields
  const boolFields = ['pet_friendly', 'accepts_evictions', 'accepts_broken_leases', 'accepts_low_credit'];
  boolFields.forEach((field) => {
    if (data[field] !== null && data[field] !== undefined) {
      validated[field] = Boolean(data[field]);
    } else {
      validated[field] = null;
    }
  });

  // Array fields
  if (Array.isArray(data.amenities)) {
    validated.amenities = data.amenities
      .filter((item) => typeof item === 'string' && item.trim())
      .map((item) => item.trim())
      .slice(0, 50); // Limit to 50 amenities
  } else {
    validated.amenities = null;
  }

  return validated;
}

/**
 * Batch extract multiple properties
 * 
 * @param {array} properties - Array of {htmlContent, sourceUrl, existingProperty}
 * @param {number} delayMs - Delay between requests to avoid rate limiting
 * @returns {Promise<array>} Array of extraction results
 */
export async function batchExtractProperties(properties, delayMs = 500) {
  const results = [];

  for (let i = 0; i < properties.length; i++) {
    const property = properties[i];
    const result = await extractPropertyDataFromHTML(
      property.htmlContent,
      property.sourceUrl,
      property.existingProperty
    );
    results.push(result);

    // Rate limiting: add delay between requests
    if (i < properties.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return results;
}

/**
 * Get extraction stats for monitoring
 * 
 * @param {array} results - Results from batchExtractProperties
 * @returns {object} Stats
 */
export function getExtractionStats(results) {
  return {
    total: results.length,
    successful: results.filter((r) => r.success).length,
    failed: results.filter((r) => !r.success).length,
    successRate: (results.filter((r) => r.success).length / results.length) * 100,
  };
}

/**
 * Extract property data from screenshot using OpenAI vision API
 * 
 * @param {string} sourceUrl - URL to fetch screenshot from
 * @param {object} existingProperty - Optional existing property data (for context)
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
 */
export async function extractPropertyDataFromScreenshot(
  sourceUrl,
  existingProperty = null
) {
  let browser = null;
  try {
    // Validate URL
    if (!sourceUrl || typeof sourceUrl !== 'string') {
      throw new Error('Invalid source URL provided');
    }

    // Launch browser
    browser = await chromium.launch({
      headless: true,
      args: ['--disable-blink-features=AutomationControlled'],
    });

    // Create context with user agent
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      viewport: { width: 1280, height: 720 },
    });

    const page = await context.newPage();

    // Navigate with timeout
    await page.goto(sourceUrl, {
      waitUntil: 'load',
      timeout: 15000,
    });

    // Wait for content to render
    await page.waitForTimeout(1000);

    // Take screenshot
    const screenshot = await page.screenshot({ fullPage: true });
    const base64Screenshot = screenshot.toString('base64');

    // Close browser
    await browser.close();
    browser = null;

    // Build system prompt for vision
    const systemPrompt = `You are a specialized real estate property extraction assistant using computer vision.
Your ONLY job is to analyze the screenshot of a property listing page and extract structured data.
You are NOT an agent. You follow this schema strictly and return valid JSON.
Return ONLY valid JSON with no explanations or markdown formatting.
For fields you cannot find or see clearly, use null (not undefined).
Never invent or assume data.`;

    // Build user prompt for vision
    const userPrompt = `Analyze this screenshot of a property listing and extract property information.
Source URL: ${sourceUrl}
${existingProperty ? `Current property ID: ${existingProperty.id}` : ''}

Return a JSON object with these fields (use null for missing values):
${JSON.stringify(EXTRACTION_SCHEMA, null, 2)}

Important: Look at ALL visible text and numbers in the image, including prices shown in graphics, floor plans, unit details, etc.
Be thorough and extract everything you can see.`;

    // Call OpenAI with vision
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',  // Using full gpt-4o for vision capabilities
      temperature: 0,
      max_tokens: 2000,
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: userPrompt,
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/png;base64,${base64Screenshot}`,
                detail: 'high',  // High detail for maximum extraction
              },
            },
          ],
        },
      ],
    });

    const responseText = response.choices[0]?.message?.content?.trim();

    if (!responseText) {
      throw new Error('No response from OpenAI vision API');
    }

    // Parse JSON response - handle markdown code blocks from OpenAI
    let extractedData;
    try {
      // Strip markdown code block formatting if present
      let jsonText = responseText.trim();
      if (jsonText.startsWith('```json')) {
        jsonText = jsonText.slice(7); // Remove ```json
      } else if (jsonText.startsWith('```')) {
        jsonText = jsonText.slice(3); // Remove ```
      }
      if (jsonText.endsWith('```')) {
        jsonText = jsonText.slice(0, -3); // Remove trailing ```
      }
      jsonText = jsonText.trim();
      
      extractedData = JSON.parse(jsonText);
    } catch (parseError) {
      throw new Error(
        `Failed to parse OpenAI vision response as JSON: ${parseError.message}`
      );
    }

    // Validate extracted data
    const validatedData = validateExtractedData(extractedData);

    return {
      success: true,
      data: validatedData,
      rawResponse: extractedData,
    };
  } catch (error) {
    console.error('Error extracting property data from screenshot:', error);

    // Ensure browser is closed on error
    if (browser) {
      await browser.close().catch((e) => console.log('Browser close error:', e));
    }

    return {
      success: false,
      error: error.message || 'Unknown extraction error from screenshot',
    };
  }
}
