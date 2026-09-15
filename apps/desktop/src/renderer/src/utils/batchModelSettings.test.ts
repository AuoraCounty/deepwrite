import { describe, expect, it } from "vitest";
import type { DraftModel } from "../components/modelSettingsDraft";
import { applyBatchModelSettings } from "./batchModelSettings";

const source: DraftModel = {
  id: "saved",
  label: "我的写作模型",
  provider: "custom",
  modelId: "writer",
  api: "openai-completions",
  baseUrl: "https://example.test/v1",
  reasoning: true,
  defaultThinkingLevel: "high",
  thinkingLevelOptions: ["medium", "high"],
  temperatureOptions: [0.1, 0.7, 1],
  hasApiKey: true,
  requestModelId: "writer-route",
  contextWindow: 32000,
  maxTokens: 4000
};

describe("batch model configuration", () => {
  it("updates selected existing models and adds each new model once with shared settings", () => {
    const models = applyBatchModelSettings([source], {
      model: source,
      originalId: source.id,
      selectedModels: [
        { id: "writer" },
        { id: "reader", label: "阅读模型" },
        { id: "reader" }
      ]
    });
    expect(models).toHaveLength(2);
    expect(models[0]).toMatchObject({
      id: source.id,
      label: source.label,
      contextWindow: 32000
    });
    expect(models[1]).toMatchObject({
      modelId: "reader",
      label: "reader",
      provider: source.provider,
      baseUrl: source.baseUrl,
      defaultThinkingLevel: "high",
      sourceApiKeyId: source.id
    });
    expect(models[1]).not.toHaveProperty("requestModelId");
    expect(models[1]).not.toHaveProperty("contextWindow");
    expect(models[1]).not.toHaveProperty("apiKey");
    expect(models[1]?.id).not.toBe(source.id);
  });
  it("preserves an unselected original and models on other endpoints", () => {
    const another = {
      ...source,
      id: "other",
      baseUrl: "https://other.example.test/v1"
    };
    const models = applyBatchModelSettings([source, another], {
      model: source,
      originalId: source.id,
      selectedModels: [{ id: "reader", label: "Reader" }]
    });
    expect(models.slice(0, 2)).toEqual([source, another]);
    expect(models[2]?.label).toBe("Reader");
  });
  it("reuses existing ids on retry and preserves their individual capacities", () => {
    const reader = {
      ...source,
      id: "reader-config",
      modelId: "reader",
      contextWindow: 64000
    };
    const payload = {
      model: source,
      originalId: source.id,
      selectedModels: [{ id: "reader" }]
    };
    const models = applyBatchModelSettings([source, reader], payload);
    expect(applyBatchModelSettings(models, payload)).toEqual(models);
    expect(models[1]).toMatchObject({
      id: "reader-config",
      contextWindow: 64000
    });
  });
  it("applies explicit credentials or clearing without referencing a saved key", () => {
    for (const changes of [
      { apiKey: "invalid-test-key" },
      { clearApiKey: true }
    ]) {
      const models = applyBatchModelSettings([], {
        model: { ...source, ...changes },
        originalId: source.id,
        selectedModels: [{ id: "reader" }]
      });
      expect(models[0]).toMatchObject(changes);
      expect(models[0]).not.toHaveProperty("sourceApiKeyId");
    }
  });
  it("rejects an empty batch", () => {
    expect(() =>
      applyBatchModelSettings([source], { model: source, selectedModels: [] })
    ).toThrow("至少选择");
  });
});
