import { loadModel, getModel } from "../models.js";

const FALLBACK_CAPTION = "Caption unavailable";

function capitalizeFirstLetter(text) {
  if (!text) {
    return text;
  }

  return text.charAt(0).toUpperCase() + text.slice(1);
}

function cleanCaption(text) {
  return capitalizeFirstLetter(text.trim());
}

function extractGeneratedText(output) {
  if (!output) {
    return "";
  }

  if (typeof output === "string") {
    return output;
  }

  if (Array.isArray(output)) {
    const first = output[0];
    if (typeof first === "string") {
      return first;
    }
    if (first?.generated_text) {
      return first.generated_text;
    }
  }

  if (output.generated_text) {
    return output.generated_text;
  }

  return "";
}

export async function generateCaption(imageSrc) {
  try {
    await loadModel("captioner");
    const model = getModel("captioner");
    const output = await model(imageSrc);
    const caption = cleanCaption(extractGeneratedText(output));

    return caption || FALLBACK_CAPTION;
  } catch {
    return FALLBACK_CAPTION;
  }
}

export function updateGalleryCaption(imageId, caption) {
  const captionEl = document.querySelector(
    `.gallery-card[data-id="${String(imageId)}"] .gallery-card__caption`,
  );

  if (captionEl) {
    captionEl.textContent = caption;
  }
}

export function renderCaptionResult(caption) {
  const safeCaption = caption?.trim() || FALLBACK_CAPTION;

  return `<blockquote class="caption-result">${safeCaption}</blockquote>`;
}
