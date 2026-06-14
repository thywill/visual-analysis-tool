import { openDeepAnalysis } from "./deep.js";

let galleryView = null;
let galleryGrid = null;
let galleryCountEl = null;
let galleryImages = [];

function formatImageCount(count) {
  return count === 1 ? "1 image" : `${count} images`;
}

function handleOpenDeepAnalysis(imageId) {
  openDeepAnalysis(imageId, galleryImages);
}

function createGalleryCard(image) {
  const card = document.createElement("article");
  card.className = "gallery-card";
  card.dataset.id = String(image.id);

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.className = "gallery-card__checkbox";
  checkbox.setAttribute("aria-label", `Select ${image.name} for comparison`);

  const imageWrap = document.createElement("div");
  imageWrap.className = "gallery-card__image-wrap";

  const img = document.createElement("img");
  img.className = "gallery-card__image";
  img.src = image.src;
  img.alt = image.name;

  const colorStrip = document.createElement("div");
  colorStrip.className = "color-strip";

  imageWrap.append(img, colorStrip);

  const meta = document.createElement("div");
  meta.className = "gallery-card__meta";

  const name = document.createElement("p");
  name.className = "gallery-card__name";
  name.textContent = image.name;

  const caption = document.createElement("p");
  caption.className = "gallery-card__caption";
  caption.textContent = "Analysing...";

  meta.append(name, caption);
  card.append(checkbox, imageWrap, meta);

  checkbox.addEventListener("change", () => {
    card.classList.toggle("gallery-card--selected", checkbox.checked);
  });

  card.addEventListener("click", (event) => {
    if (event.target.closest(".gallery-card__checkbox")) {
      return;
    }
    handleOpenDeepAnalysis(image.id);
  });

  return card;
}

function selectAllCards() {
  if (!galleryGrid) {
    return;
  }

  for (const card of galleryGrid.querySelectorAll(".gallery-card")) {
    const checkbox = card.querySelector(".gallery-card__checkbox");
    if (checkbox) {
      checkbox.checked = true;
      card.classList.add("gallery-card--selected");
    }
  }
}

function clearAllCards() {
  if (!galleryGrid) {
    return;
  }

  for (const card of galleryGrid.querySelectorAll(".gallery-card")) {
    const checkbox = card.querySelector(".gallery-card__checkbox");
    if (checkbox) {
      checkbox.checked = false;
      card.classList.remove("gallery-card--selected");
    }
  }
}

export function initGallery() {
  const mainContent = document.getElementById("main-content");
  if (!mainContent || galleryView) {
    return;
  }

  galleryView = document.createElement("div");
  galleryView.id = "gallery-view";
  galleryView.className = "gallery-view hidden";

  const bar = document.createElement("div");
  bar.className = "gallery-bar";

  galleryCountEl = document.createElement("span");
  galleryCountEl.className = "gallery-bar__count";
  galleryCountEl.textContent = formatImageCount(0);

  const actions = document.createElement("div");
  actions.className = "gallery-bar__actions";

  const selectAllButton = document.createElement("button");
  selectAllButton.type = "button";
  selectAllButton.id = "btn-select-all";
  selectAllButton.className = "btn btn--secondary gallery-bar__btn";
  selectAllButton.textContent = "Select All";

  const clearAllButton = document.createElement("button");
  clearAllButton.type = "button";
  clearAllButton.id = "btn-clear-all";
  clearAllButton.className = "btn btn--secondary gallery-bar__btn";
  clearAllButton.textContent = "Clear All";

  actions.append(selectAllButton, clearAllButton);
  bar.append(galleryCountEl, actions);

  galleryGrid = document.createElement("div");
  galleryGrid.className = "gallery-grid";

  galleryView.append(bar, galleryGrid);
  mainContent.appendChild(galleryView);

  selectAllButton.addEventListener("click", selectAllCards);
  clearAllButton.addEventListener("click", clearAllCards);
}

export function renderGallery(images) {
  if (!galleryView || !galleryGrid) {
    initGallery();
  }

  galleryImages = images;

  const uploadZone = document.getElementById("upload-zone");
  if (uploadZone) {
    uploadZone.classList.add("hidden");
  }

  galleryView.classList.remove("hidden");
  galleryCountEl.textContent = formatImageCount(images.length);

  for (const image of images) {
    if (galleryGrid.querySelector(`[data-id="${image.id}"]`)) {
      continue;
    }

    galleryGrid.appendChild(createGalleryCard(image));
  }
}

export function getSelectedImages() {
  if (!galleryGrid) {
    return [];
  }

  return Array.from(
    galleryGrid.querySelectorAll(".gallery-card__checkbox:checked"),
  ).map((checkbox) => {
    const card = checkbox.closest(".gallery-card");
    const id = card?.dataset.id;
    return id !== undefined && !Number.isNaN(Number(id)) ? Number(id) : id;
  });
}
