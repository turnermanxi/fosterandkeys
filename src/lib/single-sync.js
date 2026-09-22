import {
  extractPropertyDataFromHTML,
  extractPropertyDataFromScreenshot,
} from "@/lib/propertyExtractor";
import { comparePropertyData } from "@/lib/propertyComparator";

/**
 * Fetch a property's source URL, extract its data (simple HTML or advanced
 * screenshot/vision), and compare against the current property data.
 *
 * Shared by the interactive sync-preview route and the automated auto-sync
 * route so both use an identical pipeline.
 *
 * @param {object} property – property/apartment row (must have source_url)
 * @param {string} mode     – 'simple' | 'advanced'
 * @returns {Promise<{ ok: true, comparison, extractedData, extractionMethod } |
 *                   { ok: false, error, property }>}
 */
export async function generateSyncPreview(property, mode = "simple") {
  try {
    if (!property?.source_url) {
      return {
        ok: false,
        error: "No source URL configured for this property",
        property,
      };
    }

    let extractedData;
    let extractionMethod;

    const fetchHtml = async () => {
      const response = await fetch(property.source_url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
        timeout: 10000,
      });
      if (!response.ok) {
        return {
          ok: false,
          error: `Failed to fetch from source URL: ${response.status} ${response.statusText}`,
        };
      }
      return { ok: true, html: await response.text() };
    };

    if (mode === "advanced") {
      try {
        const result = await extractPropertyDataFromScreenshot(
          property.source_url,
          property
        );
        if (result.success) {
          extractionMethod = "screenshot";
          extractedData = result;
        } else {
          console.warn(
            "Advanced extraction failed, falling back to simple mode:",
            result.error
          );
          extractionMethod = "html_fallback";
          const htmlRes = await fetchHtml();
          if (!htmlRes.ok) return htmlRes;
          extractedData = await extractPropertyDataFromHTML(
            htmlRes.html,
            property.source_url
          );
        }
      } catch (extractError) {
        return {
          ok: false,
          error: `Failed to extract property data (advanced mode): ${extractError.message}`,
          property,
        };
      }
    } else {
      extractionMethod = "html";
      const htmlRes = await fetchHtml();
      if (!htmlRes.ok) return htmlRes;
      try {
        extractedData = await extractPropertyDataFromHTML(
          htmlRes.html,
          property.source_url
        );
      } catch (extractError) {
        return {
          ok: false,
          error: `Failed to fetch source URL: ${extractError.message}`,
          property,
        };
      }
    }

    if (!extractedData.success) {
      console.error(
        "Extraction failed:",
        extractedData.error,
        "Mode:",
        mode
      );
      return {
        ok: false,
        error: `Failed to extract property data: ${extractedData.error || "Unknown error"}`,
        property,
      };
    }

    const extractedDataObj = extractedData.data || extractedData;

    const comparison = comparePropertyData(extractedDataObj, property, {
      priceChangeThreshold: 0.2,
    });

    return {
      ok: true,
      comparison,
      extractedData: extractedDataObj,
      extractionMethod,
    };
  } catch (error) {
    console.error("Sync preview error:", error);
    return {
      ok: false,
      error: error.message || "Internal server error",
      property,
    };
  }
}