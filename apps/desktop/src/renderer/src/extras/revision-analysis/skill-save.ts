import { ref, type Ref } from "vue";
import {
  RevisionAnalysisResultSchema,
  type DeepWriteApi,
  type RevisionAnalysisResult,
  type SkillLibrary,
  type SkillStageId
} from "@deepwrite/contracts/renderer";
export function createRevisionSkillSave(
  api: () => DeepWriteApi,
  result: Ref<RevisionAnalysisResult | null>
) {
  const saving = ref(false),
    savedKey = ref("");
  const key = () => JSON.stringify([result.value?.title, result.value?.body]);
  return {
    saving,
    savedKey,
    skillKey: key,
    async persistSkill(library: SkillLibrary, stageId: SkillStageId) {
      if (saving.value) return false;
      if (library.isBuiltin) throw new Error("请选择可写的非内置技能库。");
      const draft = RevisionAnalysisResultSchema.parse(result.value);
      const currentKey = key();
      if (savedKey.value === currentKey) return false;
      saving.value = true;
      try {
        await api().catalog.createLibraryEntry({
          domain: "skill",
          libraryId: library.id,
          title: draft.title,
          content: draft.body,
          stageId,
          ...(library.projectRevision !== undefined
            ? { baseProjectRevision: library.projectRevision }
            : {})
        });
        savedKey.value = currentKey;
        return true;
      } finally {
        saving.value = false;
      }
    }
  };
}
