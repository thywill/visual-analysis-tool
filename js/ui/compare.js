import { detectObjects } from "../analysis/objects.js";
import { extractColors } from "../analysis/color.js";
import { generateCaption } from "../analysis/caption.js";
import { analyzeComposition } from "../analysis/composition.js";
import { detectEmotion, shouldRunEmotion } from "../analysis/emotion.js";
import { getSettings } from "./sidebar.js";
import { returnToGallery } from "./deep.js";

let compareView = null;

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function findSharedObjectLabels(resultsByImage) {
  const labelImageCounts = new Map();

  for (const results of resultsByImage) {
    const labelsInImage = new Set(
      results.objects?.map((object) => object.label.toLowerCase()) ?? [],
    );

    for (const label of labelsInImage) {
      labelImageCounts.set(label, (labelImageCounts.get(label) || 0) + 1);
    }
  }

  return new Set(
    [...labelImageCounts.entries()]
      .filter(([, count]) => count >= 2)
      .map(([label]) => label),
  );
}

function renderColorMetric(colors) {
  if (!colors?.length) {
    return "<p class=\"compare-metric__empty\">No colors detected.</p>";
  }

  const topColors = colors.slice(0, 3);
  const colorList = topColors
    .map(
      (color) =>
        `<li class="compare-color-item">
          <span class="compare-color-item__swatch" style="background-color: ${color.hex}"></span>
          <span class="compare-color-item__hex">${color.hex}</span>
          <span class="compare-color-item__percentage">${color.percentage}%</span>
        </li>`,
    )
    .join("");

  return `<ul class="compare-color-list">${colorList}</ul>`;
}

function updateColumnColorStrip(imageId, colors) {
  if (!compareView) {
    return;
  }

  const strip = compareView.querySelector(
    `.compare-column[data-image-id="${String(imageId)}"] .compare-column__color-strip`,
  );

  if (!strip) {
    return;
  }

  strip.replaceChildren();

  if (!colors?.length) {
    return;
  }

  for (const color of colors) {
    const segment = document.createElement("div");
    segment.className = "compare-column__color-segment";
    segment.style.backgroundColor = color.hex;
    segment.style.flexGrow = String(color.percentage);
    segment.style.flexBasis = "0";
    strip.appendChild(segment);
  }
}

function renderObjectsMetric(objects, sharedLabels) {
  if (!objects?.length) {
    return "<p class=\"compare-metric__empty\">No objects detected.</p>";
  }

  const items = objects
    .map((object) => {
      const isShared = sharedLabels.has(object.label.toLowerCase());
      return `<li class="compare-object-item${isShared ? " compare-object-item--shared" : ""}">
        <span class="compare-object-item__label">${escapeHtml(object.label)}</span>
        <span class="compare-object-item__score">${object.score}</span>
      </li>`;
    })
    .join("");

  return `<ul class="compare-object-list">${items}</ul>`;
}

function renderCompositionMetric(composition) {
  if (!composition) {
    return "<p class=\"compare-metric__empty\">Composition unavailable.</p>";
  }

  return `
    <ul class="compare-composition-list">
      <li><span>Orientation</span><strong>${escapeHtml(composition.orientation)}</strong></li>
      <li><span>Brightness</span><strong>${composition.brightnessScore}</strong></li>
      <li><span>Contrast</span><strong>${composition.contrastScore}</strong></li>
      <li><span>Lighting</span><strong>${escapeHtml(composition.lightingType)}</strong></li>
    </ul>
  `;
}

function renderEmotionMetric(emotion) {
  if (!emotion) {
    return "<p class=\"compare-metric__empty\">Emotion unavailable.</p>";
  }

  if (
    emotion.primaryEmotion === "No face detected" ||
    !emotion.allEmotions?.length
  ) {
    return "<p class=\"compare-metric__empty\">No face detected.</p>";
  }

  return `
    <p class="compare-emotion-primary">${escapeHtml(emotion.primaryEmotion)}</p>
    <p class="compare-emotion-score">Confidence: ${emotion.primaryScore}</p>
  `;
}

function buildMetricRow(label, contentHtml, metricKey) {
  return `
    <div class="compare-metric" data-metric="${metricKey}">
      <span class="compare-metric__label">${label}</span>
      <div class="compare-metric__content">${contentHtml}</div>
    </div>
  `;
}

function buildColumnMetrics(image, results, sharedLabels, analysisSettings) {
  const rows = [];

  if (analysisSettings.caption) {
    rows.push(
      buildMetricRow(
        "Caption",
        `<p class="compare-caption">${escapeHtml(results.caption ?? "Analysing...")}</p>`,
        "caption",
      ),
    );
  }

  if (analysisSettings.color) {
    rows.push(
      buildMetricRow(
        "Dominant colors",
        results.colors
          ? renderColorMetric(results.colors)
          : "<p class=\"compare-metric__empty\">Analysing...</p>",
        "color",
      ),
    );
  }

  if (analysisSettings.objects) {
    rows.push(
      buildMetricRow(
        "Objects found",
        results.objects
          ? renderObjectsMetric(results.objects, sharedLabels)
          : "<p class=\"compare-metric__empty\">Analysing...</p>",
        "objects",
      ),
    );
  }

  if (analysisSettings.composition) {
    rows.push(
      buildMetricRow(
        "Composition",
        results.composition
          ? renderCompositionMetric(results.composition)
          : "<p class=\"compare-metric__empty\">Analysing...</p>",
        "composition",
      ),
    );
  }

  if (analysisSettings.emotion) {
    rows.push(
      buildMetricRow(
        "Emotion",
        results.emotion
          ? renderEmotionMetric(results.emotion)
          : "<p class=\"compare-metric__empty\">Analysing...</p>",
        "emotion",
      ),
    );
  }

  return rows.join("");
}

function buildCompareColumn(image, analysisSettings) {
  const column = document.createElement("article");
  column.className = "compare-column";
  column.dataset.imageId = String(image.id);

  column.innerHTML = `
    <div class="compare-column__header">
      <div class="compare-column__media">
        <img class="compare-column__thumb" src="${image.src}" alt="${escapeHtml(image.name)}">
        <div class="compare-column__color-strip" aria-hidden="true"></div>
      </div>
      <p class="compare-column__name">${escapeHtml(image.name)}</p>
    </div>
    <div class="compare-column__metrics">
      ${buildColumnMetrics(image, {}, new Set(), analysisSettings)}
    </div>
  `;

  return column;
}

async function analyzeImageForCompare(image, analysisSettings, parameters) {
  const results = {
    caption: null,
    colors: null,
    objects: null,
    composition: null,
    emotion: null,
  };

  if (analysisSettings.objects) {
    results.objects = await detectObjects(image.src, {
      threshold: parameters.confidence,
      maxObjects: parameters.maxObjects,
    });
  }

  const parallelTasks = [];

  if (analysisSettings.color) {
    parallelTasks.push(
      extractColors(image.src, parameters.colorsToExtract).then((colors) => {
        results.colors = colors;
      }),
    );
  }

  if (analysisSettings.caption) {
    parallelTasks.push(
      generateCaption(image.src).then((caption) => {
        results.caption = caption;
      }),
    );
  }

  if (parallelTasks.length) {
    await Promise.all(parallelTasks);
  }

  if (analysisSettings.composition) {
    results.composition = await analyzeComposition(image.src);
  }

  if (
    analysisSettings.emotion &&
    shouldRunEmotion(results.objects ?? [])
  ) {
    results.emotion = await detectEmotion(image.src);
  } else if (analysisSettings.emotion) {
    results.emotion = {
      primaryEmotion: "No face detected",
      primaryScore: 0,
      allEmotions: [],
    };
  }

  return results;
}

function updateColumnMetrics(
  image,
  results,
  sharedLabels,
  analysisSettings,
) {
  if (!compareView) {
    return;
  }

  const column = compareView.querySelector(
    `.compare-column[data-image-id="${String(image.id)}"] .compare-column__metrics`,
  );

  if (column) {
    column.innerHTML = buildColumnMetrics(
      image,
      results,
      sharedLabels,
      analysisSettings,
    );
    updateColumnColorStrip(image.id, results.colors);
  }
}

async function runCompareAnalysis(images, analysisSettings, parameters) {
  const resultsByImage = await Promise.all(
    images.map((image) => analyzeImageForCompare(image, analysisSettings, parameters)),
  );

  const sharedLabels = findSharedObjectLabels(resultsByImage);

  images.forEach((image, index) => {
    updateColumnMetrics(
      image,
      resultsByImage[index],
      sharedLabels,
      analysisSettings,
    );
  });
}

export function returnToGalleryFromCompare() {
  if (compareView) {
    compareView.remove();
    compareView = null;
  }

  const galleryView = document.getElementById("gallery-view");
  if (galleryView) {
    galleryView.classList.remove("hidden");
  }
}

export function openCompareView(selectedIds, images) {
  const selectedImages = images.filter((image) =>
    selectedIds.some((id) => String(id) === String(image.id)),
  );

  if (selectedImages.length < 2) {
    return;
  }

  const { analysisSettings, parameters } = getSettings();
  const mainContent = document.getElementById("main-content");
  const galleryView = document.getElementById("gallery-view");

  if (!mainContent) {
    return;
  }

  returnToGallery();
  returnToGalleryFromCompare();

  if (galleryView) {
    galleryView.classList.add("hidden");
  }

  compareView = document.createElement("div");
  compareView.id = "compare-view";
  compareView.className = "compare-view";

  compareView.innerHTML = `
    <div class="compare-view__header">
      <button type="button" class="btn btn--secondary compare-view__back" id="btn-back-from-compare">Back to gallery</button>
      <h2 class="compare-view__title">Comparing ${selectedImages.length} images</h2>
    </div>
    <div class="compare-view__scroll">
      <div class="compare-grid"></div>
    </div>
  `;

  const grid = compareView.querySelector(".compare-grid");
  grid.style.setProperty(
    "--compare-columns",
    String(selectedImages.length),
  );

  for (const image of selectedImages) {
    grid.appendChild(buildCompareColumn(image, analysisSettings));
  }

  compareView
    .querySelector("#btn-back-from-compare")
    .addEventListener("click", returnToGalleryFromCompare);

  mainContent.appendChild(compareView);
  runCompareAnalysis(selectedImages, analysisSettings, parameters);
}
