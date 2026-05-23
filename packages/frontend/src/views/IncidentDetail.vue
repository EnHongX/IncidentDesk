<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import {
  fetchIncident,
  fetchIncidents,
  mergeIncident,
  removeAlertFromIncident,
  closeIncident,
  type Incident,
} from '../api';

const props = defineProps<{ id: string }>();
const router = useRouter();
const incident = ref<Incident | null>(null);
const loading = ref(true);
const error = ref('');

// Merge modal
const showMerge = ref(false);
const mergeOperator = ref('');
const mergeComment = ref('');
const mergeSourceId = ref('');
const openIncidents = ref<Incident[]>([]);

// Remove alert modal
const showRemove = ref(false);
const removeAlertId = ref('');
const removeOperator = ref('');
const removeComment = ref('');

async function load() {
  loading.value = true;
  incident.value = await fetchIncident(props.id);
  loading.value = false;
}

onMounted(load);

async function openMergeModal() {
  openIncidents.value = (await fetchIncidents({ status: 'OPEN' })).filter(
    (i) => i.id !== props.id
  );
  showMerge.value = true;
}

async function doMerge() {
  if (!mergeSourceId.value || !mergeOperator.value) return;
  try {
    error.value = '';
    incident.value = await mergeIncident(
      props.id,
      mergeSourceId.value,
      mergeOperator.value,
      mergeComment.value || undefined
    );
    showMerge.value = false;
    mergeSourceId.value = '';
    mergeOperator.value = '';
    mergeComment.value = '';
  } catch (e: any) {
    error.value = e.message;
  }
}

function openRemoveModal(alertId: string) {
  removeAlertId.value = alertId;
  showRemove.value = true;
}

async function doRemove() {
  if (!removeAlertId.value || !removeOperator.value) return;
  try {
    error.value = '';
    incident.value = await removeAlertFromIncident(
      props.id,
      removeAlertId.value,
      removeOperator.value,
      removeComment.value || undefined
    );
    showRemove.value = false;
    removeAlertId.value = '';
    removeOperator.value = '';
    removeComment.value = '';
  } catch (e: any) {
    error.value = e.message;
  }
}

async function doClose() {
  const operator = prompt('操作人:');
  if (!operator) return;
  const comment = prompt('备注 (可选):') || undefined;
  try {
    error.value = '';
    incident.value = await closeIncident(props.id, operator, comment);
  } catch (e: any) {
    error.value = e.message;
  }
}

function severityLabel(s: string) {
  const map: Record<string, string> = { critical: '严重', high: '高', medium: '中', low: '低' };
  return map[s] || s;
}

function statusLabel(s: string) {
  const map: Record<string, string> = { OPEN: '进行中', CLOSED: '已关闭', MERGED: '已合并', NEW: '新建', CLAIMED: '已认领', PROCESSING: '处理中', RESOLVED: '已解决', FALSE_POSITIVE: '误报' };
  return map[s] || s;
}

function actionLabel(a: string) {
  const map: Record<string, string> = {
    CREATED: '创建事件',
    ALERT_ADDED: '告警归入',
    ALERT_REMOVED: '告警移出',
    MERGED_IN: '合并入',
    MERGED_OUT: '合并出',
    SEVERITY_UPGRADED: '级别升级',
    CLOSED: '关闭事件',
  };
  return map[a] || a;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleString('zh-CN');
}

function parseDetail(detail: string | null): Record<string, unknown> | null {
  if (!detail) return null;
  try { return JSON.parse(detail); } catch { return null; }
}
</script>

<template>
  <div class="incident-detail">
    <button class="btn-back" @click="router.push('/incidents')">← 返回事件列表</button>

    <div v-if="loading" class="loading">加载中...</div>

    <template v-else-if="incident">
      <div class="card">
        <div class="header-row">
          <span :class="['severity', incident.severity]">{{ severityLabel(incident.severity) }}</span>
          <span :class="['status-badge', incident.status.toLowerCase()]">{{ statusLabel(incident.status) }}</span>
          <h2>{{ incident.title }}</h2>
        </div>
        <div class="meta">
          <span><strong>服务:</strong> {{ incident.service }}</span>
          <span><strong>指纹:</strong> <code>{{ incident.fingerprint }}</code></span>
          <span><strong>创建:</strong> {{ formatTime(incident.createdAt) }}</span>
          <span><strong>告警数:</strong> {{ incident.alerts.length }}</span>
        </div>

        <div v-if="error" class="error-msg">{{ error }}</div>

        <div v-if="incident.status === 'OPEN'" class="actions">
          <button class="btn btn-primary" @click="openMergeModal">合并事件</button>
          <button class="btn btn-danger" @click="doClose">关闭事件</button>
        </div>
      </div>

      <!-- Alerts table -->
      <div class="section">
        <h3>关联告警 ({{ incident.alerts.length }})</h3>
        <table class="table">
          <thead>
            <tr>
              <th>级别</th>
              <th>标题</th>
              <th>外部ID</th>
              <th>状态</th>
              <th>时间</th>
              <th v-if="incident.status === 'OPEN'">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="alert in incident.alerts" :key="alert.id">
              <td><span :class="['severity', alert.severity]">{{ severityLabel(alert.severity) }}</span></td>
              <td>
                <a class="alert-link" @click.stop="router.push(`/alert/${alert.id}`)">{{ alert.title }}</a>
              </td>
              <td class="mono">{{ alert.externalId }}</td>
              <td>{{ statusLabel(alert.status) }}</td>
              <td>{{ formatTime(alert.createdAt) }}</td>
              <td v-if="incident.status === 'OPEN'">
                <button
                  v-if="incident.alerts.length > 1"
                  class="btn btn-sm"
                  @click="openRemoveModal(alert.id)"
                >移出</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Timeline -->
      <div class="section">
        <h3>事件时间线</h3>
        <div class="timeline">
          <div v-for="entry in incident.timeline" :key="entry.id" class="timeline-item">
            <div class="timeline-dot" :class="entry.action.toLowerCase()"></div>
            <div class="timeline-content">
              <div class="timeline-header">
                <strong>{{ actionLabel(entry.action) }}</strong>
                <span class="timeline-time">{{ formatTime(entry.createdAt) }}</span>
              </div>
              <div v-if="entry.operator" class="timeline-meta">操作人: {{ entry.operator }}</div>
              <div v-if="parseDetail(entry.detail)" class="timeline-detail">
                <template v-for="(val, key) in parseDetail(entry.detail)" :key="key">
                  <span class="detail-item">{{ key }}: {{ val }}</span>
                </template>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- Merge Modal -->
    <div v-if="showMerge" class="modal-overlay" @click.self="showMerge = false">
      <div class="modal">
        <h3>合并事件</h3>
        <p>将另一个事件的所有告警合并到当前事件中。</p>
        <div class="form-group">
          <label>选择源事件:</label>
          <select v-model="mergeSourceId">
            <option value="">请选择...</option>
            <option v-for="inc in openIncidents" :key="inc.id" :value="inc.id">
              {{ inc.title }} ({{ inc.service }} / {{ inc.alerts.length }}条告警)
            </option>
          </select>
        </div>
        <div class="form-group">
          <label>操作人:</label>
          <input v-model="mergeOperator" placeholder="请输入操作人" />
        </div>
        <div class="form-group">
          <label>备注:</label>
          <input v-model="mergeComment" placeholder="可选备注" />
        </div>
        <div class="modal-actions">
          <button class="btn" @click="showMerge = false">取消</button>
          <button class="btn btn-primary" @click="doMerge">确认合并</button>
        </div>
      </div>
    </div>

    <!-- Remove Alert Modal -->
    <div v-if="showRemove" class="modal-overlay" @click.self="showRemove = false">
      <div class="modal">
        <h3>移出告警</h3>
        <p>将该告警从当前事件中移出。</p>
        <div class="form-group">
          <label>操作人:</label>
          <input v-model="removeOperator" placeholder="请输入操作人" />
        </div>
        <div class="form-group">
          <label>备注:</label>
          <input v-model="removeComment" placeholder="可选备注" />
        </div>
        <div class="modal-actions">
          <button class="btn" @click="showRemove = false">取消</button>
          <button class="btn btn-primary" @click="doRemove">确认移出</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.incident-detail { padding: 20px; }
.btn-back { background: none; border: none; color: #4361ee; cursor: pointer; font-size: 14px; margin-bottom: 16px; padding: 0; }
.btn-back:hover { text-decoration: underline; }
.loading { text-align: center; padding: 40px; color: #888; }
.card { background: #fff; border: 1px solid #eee; border-radius: 8px; padding: 20px; margin-bottom: 20px; }
.header-row { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
.header-row h2 { margin: 0; font-size: 18px; }
.meta { display: flex; flex-wrap: wrap; gap: 16px; font-size: 13px; color: #555; }
.meta code { background: #f4f4f4; padding: 1px 4px; border-radius: 3px; font-size: 12px; }
.error-msg { background: #f8d7da; color: #721c24; padding: 8px 12px; border-radius: 4px; margin-top: 12px; font-size: 13px; }
.actions { margin-top: 16px; display: flex; gap: 10px; }
.btn { padding: 6px 14px; border: 1px solid #ddd; border-radius: 4px; cursor: pointer; font-size: 13px; background: #fff; }
.btn:hover { background: #f0f0f0; }
.btn-primary { background: #4361ee; color: #fff; border-color: #4361ee; }
.btn-primary:hover { background: #3a56d4; }
.btn-danger { background: #e63946; color: #fff; border-color: #e63946; }
.btn-danger:hover { background: #d32f3f; }
.btn-sm { padding: 3px 8px; font-size: 12px; }
.section { margin-bottom: 24px; }
.section h3 { font-size: 15px; margin-bottom: 12px; color: #333; }
.table { width: 100%; border-collapse: collapse; }
.table th, .table td { padding: 8px 10px; text-align: left; border-bottom: 1px solid #eee; font-size: 13px; }
.table th { background: #f8f8f8; font-weight: 600; color: #555; }
.alert-link { color: #4361ee; cursor: pointer; text-decoration: none; }
.alert-link:hover { text-decoration: underline; }
.mono { font-family: monospace; font-size: 12px; }
.severity { padding: 2px 8px; border-radius: 3px; font-size: 12px; font-weight: 600; color: #fff; }
.severity.critical { background: #e63946; }
.severity.high { background: #f77f00; }
.severity.medium { background: #f4a261; }
.severity.low { background: #4895ef; }
.status-badge { padding: 2px 8px; border-radius: 3px; font-size: 12px; font-weight: 500; }
.status-badge.open { background: #d4edda; color: #155724; }
.status-badge.closed { background: #e2e3e5; color: #383d41; }
.status-badge.merged { background: #cce5ff; color: #004085; }
.timeline { padding-left: 20px; border-left: 2px solid #e0e0e0; }
.timeline-item { position: relative; padding: 8px 0 16px 16px; }
.timeline-dot { position: absolute; left: -27px; top: 12px; width: 10px; height: 10px; border-radius: 50%; background: #4361ee; }
.timeline-dot.alert_added { background: #28a745; }
.timeline-dot.alert_removed { background: #e63946; }
.timeline-dot.merged_in, .timeline-dot.merged_out { background: #f77f00; }
.timeline-dot.severity_upgraded { background: #e63946; }
.timeline-dot.closed { background: #6c757d; }
.timeline-dot.created { background: #4361ee; }
.timeline-content { font-size: 13px; }
.timeline-header { display: flex; align-items: center; gap: 12px; }
.timeline-time { font-size: 12px; color: #888; }
.timeline-meta { font-size: 12px; color: #666; margin-top: 2px; }
.timeline-detail { margin-top: 4px; font-size: 12px; color: #555; display: flex; flex-wrap: wrap; gap: 8px; }
.detail-item { background: #f4f4f4; padding: 2px 6px; border-radius: 3px; }
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.modal { background: #fff; border-radius: 8px; padding: 24px; width: 90%; max-width: 500px; }
.modal h3 { margin: 0 0 8px; }
.modal p { margin: 0 0 16px; font-size: 13px; color: #666; }
.form-group { margin-bottom: 12px; }
.form-group label { display: block; font-size: 13px; margin-bottom: 4px; font-weight: 500; }
.form-group input, .form-group select { width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; box-sizing: border-box; }
.modal-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 16px; }
</style>
