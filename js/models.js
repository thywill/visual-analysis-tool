import { pipeline } from "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.2.1";

const MODEL_CONFIG = {
  objectDetector: {
    task: "object-detection",
    model: "Xenova/detr-resnet-50",
  },
  captioner: {
    task: "image-to-text",
    model: "Xenova/vit-gpt2-image-captioning",
  },
  emotionDetector: {
    task: "image-classification",
    model: "Xenova/facial-emotion-recognition",
  },
};

const models = {
  objectDetector: null,
  captioner: null,
  emotionDetector: null,
};

export const modelStatus = {
  objectDetector: "idle",
  captioner: "idle",
  emotionDetector: "idle",
};

const loadingPromises = {};

function dispatchModelStatusChange(modelName, status) {
  window.dispatchEvent(
    new CustomEvent("model-status-change", {
      detail: { modelName, status },
    }),
  );
}

function setModelStatus(modelName, status) {
  modelStatus[modelName] = status;
  dispatchModelStatusChange(modelName, status);
}

export function isModelReady(modelName) {
  return modelStatus[modelName] === "ready";
}

export function getModel(modelName) {
  return models[modelName];
}

export async function loadModel(modelName) {
  if (isModelReady(modelName)) {
    return models[modelName];
  }

  if (loadingPromises[modelName]) {
    return loadingPromises[modelName];
  }

  const config = MODEL_CONFIG[modelName];
  if (!config) {
    throw new Error(`Unknown model: ${modelName}`);
  }

  setModelStatus(modelName, "loading");

  loadingPromises[modelName] = pipeline(config.task, config.model)
    .then((instance) => {
      models[modelName] = instance;
      setModelStatus(modelName, "ready");
      return instance;
    })
    .catch((error) => {
      setModelStatus(modelName, "error");
      throw error;
    })
    .finally(() => {
      delete loadingPromises[modelName];
    });

  return loadingPromises[modelName];
}
