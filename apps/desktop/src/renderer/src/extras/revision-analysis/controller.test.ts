import { describe, expect, it, vi } from "vitest";
import { nextTick } from "vue";
import {
  DEFAULT_REVISION_METHOD,
  type DeepWriteApi,
  type ModelConfig,
  type SessionPromptCommandPayload,
  type SystemEventEnvelope,
  type SkillLibrary
} from "@deepwrite/contracts/renderer";
import { useRevisionAnalysis } from "./useRevisionAnalysis";
const model = {
  id: "model",
  defaultThinkingLevel: "off",
  thinkingLevelOptions: ["off"],
  contextWindow: 200000,
  maxTokens: 16000
} as ModelConfig;
const result = {
  report: "修改报告",
  title: "修改方向",
  body: "适用场景与执行规则"
};
const library = {
  id: "skills",
  isBuiltin: false,
  projectRevision: 3
} as SkillLibrary;
function fixture() {
  const prompt = vi.fn(async (input: SessionPromptCommandPayload) => ({
    sessionId: input.sessionId,
    runId: `${input.sessionId}-run`,
    acceptedAt: new Date().toISOString()
  }));
  const abort = vi.fn(async () => ({})),
    createLibraryEntry = vi.fn(async () => ({}));
  const api = {
    session: { prompt, abort },
    revisionAnalysis: {
      list: async () => ({ systemPrompt: DEFAULT_REVISION_METHOD }),
      save: async (s: unknown) => s,
      reset: async () => ({ systemPrompt: DEFAULT_REVISION_METHOD })
    },
    catalog: { createLibraryEntry }
  } as unknown as DeepWriteApi;
  const c = useRevisionAnalysis({ api: () => api });
  c.setConfiguredModels([model]);
  c.beforeText.value = "开头\n原句\n结尾";
  c.afterText.value = "开头\n改句\n结尾";
  c.compare();
  return { c, prompt, abort, createLibraryEntry };
}
function event(
  type: string,
  request: SessionPromptCommandPayload,
  payload: Record<string, unknown> = {}
): SystemEventEnvelope {
  return {
    type,
    payload: {
      sessionId: request.sessionId,
      runId: `${request.sessionId}-run`,
      ...payload
    }
  } as SystemEventEnvelope;
}
function finish(
  f: ReturnType<typeof fixture>,
  request = f.prompt.mock.calls.at(-1)![0]
) {
  f.c.handleEvent(
    event("revision_analysis.result_updated", request, {
      jobId: request.workspaceContext!.revisionAnalysis!.jobId,
      result
    })
  );
  f.c.handleEvent(event("agent.message_completed", request));
}
describe("revision analysis controller", () => {
  it("freezes evidence, permits empty reasons and retains result until next success", async () => {
    const f = fixture();
    await nextTick();
    f.c.start();
    const first = f.prompt.mock.calls[0]![0];
    expect(first.workspaceContext?.revisionAnalysis?.overallReason).toBe("");
    expect(() => f.c.compare()).toThrow("正在处理");
    await nextTick();
    finish(f);
    expect(f.c.result.value).toEqual(result);
    expect(f.c.isStale.value).toBe(false);
    f.c.changes.value[0]!.reason = "更凝练";
    expect(f.c.isStale.value).toBe(true);
    expect(first.workspaceContext?.revisionAnalysis?.changes[0]!.reason).toBe(
      ""
    );
    f.c.start();
    expect(f.c.result.value).toEqual(result);
    await nextTick();
    f.c.handleEvent(
      event("agent.error", f.prompt.mock.calls[1]![0], { message: "测试失败" })
    );
    expect(f.c.result.value).toEqual(result);
    expect(f.c.status.value).toBe("error");
    f.c.dispose();
  });
  it("requires another comparison after editing text, and ignores obsolete events after stop/retry", async () => {
    const f = fixture();
    f.c.beforeText.value += "\n新增";
    expect(f.c.canStart.value).toBe(false);
    expect(() => f.c.start()).toThrow("先比较");
    f.c.compare();
    await nextTick();
    f.c.start();
    await nextTick();
    const old = f.prompt.mock.calls[0]![0];
    await f.c.stop();
    expect(f.c.status.value).toBe("stopped");
    f.c.retry();
    await nextTick();
    finish(f, old);
    expect(f.c.status.value).toBe("running");
    finish(f);
    expect(f.c.status.value).toBe("completed");
    expect(f.abort).toHaveBeenCalledOnce();
    f.c.dispose();
  });
  it("fails cleanly for missing structured output and worker restarts", async () => {
    const f = fixture();
    await nextTick();
    f.c.start();
    await nextTick();
    f.c.handleEvent(
      event("agent.message_completed", f.prompt.mock.calls[0]![0])
    );
    expect(f.c.error.value).toContain("结构化结果");
    f.c.retry();
    await nextTick();
    f.c.handleEvent({
      type: "system.worker_restarted",
      payload: { worker: "agent" }
    } as SystemEventEnvelope);
    expect(f.c.status.value).toBe("error");
    expect(f.c.error.value).toContain("重启");
    f.c.dispose();
  });
  it("preserves editable drafts on save failure and blocks duplicate saves", async () => {
    const f = fixture();
    await nextTick();
    f.c.start();
    await nextTick();
    finish(f);
    f.c.result.value!.body = "编辑后的技能";
    f.createLibraryEntry.mockRejectedValueOnce(new Error("版本冲突"));
    await expect(f.c.persistSkill(library, "draft")).rejects.toThrow(
      "版本冲突"
    );
    expect(f.c.result.value!.body).toBe("编辑后的技能");
    expect(f.c.savedKey.value).toBe("");
    await f.c.persistSkill(library, "draft");
    await f.c.persistSkill(library, "draft");
    expect(f.createLibraryEntry).toHaveBeenCalledTimes(2);
    expect(f.createLibraryEntry.mock.calls[1]).toEqual([
      {
        domain: "skill",
        libraryId: "skills",
        title: "修改方向",
        content: "编辑后的技能",
        stageId: "draft",
        baseProjectRevision: 3
      }
    ]);
    await expect(
      f.c.persistSkill({ ...library, isBuiltin: true }, "draft")
    ).rejects.toThrow("非内置");
    f.c.dispose();
  });
  it("loads, saves and restores the method without persisting source documents", async () => {
    const f = fixture();
    await f.c.loadSettings();
    f.c.systemPrompt.value = "只分析对白";
    await f.c.saveSettings();
    expect(f.c.systemPrompt.value).toBe("只分析对白");
    await f.c.saveSettings(true);
    expect(f.c.systemPrompt.value).toBe(DEFAULT_REVISION_METHOD);
    expect(f.c.beforeText.value).toContain("原句");
    f.c.dispose();
  });
});
