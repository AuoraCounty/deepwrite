import { ref } from "vue";
import { describe, expect, it, vi } from "vitest";
import {
  createDefaultCreativePlotStages,
  DEFAULT_SHORT_WORKSPACE_AGENT_SETTINGS,
  type CatalogIndexSnapshot,
  type WorkspaceAgentSettings
} from "@deepwrite/contracts";
import { useCreativeBookCreation } from "./useCreativeBookCreation";
describe("creative book creation routing", () => {
  it("preserves normal long payloads and applies global defaults only to ordinary short creation", async () => {
    const createLong = vi.fn(async () => {});
    const createShort = vi.fn(async () => {});
    const flow = useCreativeBookCreation({
      open: ref(false),
      pending: () => false,
      settings: ref<WorkspaceAgentSettings[]>([
        {
          ...DEFAULT_SHORT_WORKSPACE_AGENT_SETTINGS,
          defaultPlotStageIds: ["plot_design"]
        }
      ]),
      catalog: ref({
        creativePlotStages: createDefaultCreativePlotStages()
      } as CatalogIndexSnapshot),
      createLong,
      createShort,
      openSettings: vi.fn(async () => {})
    });
    await flow.createCreativeBook({
      workspaceType: "long",
      title: "长篇",
      genre: "其他"
    });
    expect(createLong).toHaveBeenCalledExactlyOnceWith({
      title: "长篇",
      genre: "其他"
    });
    await flow.createCreativeBook({
      workspaceType: "short",
      title: "普通短篇",
      genre: "其他"
    });
    expect(createShort).toHaveBeenLastCalledWith({
      workspaceType: "short",
      title: "普通短篇",
      genre: "其他",
      defaultPlotStageIds: ["plot_design"]
    });
    const template = {
      workspaceType: "short" as const,
      title: "模板短篇",
      genre: "其他" as const,
      templateId: "template_1"
    };
    await flow.createCreativeBook(template);
    expect(createShort).toHaveBeenLastCalledWith(template);
  });
});
