# Web 业务系统与开发作品集

本仓库收录采购审批工作台、GitHub Issue 受理台、客户与合同管理系统，以及个人开发作品集。

| 目录 | 运行方式与数据来源 |
| --- | --- |
| [客户与合同管理系统](apps/customer-contracts/) | Vue 3 + TypeScript + Element Plus + Node.js + SQLite。支持客户建档、合同审核、角色权限、租户隔离、导出和操作追溯，含完整需求与运行说明。 |
| [采购审批工作台](apps/request-desk/) | React + Node.js HTTP API + SQLite。支持草稿、提交、退回、重新提交和审批，使用版本检查处理并发更新。 |
| [采购审批浏览器版](sites/request-desk-demo/) | 可单独构建的交互预览，流程和数据保存在当前浏览器。 |
| [GitHub Issue 受理台](sites/issue-desk/) | 支持实时同步公开仓库，也提供示例数据。受理标记与备注保存在当前浏览器。 |
| [作品集源码](sites/luffy-portfolio/) | Astro 页面源码，包含首页及两个项目详情。 |
| [静态站点文件](docs/) | 可从仓库下载后打开 `index.html`。GitHub Pages 如已配置，可使用 `main` 的 `/docs` 作为发布来源。 |

采购审批服务的本地启动、接口测试与角色边界见[运行说明](apps/request-desk/README.md)。
