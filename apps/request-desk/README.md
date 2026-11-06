# RequestDesk · 企业采购申请与审批台

基于 Vben Admin 派生仓库中的独立 React 应用。上游基线为 `26706d65c9401a7818cf83369081c26b68990ef7`，沿用工作区及后台组织方式，应用使用自己的 React 运行时。Nova Button 取自 shadcn/ui 的 radix-nova registry，源码保存在 ui/。

## 功能与验证

- 采购申请、待审队列、审批历史，支持搜索、状态筛选和分页。
- 服务端校验角色、字段、单据状态与版本。
- 接口测试覆盖审批流、并发冲突和重启后的数据保留。

## 本地运行

需要 Node.js 24 或更新版本。

```sh
cd apps/request-desk
npm ci
npm test
npm run build
npm start
```

访问 http://localhost:3001 。开发模式分别运行 `npm start` 和 `npm run dev`，Vite 将 /api 转发到 3001。默认数据库为工作目录下的 request-desk.sqlite，可通过 REQUEST_DESK_DB 指定路径。

## 演示流程

选择「新员工显示器采购」。用申请人角色编辑并提交。切换为审核人，在待审队列中输入原因并退回。切回申请人修改金额并重提。以审核人通过，回到详情查看完整时间线。也可从空白表单新建申请、保存草稿再提交。

演示角色由客户端切换，方便单人验证流程。服务端检查角色与操作的匹配，但角色本身没有身份认证。演示数据使用虚构企业，适合本地运行。分栏由 react-resizable-panels 提供，Motion 用于详情过渡，Zustand 管理界面选择，Lucide 统一图标。审批动作采用显式按钮，
