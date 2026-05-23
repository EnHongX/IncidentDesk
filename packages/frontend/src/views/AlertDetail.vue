<template>
  <div class="alert-detail" v-if="alert">
    <button class="btn back" @click="$router.push('/')">&larr; 返回列表</button>

    <div class="card">
      <div class="card-header">
        <span :class="['severity', alert.severity]">{{ alert.severity }}</span>
        <span :class="['status', alert.status.toLowerCase()]">{{ statusLabel(alert.status) }}</span>
        <span v-if="alert.sla" :class="['sla-badge', alert.sla.status]">
          {{ slaLabel(alert.sla) }}
        </span>
      </div>
      <h2>{{ alert.title }}</h2>
      <div class="meta">
        <span>来源: {{ alert.source }}</span>
        <span>ID: {{ alert.externalId }}</span>
        <span>负责人: {{ alert.assignee || '未认领' }}</span>
        <span>创建时间: {{ formatTime(alert.createdAt) }}</span>
        <span v-if="alert.sla">SLA时限: {{ alert.sla.deadlineMinutes }}分钟</span>
      </div>
      <p v-if="alert.description" class="description">{{ alert.description }}</p>
      <details v-if="alert.metadata" class="metadata">
        <summary>元数据</summary>
        <pre>{{ formatMetadata(alert.metadata) }}</pre>
      </details>
    </div>

    <div class="actions">
      <h3>操作</h3>
      <div class="action-bar">
        <input v-model="operator" placeholder="操作人" class="input" />
        <input v-model="comment" placeholder="备注（可选）" class="input input-wide" />
      </div>
      <div class="action-buttons">
        <button
          v-for="act in availableActions"
          :key="act.action"
          :class="['btn', act.class]"
          @click="doAction(act.action)"
          :disabled="acting"
        >
          {{ act.label }}
        </button>
      </div>
      <div v-if="actionError" class="error">{{ actionError }}</div>
    </div>

    <div class="timeline">
      <h3>时间线</h3>
      <div v-if="alert.timeline.length === 0" class="empty">暂无操作记录</div>
      <div v-else class="timeline-list">
        <div v-for="entry in alert.timeline" :key="entry.id" class="timeline-item">
          <div :class="['timeline-dot', entry.action === 'HANDOVER' ? 'handover' : '']"></div>
          <div class="timeline-content">
            <div class="timeline-header">
              <strong>{{ actionLabel(entry.action) }}</strong>
              <span class="timeline-time">{{ formatTime(entry.createdAt) }}</span>
            </div>
            <div class="timeline-detail">
              <span v-if="entry.operator">操作人: {{ entry.operator }}</span>
              <span v-if="entry.fromState && entry.toState">
                {{ statusLabel(entry.fromState) }} → {{ statusLabel(entry.toState) }}
              </span>
            </div>
            <div v-if="entry.comment" class="timeline-comment">{{ entry.comment }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
  <div v-else class="loading">加载中...</div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { fetchAlert, performAction, type Alert, type SlaStatus } from '../api';

const props = defineProps<{ id: string }>();
const alert = ref<Alert | null>(null);
const operator = ref('');
const comment = ref('');
const acting = ref(false);
const actionError = ref('');

const ACTION_DEFS = [
  { action: 'CLAIM', label: '认领', class: 'btn-claim', allowFrom: ['NEW'] },
  { action: 'START', label: '开始处理', class: 'btn-start', allowFrom: ['CLAIMED'] },
  { action: 'RESOLVE', label: '解决', class: 'btn-resolve', allowFrom: ['PROCESSING'] },
  { action: 'FALSE_POSITIVE', label: '标记误报', class: 'btn-fp', allowFrom: ['NEW', 'CLAIMED', 'PROCESSING'] },
];

const availableActions = computed(() => {
  if (!alert.value) return [];
  return ACTION_DEFS.filter((a) => a.allowFrom.includes(alert.value!.status));
});

async function doAction(action: string) {
  if (!alert.value) return;
  acting.value = true;
  actionError.value = '';
  try {
    alert.value = await performAction(alert.value.id, action, operator.value || undefined, comment.value || undefined);
    comment.value = '';
  } catch (e: any) {
    actionError.value = e.message;
  } finally {
    acting.value = false;
  }
}

function slaLabel(sla: SlaStatus): string {
  if (sla.status === 'breached') {
    const overMs = Math.abs(sla.remainingMs);
    return `已超时 ${formatDuration(overMs)}`;
  }
  if (sla.status === 'approaching') {
    return `即将超时 剩余${formatDuration(sla.remainingMs)}`;
  }
  return `剩余 ${formatDuration(sla.remainingMs)}`;
}

function formatDuration(ms: number): string {
  const totalMin = Math.floor(ms / 60000);
  if (totalMin < 60) return `${totalMin}m`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m > 0 ? `${h}h${m}m` : `${h}h`;
}

function statusLabel(s: string): string {
  const map: Record<string, string> = {
    NEW: '新告警', CLAIMED: '已认领', PROCESSING: '处理中',
    RESOLVED: '已解决', FALSE_POSITIVE: '误报',
  };
  return map[s] || s;
}

function actionLabel(a: string): string {
  const map: Record<string, string> = {
    CLAIM: '认领', START: '开始处理', RESOLVE: '解决',
    FALSE_POSITIVE: '标记误报', HANDOVER: '值班交接',
  };
  return map[a] || a;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString('zh-CN');
}

function formatMetadata(raw: string): string {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

onMounted(async () => {
  alert.value = await fetchAlert(props.id);
});
</script>

<style scoped>
.back {
  margin-bottom: 16px;
}
.card {
  background: #fff;
  border-radius: 8px;
  padding: 24px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  margin-bottom: 24px;
}
.card-header {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
  align-items: center;
}
.card h2 {
  margin-bottom: 12px;
  font-size: 18px;
}
.meta {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  font-size: 13px;
  color: #666;
  margin-bottom: 12px;
}
.description {
  margin-top: 12px;
  line-height: 1.6;
}
.metadata {
  margin-top: 12px;
}
.metadata pre {
  background: #f8f9fa;
  padding: 12px;
  border-radius: 6px;
  font-size: 13px;
  overflow-x: auto;
}
.actions {
  background: #fff;
  border-radius: 8px;
  padding: 24px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  margin-bottom: 24px;
}
.actions h3 {
  margin-bottom: 12px;
}
.action-bar {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}
.input {
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
}
.input-wide {
  flex: 1;
  min-width: 200px;
}
.action-buttons {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.btn {
  padding: 8px 16px;
  border: 1px solid #ddd;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  background: #fff;
}
.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.btn-claim { background: #e0e7ff; color: #4338ca; border-color: #c7d2fe; }
.btn-start { background: #fef3c7; color: #92400e; border-color: #fde68a; }
.btn-resolve { background: #d1fae5; color: #065f46; border-color: #a7f3d0; }
.btn-fp { background: #f3f4f6; color: #6b7280; border-color: #e5e7eb; }
.severity {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
}
.severity.critical { background: #fee2e2; color: #dc2626; }
.severity.high { background: #ffedd5; color: #ea580c; }
.severity.medium { background: #fef9c3; color: #ca8a04; }
.severity.low { background: #e0f2fe; color: #0284c7; }
.status {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
}
.status.new { background: #dbeafe; color: #1d4ed8; }
.status.claimed { background: #e0e7ff; color: #4338ca; }
.status.processing { background: #fef3c7; color: #92400e; }
.status.resolved { background: #d1fae5; color: #065f46; }
.status.false_positive { background: #f3f4f6; color: #6b7280; }
.sla-badge {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}
.sla-badge.ok { background: #d1fae5; color: #065f46; }
.sla-badge.approaching { background: #fef3c7; color: #92400e; }
.sla-badge.breached { background: #fee2e2; color: #dc2626; font-weight: 700; }
.timeline {
  background: #fff;
  border-radius: 8px;
  padding: 24px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}
.timeline h3 {
  margin-bottom: 16px;
}
.timeline-list {
  position: relative;
  padding-left: 24px;
}
.timeline-item {
  position: relative;
  padding-bottom: 16px;
}
.timeline-item:not(:last-child)::before {
  content: '';
  position: absolute;
  left: -18px;
  top: 10px;
  bottom: -6px;
  width: 2px;
  background: #e5e7eb;
}
.timeline-dot {
  position: absolute;
  left: -22px;
  top: 6px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #4361ee;
}
.timeline-dot.handover {
  background: #f59e0b;
}
.timeline-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}
.timeline-time {
  font-size: 12px;
  color: #999;
}
.timeline-detail {
  font-size: 13px;
  color: #666;
  display: flex;
  gap: 12px;
}
.timeline-comment {
  margin-top: 4px;
  font-size: 13px;
  color: #555;
  font-style: italic;
}
.error {
  margin-top: 12px;
  padding: 8px 12px;
  background: #fee2e2;
  border-radius: 6px;
  font-size: 14px;
  color: #dc2626;
}
.loading, .empty {
  text-align: center;
  padding: 24px;
  color: #999;
}
</style>
