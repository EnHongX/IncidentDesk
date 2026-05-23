<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { fetchIncidents, type Incident } from '../api';

const router = useRouter();
const incidents = ref<Incident[]>([]);
const loading = ref(true);
const filterStatus = ref('');
const filterService = ref('');
const filterSeverity = ref('');

async function loadIncidents() {
  loading.value = true;
  const params: Record<string, string> = {};
  if (filterStatus.value) params.status = filterStatus.value;
  if (filterService.value) params.service = filterService.value;
  if (filterSeverity.value) params.severity = filterSeverity.value;
  incidents.value = await fetchIncidents(params);
  loading.value = false;
}

onMounted(loadIncidents);

function severityLabel(s: string) {
  const map: Record<string, string> = { critical: '严重', high: '高', medium: '中', low: '低' };
  return map[s] || s;
}

function statusLabel(s: string) {
  const map: Record<string, string> = { OPEN: '进行中', CLOSED: '已关闭', MERGED: '已合并' };
  return map[s] || s;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleString('zh-CN');
}
</script>

<template>
  <div class="incident-list">
    <div class="toolbar">
      <div class="filters">
        <select v-model="filterStatus" @change="loadIncidents()">
          <option value="">全部状态</option>
          <option value="OPEN">进行中</option>
          <option value="CLOSED">已关闭</option>
          <option value="MERGED">已合并</option>
        </select>
        <select v-model="filterSeverity" @change="loadIncidents()">
          <option value="">全部级别</option>
          <option value="critical">严重</option>
          <option value="high">高</option>
          <option value="medium">中</option>
          <option value="low">低</option>
        </select>
        <input
          v-model="filterService"
          placeholder="按服务筛选..."
          @keyup.enter="loadIncidents()"
        />
      </div>
    </div>

    <div v-if="loading" class="loading">加载中...</div>

    <table v-else-if="incidents.length > 0" class="table">
      <thead>
        <tr>
          <th>级别</th>
          <th>标题</th>
          <th>服务</th>
          <th>指纹</th>
          <th>告警数</th>
          <th>状态</th>
          <th>创建时间</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="inc in incidents"
          :key="inc.id"
          class="row-clickable"
          @click="router.push(`/incident/${inc.id}`)"
        >
          <td><span :class="['severity', inc.severity]">{{ severityLabel(inc.severity) }}</span></td>
          <td>{{ inc.title }}</td>
          <td>{{ inc.service }}</td>
          <td class="fingerprint">{{ inc.fingerprint }}</td>
          <td>{{ inc._count?.alerts ?? inc.alerts.length }}</td>
          <td><span :class="['status-badge', inc.status.toLowerCase()]">{{ statusLabel(inc.status) }}</span></td>
          <td>{{ formatTime(inc.createdAt) }}</td>
        </tr>
      </tbody>
    </table>

    <div v-else class="empty">暂无事件</div>
  </div>
</template>

<style scoped>
.incident-list { padding: 20px; }
.toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 10px; }
.filters { display: flex; gap: 10px; flex-wrap: wrap; }
.filters select, .filters input { padding: 6px 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; }
.loading, .empty { text-align: center; padding: 40px; color: #888; }
.table { width: 100%; border-collapse: collapse; }
.table th, .table td { padding: 10px 12px; text-align: left; border-bottom: 1px solid #eee; }
.table th { background: #f8f8f8; font-weight: 600; font-size: 13px; color: #555; }
.row-clickable { cursor: pointer; transition: background 0.15s; }
.row-clickable:hover { background: #f0f4ff; }
.severity { padding: 2px 8px; border-radius: 3px; font-size: 12px; font-weight: 600; color: #fff; }
.severity.critical { background: #e63946; }
.severity.high { background: #f77f00; }
.severity.medium { background: #f4a261; }
.severity.low { background: #4895ef; }
.status-badge { padding: 2px 8px; border-radius: 3px; font-size: 12px; font-weight: 500; }
.status-badge.open { background: #d4edda; color: #155724; }
.status-badge.closed { background: #e2e3e5; color: #383d41; }
.status-badge.merged { background: #cce5ff; color: #004085; }
.fingerprint { font-family: monospace; font-size: 12px; color: #666; max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
