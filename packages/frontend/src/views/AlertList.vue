<template>
  <div class="alert-list">
    <div class="toolbar">
      <div class="filters">
        <select v-model="filters.status" @change="loadAlerts">
          <option value="">全部状态</option>
          <option value="NEW">新告警</option>
          <option value="CLAIMED">已认领</option>
          <option value="PROCESSING">处理中</option>
          <option value="RESOLVED">已解决</option>
          <option value="FALSE_POSITIVE">误报</option>
        </select>
        <select v-model="filters.severity" @change="loadAlerts">
          <option value="">全部级别</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <input v-model="filters.search" placeholder="搜索标题..." @input="debounceLoad" />
      </div>
      <div class="toolbar-actions">
        <button class="btn" @click="showHandover = true">值班交接</button>
        <button class="btn btn-primary" @click="showImport = true">导入告警</button>
      </div>
    </div>

    <div v-if="loading" class="loading">加载中...</div>
    <div v-else-if="alerts.length === 0" class="empty">暂无告警数据</div>
    <table v-else class="table">
      <thead>
        <tr>
          <th>级别</th>
          <th>标题</th>
          <th>来源</th>
          <th>状态</th>
          <th>负责人</th>
          <th>SLA</th>
          <th>时间</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="alert in alerts" :key="alert.id" @click="$router.push(`/alert/${alert.id}`)" class="clickable">
          <td><span :class="['severity', alert.severity]">{{ alert.severity }}</span></td>
          <td>{{ alert.title }}</td>
          <td>{{ alert.source }}</td>
          <td><span :class="['status', alert.status.toLowerCase()]">{{ statusLabel(alert.status) }}</span></td>
          <td>{{ alert.assignee || '-' }}</td>
          <td>
            <span v-if="alert.sla && alert.sla.status === 'breached'" class="sla-badge breached">
              已超时 {{ formatDuration(Math.abs(alert.sla.remainingMs)) }}
            </span>
            <span v-else-if="alert.sla && alert.sla.status === 'approaching'" class="sla-badge approaching">
              即将超时 剩余{{ formatDuration(alert.sla.remainingMs) }}
            </span>
            <span v-else-if="alert.sla && alert.sla.status === 'ok'" class="sla-badge ok">
              剩余 {{ formatDuration(alert.sla.remainingMs) }}
            </span>
            <span v-else class="sla-badge none">-</span>
          </td>
          <td>{{ formatTime(alert.createdAt) }}</td>
        </tr>
      </tbody>
    </table>

    <!-- Import Modal -->
    <div v-if="showImport" class="modal-overlay" @click.self="showImport = false">
      <div class="modal">
        <h3>导入 JSON 告警</h3>
        <textarea v-model="importJson" placeholder='粘贴JSON数组，格式: [{"externalId":"...", "title":"...", "source":"...", "severity":"critical|high|medium|low", ...}]' rows="10"></textarea>
        <div class="modal-actions">
          <button class="btn" @click="showImport = false">取消</button>
          <button class="btn btn-primary" @click="doImport" :disabled="importing">
            {{ importing ? '导入中...' : '导入' }}
          </button>
        </div>
        <div v-if="importResult" class="import-result">
          导入 {{ importResult.imported }} 条，跳过 {{ importResult.skipped }} 条重复
        </div>
        <div v-if="importError" class="error">{{ importError }}</div>
      </div>
    </div>

    <!-- Handover Modal -->
    <div v-if="showHandover" class="modal-overlay" @click.self="showHandover = false">
      <div class="modal">
        <h3>值班交接</h3>
        <p class="modal-desc">将某位值班人名下所有未结束告警批量移交给另一位值班人。</p>
        <div class="form-group">
          <label>移交方（当前处理人）</label>
          <input v-model="handoverForm.from" placeholder="当前负责人姓名" class="input full" />
        </div>
        <div class="form-group">
          <label>接收方（新值班人）</label>
          <input v-model="handoverForm.to" placeholder="新负责人姓名" class="input full" />
        </div>
        <div class="form-group">
          <label>移交原因</label>
          <input v-model="handoverForm.reason" placeholder="如：下班交接 / 请假交接" class="input full" />
        </div>
        <div class="modal-actions">
          <button class="btn" @click="showHandover = false">取消</button>
          <button class="btn btn-primary" @click="doHandover" :disabled="handing">
            {{ handing ? '移交中...' : '确认移交' }}
          </button>
        </div>
        <div v-if="handoverResult" class="import-result">
          成功移交 {{ handoverResult.transferred }} 条告警
        </div>
        <div v-if="handoverError" class="error">{{ handoverError }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import {
  fetchAlerts,
  importAlerts as apiImport,
  handoverAlerts as apiHandover,
  type Alert,
  type ImportResult,
  type HandoverResult,
} from '../api';

const alerts = ref<Alert[]>([]);
const loading = ref(true);
const filters = ref({ status: '', severity: '', search: '' });

const showImport = ref(false);
const importJson = ref('');
const importing = ref(false);
const importResult = ref<ImportResult | null>(null);
const importError = ref('');

const showHandover = ref(false);
const handoverForm = ref({ from: '', to: '', reason: '' });
const handing = ref(false);
const handoverResult = ref<HandoverResult | null>(null);
const handoverError = ref('');

let debounceTimer: ReturnType<typeof setTimeout>;

function debounceLoad() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(loadAlerts, 300);
}

async function loadAlerts() {
  loading.value = true;
  const params: Record<string, string> = {};
  if (filters.value.status) params.status = filters.value.status;
  if (filters.value.severity) params.severity = filters.value.severity;
  if (filters.value.search) params.search = filters.value.search;
  alerts.value = await fetchAlerts(params);
  loading.value = false;
}

async function doImport() {
  importError.value = '';
  importResult.value = null;
  try {
    const data = JSON.parse(importJson.value);
    const items = Array.isArray(data) ? data : [data];
    importing.value = true;
    importResult.value = await apiImport(items);
    await loadAlerts();
    importJson.value = '';
  } catch (e: any) {
    importError.value = e.message || '导入失败';
  } finally {
    importing.value = false;
  }
}

async function doHandover() {
  handoverError.value = '';
  handoverResult.value = null;
  const { from, to, reason } = handoverForm.value;
  if (!from || !to || !reason) {
    handoverError.value = '请填写完整信息';
    return;
  }
  handing.value = true;
  try {
    handoverResult.value = await apiHandover(from, to, reason);
    await loadAlerts();
  } catch (e: any) {
    handoverError.value = e.message || '移交失败';
  } finally {
    handing.value = false;
  }
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

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString('zh-CN');
}

onMounted(loadAlerts);
</script>

<style scoped>
.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  flex-wrap: wrap;
  gap: 12px;
}
.toolbar-actions {
  display: flex;
  gap: 8px;
}
.filters {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.filters select, .filters input {
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
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
.table {
  width: 100%;
  border-collapse: collapse;
  background: #fff;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}
.table th {
  text-align: left;
  padding: 12px 16px;
  background: #f8f9fa;
  font-weight: 600;
  font-size: 13px;
  color: #666;
}
.table td {
  padding: 12px 16px;
  border-top: 1px solid #eee;
  font-size: 14px;
}
.clickable {
  cursor: pointer;
}
.clickable:hover {
  background: #f8f9ff;
}
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
  white-space: nowrap;
}
.sla-badge.ok { background: #d1fae5; color: #065f46; }
.sla-badge.approaching { background: #fef3c7; color: #92400e; }
.sla-badge.breached { background: #fee2e2; color: #dc2626; font-weight: 700; }
.sla-badge.none { color: #999; }
.loading, .empty {
  text-align: center;
  padding: 48px;
  color: #999;
}
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}
.modal {
  background: #fff;
  border-radius: 12px;
  padding: 24px;
  width: 600px;
  max-width: 90vw;
}
.modal h3 {
  margin-bottom: 16px;
}
.modal-desc {
  font-size: 13px;
  color: #666;
  margin-bottom: 16px;
}
.modal textarea {
  width: 100%;
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-family: monospace;
  font-size: 13px;
  resize: vertical;
}
.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 16px;
}
.form-group {
  margin-bottom: 12px;
}
.form-group label {
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: #555;
  margin-bottom: 4px;
}
.input {
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
}
.input.full {
  width: 100%;
}
.import-result {
  margin-top: 12px;
  padding: 8px 12px;
  background: #d1fae5;
  border-radius: 6px;
  font-size: 14px;
}
.error {
  margin-top: 12px;
  padding: 8px 12px;
  background: #fee2e2;
  border-radius: 6px;
  font-size: 14px;
  color: #dc2626;
}
</style>
