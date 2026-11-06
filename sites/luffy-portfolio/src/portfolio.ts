export const projects = [
  {id:'request-desk', number:'01', name:'Request Desk', title:'企业采购申请与审批台',
   description:'让申请人和审核人在同一工作台处理草稿、退回、重提和通过，并查看完整的处理历史。',
   steps:['创建申请并填写采购用途与预算','审核人填写原因并退回','申请人更新信息并重新提交','审核通过并核对操作时间线'],
   details:'React、Node.js、SQLite。服务端校验审批状态和版本，处理并发审核冲突。在线演示的数据保存在当前浏览器。',
   demo:'https://request-desk-pangurl.ddpangur.chatgpt.site', source:'https://github.com/pangurl/request-desk', sourceLabel:'Request Desk 源码'},
  {id:'issue-desk', number:'02', name:'Issue Desk', title:'GitHub 问题受理台',
   description:'同步公开 GitHub 仓库的 Issue，在列表与详情间快速查看上下文、标记处理决定。',
   steps:['载入示例或输入公开仓库并同步','筛选标签或远端状态','打开详情并保存受理决定','查看同步记录和失败原因'],
   details:'React、GitHub REST API、浏览器持久化。受理决定和 GitHub 原始状态分别保存，重复同步按 Issue ID 合并。示例数据来自 Evidence Scout。',
   demo:'https://issue-desk-pangurl.ddpangur.chatgpt.site', source:'https://github.com/pangurl/request-desk/tree/main/sites/issue-desk', sourceLabel:'Issue Desk 源码'},
]
