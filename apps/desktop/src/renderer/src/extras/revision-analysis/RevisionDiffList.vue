<script setup lang="ts">
import { ref, watch } from "vue";
import {
  REVISION_REASON_LIMIT,
  type RevisionChange
} from "@deepwrite/contracts/renderer";
const props = defineProps<{
  changes: RevisionChange[];
  disabled: boolean;
  current: boolean;
}>();
const emit = defineEmits<{ reason: [id: string, text: string] }>();
const visible = ref(20);
watch(
  () => props.changes,
  () => {
    visible.value = 20;
  }
);
function update(id: string, event: Event) {
  emit("reason", id, (event.target as HTMLTextAreaElement).value);
}
</script>
<template>
  <section class="analysis-setup-panel revision-differences">
    <header>
      <h2>
        修改段落 <small>{{ changes.length }} 组</small>
      </h2>
      <span>{{ current ? "已比较当前正文" : "请比较当前正文后再分析" }}</span>
    </header>
    <p v-if="!changes.length">比较差异后，在这里查看修改段落并填写可选理由。</p>
    <article
      v-for="(change, index) in changes.slice(0, visible)"
      :key="change.id"
      class="revision-change"
    >
      <header>
        <strong>差异 {{ index + 1 }}</strong
        ><small v-if="change.coarse"
          >变化较多，按较大范围合并展示；内容完整保留</small
        >
      </header>
      <div class="revision-change-grid">
        <section>
          <h3>
            修改前
            <small v-if="change.beforeStart"
              >第 {{ change.beforeStart }} 行起</small
            >
          </h3>
          <pre>{{ change.before || "无对应段落" }}</pre>
        </section>
        <section>
          <h3>
            修改后
            <small v-if="change.afterStart"
              >第 {{ change.afterStart }} 行起</small
            >
          </h3>
          <pre>{{ change.after || "无对应段落" }}</pre>
        </section>
        <label
          >修改理由 <small>选填</small
          ><textarea
            :value="change.reason"
            :maxlength="REVISION_REASON_LIMIT"
            :disabled="disabled || !current"
            :aria-label="`差异 ${index + 1} 的修改理由`"
            placeholder="例如：减少解释，让人物通过行动表达情绪…"
            @input="update(change.id, $event)"
          />
        </label>
      </div>
    </article>
    <button v-if="visible < changes.length" @click="visible += 20">
      继续显示 {{ Math.min(20, changes.length - visible) }} 组差异
    </button>
  </section>
</template>
