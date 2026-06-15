import {
  detectObjects,
  renderBoundingBoxes,
  clearBoundingBoxes,
  groupObjectsByLabel,
} from "../analysis/objects.js";
import {
  extractColors,
  renderColorStrip,
  renderColorResults,
} from "../analysis/color.js";
import {
  generateCaption,
  updateGalleryCaption,
  renderCaptionResult,
} from "../analysis/caption.js";
import {
  analyzeComposition,
  renderCompositionResults,
} from "../analysis/composition.js";
import {
  detectEmotion,
  renderEmotionResults,
  shouldRunEmotion,
} from "../analysis/emotion.js";
import { getSettings } from "./sidebar.js";
import {
  exportSingleImageReport,
  getAnalysisResult,
  storeAnalysisResult,
} from "../utils/export.js";

let deepView = null;
let currentImage = null;
let currentObjectResults = [];
let currentColors = [];
let activeTab = "image";

const SECTION_LABELS = {
  objects: "Objects",
  color: "Color",
  caption: "Caption",
  composition: "Composition",
  emotion: "Emotion",
};

function formatObjectResults(results) {
  if (!results?.length) {
    return "<p class=\"deep-analysis__muted\">No objects detected.</p>";
  }

  const groupedObjects = groupObjectsByLabel(results);
  const items = groupedObjects
    .map((group) => {
      const countLabel = group.count > 1 ? ` (${group.count})` : "";

      return `<li class="deep-analysis__object-item">
          <span class="deep-analysis__object-label">${group.label}${countLabel} avg: ${group.avgScore}</span>
        </li>`;
    })
    .join("");

  return `<ul class="deep-analysis__object-list">${items}</ul>`;
}

function updateSection(sectionKey, html) {
  if (!deepView) {
    return;
  }

  const section = deepView.querySelector(
    `[data-section="${sectionKey}"] .deep-analysis__section-content`,
  );

  if (section) {
    section.innerHTML = html;
  }
}

function renderDataViewColorStrip(colors) {
  const strip = deepView?.querySelector(".deep-analysis__data-color-strip");
  if (!strip) {
    return;
  }

  strip.replaceChildren();

  if (!colors?.length) {
    return;
  }

  for (const color of colors) {
    const segment = document.createElement("div");
    segment.className = "color-strip__segment";
    segment.style.backgroundColor = color.hex;
    segment.style.flexGrow = color.percentage;
    segment.style.flexBasis = "0";
    strip.appendChild(segment);
  }
}

function refreshDataViewArtifacts() {
  if (!deepView || !currentImage) {
    return;
  }

  const dataCanvas = deepView.querySelector(".deep-analysis__data-canvas");
  const refImage = deepView.querySelector(".deep-analysis__image");

  if (!dataCanvas || !refImage) {
    return;
  }

  renderBoundingBoxes(
    currentImage.id,
    currentObjectResults,
    true,
    dataCanvas,
    refImage,
  );
  renderDataViewColorStrip(currentColors);
}

function setActiveTab(tabName) {
  activeTab = tabName;

  const imagePanel = deepView.querySelector(
    ".deep-analysis__panel--image-view",
  );
  const dataPanel = deepView.querySelector(".deep-analysis__panel--data-view");
  const tabs = deepView.querySelectorAll(".deep-analysis__tab");

  for (const tab of tabs) {
    tab.classList.toggle(
      "deep-analysis__tab--active",
      tab.dataset.tab === tabName,
    );
  }

  if (tabName === "data") {
    imagePanel.classList.add("hidden");
    dataPanel.classList.remove("hidden");
    refreshDataViewArtifacts();
  } else {
    imagePanel.classList.remove("hidden");
    dataPanel.classList.add("hidden");
  }
}

function buildResultsSections(analysisSettings) {
  const sections = [];

  if (analysisSettings.objects) {
    sections.push("objects");
  }
  if (analysisSettings.color) {
    sections.push("color");
  }
  if (analysisSettings.caption) {
    sections.push("caption");
  }
  if (analysisSettings.composition) {
    sections.push("composition");
  }
  if (analysisSettings.emotion) {
    sections.push("emotion");
  }

  return sections
    .map(
      (key) =>
        `<section class="deep-analysis__section" data-section="${key}">
          <h3 class="deep-analysis__section-title">${SECTION_LABELS[key]}</h3>
          <div class="deep-analysis__section-content">Analysing...</div>
        </section>`,
    )
    .join("");
}

function buildDeepAnalysisLayout(image, analysisSettings) {
  deepView = document.createElement("div");
  deepView.id = "deep-analysis-view";
  deepView.className = "deep-analysis";

  deepView.innerHTML = `
    <div class="deep-analysis__header">
      <button type="button" class="btn btn--secondary deep-analysis__back" id="btn-back-to-gallery">Back to gallery</button>
      <h2 class="deep-analysis__filename">${image.name}</h2>
      <button type="button" class="btn btn--secondary deep-analysis__export" id="btn-export-deep">Export report</button>
    </div>
    <div class="deep-analysis__body">
      <div class="deep-analysis__visual">
        <div class="deep-analysis__tabs" role="tablist" aria-label="Analysis view">
          <button type="button" class="deep-analysis__tab deep-analysis__tab--active" data-tab="image" role="tab">Image view</button>
          <button type="button" class="deep-analysis__tab" data-tab="data" role="tab">Data view</button>
        </div>
        <div class="deep-analysis__panel deep-analysis__panel--image-view">
          <div
            class="deep-analysis__image-wrap"
            data-image-id="${image.id}"
          >
            <img
              class="deep-analysis__image"
              src="${image.src}"
              alt="${image.name}"
            >
          </div>
        </div>
        <div class="deep-analysis__panel deep-analysis__panel--data-view hidden">
          <div
            class="deep-analysis__data-canvas"
            data-image-id="${image.id}"
          >
            <div class="deep-analysis__data-color-strip color-strip"></div>
          </div>
        </div>
      </div>
      <aside class="deep-analysis__results" aria-label="Analysis results">
        ${buildResultsSections(analysisSettings)}
      </aside>
    </div>
  `;

  deepView.querySelector("#btn-back-to-gallery").addEventListener("click", () => {
    returnToGallery();
  });

  deepView.querySelector("#btn-export-deep").addEventListener("click", () => {
    if (!currentImage) {
      return;
    }

    exportSingleImageReport(
      currentImage,
      getAnalysisResult(currentImage.id),
    );
  });

  for (const tab of deepView.querySelectorAll(".deep-analysis__tab")) {
    tab.addEventListener("click", () => setActiveTab(tab.dataset.tab));
  }

  const refImage = deepView.querySelector(".deep-analysis__image");
  if (refImage) {
    refImage.addEventListener("load", () => {
      const dataCanvas = deepView.querySelector(".deep-analysis__data-canvas");
      if (dataCanvas && refImage.naturalWidth && refImage.naturalHeight) {
        dataCanvas.style.aspectRatio = `${refImage.naturalWidth} / ${refImage.naturalHeight}`;
      }
    });
  }

  return deepView;
}

export function returnToGallery() {
  if (currentImage) {
    clearBoundingBoxes(currentImage.id);
  }

  if (deepView) {
    deepView.remove();
    deepView = null;
  }

  currentImage = null;
  currentObjectResults = [];
  currentColors = [];
  activeTab = "image";

  const galleryView = document.getElementById("gallery-view");
  if (galleryView) {
    galleryView.classList.remove("hidden");
  }
}

export async function runAnalysis(image) {
  const { analysisSettings, parameters } = getSettings();
  const analysisResult = {
    caption: null,
    colors: null,
    objects: null,
    composition: null,
    emotion: null,
    analyzedAt: new Date().toISOString(),
  };

  currentObjectResults = [];
  currentColors = [];

  if (analysisSettings.objects) {
    try {
      currentObjectResults = await detectObjects(image.src, {
        threshold: parameters.confidence,
        maxObjects: parameters.maxObjects,
      });
      analysisResult.objects = currentObjectResults;

      const refImage = deepView?.querySelector(".deep-analysis__image");
      const imageWrap = deepView?.querySelector(".deep-analysis__image-wrap");
      const dataCanvas = deepView?.querySelector(".deep-analysis__data-canvas");

      renderBoundingBoxes(image.id, currentObjectResults, true, imageWrap, refImage);

      if (activeTab === "data" && dataCanvas && refImage) {
        renderBoundingBoxes(
          image.id,
          currentObjectResults,
          true,
          dataCanvas,
          refImage,
        );
      }

      updateSection("objects", formatObjectResults(currentObjectResults));
    } catch {
      updateSection(
        "objects",
        "<p class=\"deep-analysis__muted\">Object detection failed.</p>",
      );
    }
  }

  const parallelTasks = [];

  if (analysisSettings.color) {
    parallelTasks.push(
      extractColors(image.src, parameters.colorsToExtract)
        .then((colors) => {
          currentColors = colors;
          analysisResult.colors = colors;
          renderColorStrip(image.id, colors);
          renderDataViewColorStrip(colors);
          updateSection("color", renderColorResults(colors));
        })
        .catch(() => {
          updateSection(
            "color",
            "<p class=\"deep-analysis__muted\">Color analysis failed.</p>",
          );
        }),
    );
  }

  if (analysisSettings.caption) {
    parallelTasks.push(
      generateCaption(image.src)
        .then((caption) => {
          analysisResult.caption = caption;
          updateGalleryCaption(image.id, caption);
          updateSection("caption", renderCaptionResult(caption));
        })
        .catch(() => {
          updateSection(
            "caption",
            "<p class=\"deep-analysis__muted\">Caption unavailable.</p>",
          );
        }),
    );
  }

  if (parallelTasks.length) {
    await Promise.all(parallelTasks);
  }

  if (analysisSettings.composition) {
    try {
      const composition = await analyzeComposition(image.src);
      analysisResult.composition = composition;
      updateSection("composition", renderCompositionResults(composition));
    } catch {
      updateSection(
        "composition",
        "<p class=\"deep-analysis__muted\">Composition analysis failed.</p>",
      );
    }
  }

  if (analysisSettings.emotion) {
    if (shouldRunEmotion(currentObjectResults)) {
      try {
        const emotionResults = await detectEmotion(image.src);
        analysisResult.emotion = emotionResults;
        updateSection("emotion", renderEmotionResults(emotionResults));
      } catch {
        updateSection(
          "emotion",
          "<p class=\"deep-analysis__muted\">Emotion detection failed.</p>",
        );
      }
    } else {
      analysisResult.emotion = {
        primaryEmotion: "No face detected",
        primaryScore: 0,
        allEmotions: [],
      };
      updateSection(
        "emotion",
        "<p class=\"deep-analysis__muted\">No person detected — emotion analysis skipped.</p>",
      );
    }
  }

  storeAnalysisResult(image.id, analysisResult);
}

export function openDeepAnalysis(imageId, images) {
  const image = images.find(
    (item) => String(item.id) === String(imageId),
  );

  if (!image) {
    return;
  }

  const { analysisSettings } = getSettings();
  const mainContent = document.getElementById("main-content");
  const galleryView = document.getElementById("gallery-view");

  if (!mainContent) {
    return;
  }

  if (galleryView) {
    galleryView.classList.add("hidden");
  }

  if (deepView) {
    deepView.remove();
  }

  currentImage = image;
  currentObjectResults = [];
  currentColors = [];
  activeTab = "image";

  deepView = buildDeepAnalysisLayout(image, analysisSettings);
  mainContent.appendChild(deepView);

  runAnalysis(image);
}
