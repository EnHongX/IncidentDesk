<template>
  <div class="sla-config">
    <button class="btn back" @click="$router.push('/')">&larr; 返回列表</button>

    <div class="card">
      <h2>SLA 时限配置</h2>
      <p class="desc">为不同严重级别设置处理时限（分钟），超过时限的告警将标记为超时。</p>

      <div v-if="loading" class="loading">加载中...</div>
      <div v-else class="config-form">
        <div v-for="item in configs" :key="item.severity" class="config-row">
          <span :class="['severity-label', item.severity]">{{ severityLabel(item.severity) }}</span>
          <div class="input-group">
            <input
              type="number"
              v-model.number="item.deadlineMinutes"
              min="1"
              class="input"
            />
            <span class="unit">分钟</span>
            <span class="hint">({{ formatHuman(item.deadlineMinutes) }})</span>
          </div>
        </div>

        <div class="form-actions">
          <button class="btn btn-primary" @click="save" :disabled="saving">
            {{ saving ? '保存中...' : '保存配置' }}
          </button>
        </div>

        <div v-if="saved" class="success">配置已保存</div>
        <div v-if="error" class="error">{{ error }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { fetchSlaConfig, updateSlaConfig, type SlaConfigItem } from '../api';

const SEVERITIES = ['critical', 'high', 'medium', 'low'];
const DEFAULT_DEADLINES: Record<string, number> = {
  critical: 30, high: 60, medium: 240, low: 480,
};

const configs = ref<SlaConfigItem[]>([]);
const loading = ref(true);
const saving = ref(false);
const saved = ref(false);
const error = ref('');

async function load() {
  loading.value = true;
  const data = await fetchSlaConfig();
  const map = new Map(data.map((d) => [d.severity, d.deadlineMinutes]));
  configs.value = SEVERITIES.map((s) => ({
    severity: s,
    deadlineMinutes: map.get(s) ?? DEFAULT_DEADLINES[s],
  }));
  loading.value = false;
}

async function save() {
  saving.value = true;
  saved.value = false;
  error.value = '';
  try {
    await updateSlaConfig(configs.value);
    saved.value = true;
    setTimeout(() => { saved.value = false; }, 3000);
  } catch (e: any) {
    error.value = e.message || '保存失败';
  } finally {
    saving.value = false;
  }
}

function severityLabel(s: string): string {
  const map: Record<string, string> = {
    critical: 'Critical（紧急）',
    high: 'High（高）',
    medium: 'Medium（中）',
    low: 'Low（低）',
  };
  return map[s] || s;
}

function formatHuman(min: number): string {
  if (min < 60) return `${min}分钟`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}小时${m}分钟` : `${h}小时`;
}

onMounted(load);
</script>

<style scoped>
.sla-config {
  max-width: 600px;
}
.back {
  margin-bottom: 16px;
}
.card {
  background: #fff;
  border-radius: 8px;
  padding: 24px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}
.card h2 {
  margin-bottom: 8px;
  font-size: 18px;
}
.desc {
  font-size: 13px;
  color: #666;
  margin-bottom: 24px;
}
.config-row {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 0;
  border-bottom: 1px solid #f0f0f0;
}
.config-row:last-of-type {
  border-bottom: none;
}
.severity-label {
  font-size: 14px;
  font-weight: 600;
  width: 160px;
  padding: 4px 10px;
  border-radius: 4px;
}
.severity-label.critical { background: #fee2e2; color: #dc2626; }
.severity-label.high { background: #ffedd5; color: #ea580c; }
.severity-label.medium { background: #fef9c3; color: #ca8a04; }
.severity-label.low { background: #e0f2fe; color: #0284c7; }
.input-group {
  display: flex;
  align-items: center;
  gap: 8px;
}
.input {
  width: 100px;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
  text-align: right;
}
.unit {
  font-size: 13px;
  color: #666;
}
.hint {
  font-size: 12px;
  color: #999;
}
.form-actions {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
}
.btn {
  padding: 8px 16px;
  border: 1px solid #ddd;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  background: #fff;
}
.btn-primary {
  background: #4361ee;
  color: #fff;
  border-color: #4361ee;
}
.btn-primary:hover {
  background: #3a56d4;
}
.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.success {
  margin-top: 12px;
  padding: 8px 12px;
  background: #d1fae5;
  border-radius: 6px;
  font-size: 14px;
  color: #065f46;
}
.error {
  margin-top: 12px;
  padding: 8px 12px;
  background: #fee2e2;
  border-radius: 6px;
  font-size: 14px;
  color: #dc2626;
}
.loading {
  text-align: center;
  padding: 24px;
  color: #999;
}
</style>
