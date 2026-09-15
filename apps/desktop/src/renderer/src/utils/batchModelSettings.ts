import { createId } from "@deepwrite/shared";
import {
  cloneDraftModel,
  type DraftModel
} from "../components/modelSettingsDraft";
import type { ModelEditorSavePayload } from "../composables/useModelEditor";

/** Expand one editor configuration without replacing unselected existing models. */
export function applyBatchModelSettings(
  existing: DraftModel[],
  payload: ModelEditorSavePayload
): DraftModel[] {
  const selected = payload.selectedModels;
  const models = [...existing];
  if (!selected) {
    const index = models.findIndex(
      (model) => model.id === (payload.originalId ?? payload.model.id)
    );
    if (
      models.some(
        (model, candidate) =>
          model.id === payload.model.id && candidate !== index
      )
    ) {
      throw new Error("模型配置 ID 不能重复。");
    }
    if (index >= 0) models[index] = payload.model;
    else models.push(payload.model);
    return models;
  }
  if (!selected.length) throw new Error("请至少选择一个要保存的模型。");
  const source = payload.model;
  const original = existing.find((model) => model.id === payload.originalId);
  for (const remote of new Map(
    selected.map((model) => [model.id, model])
  ).values()) {
    const index = models.findIndex(
      (model) =>
        !model.managedBy &&
        model.provider === source.provider &&
        model.api === source.api &&
        model.baseUrl === source.baseUrl &&
        model.modelId === remote.id
    );
    const previous = models[index];
    const preservesOriginal = previous?.id === payload.originalId;
    const model: DraftModel = {
      ...cloneDraftModel(source),
      id: previous?.id ?? createId("model"),
      label:
        preservesOriginal && source.label
          ? source.label
          : (previous?.label ?? (remote.label || remote.id).slice(0, 120)),
      modelId: remote.id,
      hasApiKey: Boolean(
        source.apiKey || (!source.clearApiKey && source.hasApiKey)
      )
    };
    // Routing and capacity overrides belong to a specific model, not the provider.
    if (original?.modelId !== remote.id) {
      delete model.requestModelId;
      delete model.contextWindow;
      delete model.maxTokens;
      if (previous?.requestModelId)
        model.requestModelId = previous.requestModelId;
      if (previous?.contextWindow !== undefined)
        model.contextWindow = previous.contextWindow;
      if (previous?.maxTokens !== undefined)
        model.maxTokens = previous.maxTokens;
    }
    delete model.sourceApiKeyId;
    if (
      !source.apiKey?.trim() &&
      !source.clearApiKey &&
      source.hasApiKey &&
      payload.originalId
    ) {
      model.sourceApiKeyId = payload.originalId;
    }
    if (index >= 0) models[index] = model;
    else models.push(model);
  }
  return models;
}
