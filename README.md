# IncidentDesk - 内部告警处置台

值班人员用来接收、分流、处理系统告警的轻量级工具。

## 技术栈

- **前端**: Vue 3 + Vite + Vue Router
- **后端**: Fastify + Zod 校验
- **数据库**: Prisma + SQLite
- **构建工具**: pnpm workspace

## 快速开始

```bash
# 1. 安装依赖
pnpm install

# 2. 初始化数据库
pnpm db:push

# 3. 导入示例数据
pnpm db:seed

# 4. 启动开发服务器（前后端同时启动）
pnpm dev
```

启动后访问:
- 前端: http://localhost:5173
- 后端 API: http://localhost:3000

## 功能

### 告警导入
- 通过 JSON 格式批量导入告警
- 基于 `externalId` 自动去重，不会产生重复告警

### 列表筛选
- 按状态筛选: 新告警 / 已认领 / 处理中 / 已解决 / 误报
- 按级别筛选: Critical / High / Medium / Low
- 按标题搜索

### 状态流转
支持四个操作，每次操作记录时间线:

| 操作 | 允许的源状态 | 目标状态 |
|------|-------------|---------|
| 认领 | NEW | CLAIMED |
| 开始处理 | CLAIMED | PROCESSING |
| 解决 | PROCESSING | RESOLVED |
| 标记误报 | NEW, CLAIMED, PROCESSING | FALSE_POSITIVE |

非法状态跳转会被拒绝（HTTP 422）。

## API 接口

```
POST /api/alerts/import     - 导入告警
GET  /api/alerts            - 列表（支持 ?status=&severity=&source=&search= 筛选）
GET  /api/alerts/:id        - 详情
POST /api/alerts/:id/action - 执行操作 { action, operator?, comment? }
GET  /api/health            - 健康检查
```

## 导入格式

```json
{
  "alerts": [
    {
      "externalId": "唯一标识（去重依据）",
      "title": "告警标题",
      "source": "来源系统",
      "severity": "critical | high | medium | low",
      "description": "详细描述（可选）",
      "metadata": { "任意扩展字段": "值" }
    }
  ]
}
```

## 测试

```bash
pnpm test
```

覆盖:
- 状态机: 所有合法/非法跳转路径
- 去重: 新增、全重复、部分重复、空数组

## 项目结构

```
packages/
├── backend/
│   ├── prisma/schema.prisma   - 数据模型
│   ├── src/
│   │   ├── index.ts           - Fastify 入口
│   │   ├── db.ts              - Prisma 客户端
│   │   ├── state-machine.ts   - 状态流转规则
│   │   ├── routes/alerts.ts   - API 路由
│   │   └── services/alert.service.ts - 业务逻辑
│   ├── seed/                  - 示例数据 & 种子脚本
│   └── tests/                 - 单元测试
└── frontend/
    └── src/
        ├── api.ts             - HTTP 客户端
        ├── views/AlertList.vue    - 告警列表
        └── views/AlertDetail.vue  - 告警详情 + 操作 + 时间线
```
