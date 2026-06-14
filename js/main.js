import { loadModel, isModelReady, modelStatus } from "./models.js";
import { initGallery, renderGallery } from "./ui/gallery.js";
import { initSidebar } from "./ui/sidebar.js";

export let uploadedImages = [];

function handleImagesLoaded(images) {
  uploadedImages = [...uploadedImages, ...images];
  renderGallery(uploadedImages);
}

function readImageFiles(files) {
  const imageFiles = Array.from(files).filter((file) =>
    /^image\/(jpeg|png|webp)$/.test(file.type),
  );

  if (imageFiles.length === 0) {
    return;
  }

  const baseId = Date.now();

  const readPromises = imageFiles.map((file, index) =>
    new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        resolve({
          id: baseId + index,
          name: file.name,
          src: reader.result,
          file,
        });
      };
      reader.readAsDataURL(file);
    }),
  );

  Promise.all(readPromises).then(handleImagesLoaded);
}

function initUploadHandlers() {
  const fileInput = document.getElementById("file-input");
  const uploadButton = document.getElementById("btn-upload");
  const uploadZone = document.getElementById("upload-zone");

  fileInput.addEventListener("change", () => {
    if (fileInput.files?.length) {
      readImageFiles(fileInput.files);
      fileInput.value = "";
    }
  });

  uploadButton.addEventListener("click", () => {
    fileInput.click();
  });

  uploadZone.addEventListener("click", () => {
    fileInput.click();
  });

  uploadZone.addEventListener("dragover", (event) => {
    event.preventDefault();
    uploadZone.classList.add("upload-zone--active");
  });

  uploadZone.addEventListener("dragleave", () => {
    uploadZone.classList.remove("upload-zone--active");
  });

  uploadZone.addEventListener("drop", (event) => {
    event.preventDefault();
    uploadZone.classList.remove("upload-zone--active");

    if (event.dataTransfer?.files?.length) {
      readImageFiles(event.dataTransfer.files);
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  initSidebar();
  initGallery();
  initUploadHandlers();

  window.addEventListener("model-status-change", (event) => {
    const { modelName, status } = event.detail;
    console.log(modelName, status);
  });
});
