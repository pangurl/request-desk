import {createServer} from 'node:http'
import {DatabaseSync} from 'node:sqlite'
import {randomUUID} from 'node:crypto'
import {readFile} from 'node:fs/promises'
import {resolve, extname} from 'node:path'
import {fileURLToPath} from 'node:url'

const dist = fileURLToPath(new URL('./dist/', import.meta.url))
const roles = new Set(['applicant', 'reviewer'])
const label = {save:'保存草稿', submit:'提交审核', approve:'审批通过', return:'退回修改'}

export function createApp(databasePath = 'request-desk.sqlite') {
  const db = new DatabaseSync(databasePath)
  db.exec('CREATE TABLE IF NOT EXISTS requests (id TEXT PRIMARY KEY, data TEXT NOT NULL)')
  const read = db.prepare('SELECT data FROM requests WHERE id = ?')
  const write = db.prepare('INSERT INTO requests VALUES (?, ?)')
  const update = db.prepare("UPDATE requests SET data = ? WHERE id = ? AND json_extract(data, '$.version') = ?")
  if (!read.get('sample-monitor')) {
    const history = [
      {action:'submit',actor:'applicant',at:'2026-11-04T02:00:00Z',note:''},
      {action:'return',actor:'reviewer',at:'2026-11-04T03:00:00Z',note:'请补充显示器支架费用后重新提交。'},
    ]
    write.run('sample-monitor', JSON.stringify({id:'sample-monitor',title:'新员工显示器采购',supplier:'明远办公设备',amount:625000,reason:'为五位新员工配备显示器。',status:'returned',version:2,history}))
  }
  const server = createServer(async (req,res) => {
    const url = new URL(req.url,'http://localhost')
    const send = (code,data) => {
      res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'})
      res.end(JSON.stringify(data))
    }
    try {
      if (url.pathname === '/api/requests' && req.method === 'GET') {
        return send(200,db.prepare('SELECT data FROM requests ORDER BY rowid DESC').all().map(row=>JSON.parse(row.data)))
      }
      if (!url.pathname.startsWith('/api/')) {
        const path = /^\/assets\/[\w.-]+$/.test(url.pathname) ? resolve(dist,'.'+url.pathname) : resolve(dist,'index.html')
        const content = await readFile(path)
        const mime = {'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css'}
        res.writeHead(200,{'Content-Type':mime[extname(path)] ?? 'application/octet-stream'})
        return res.end(content)
      }
      const match = /^\/api\/requests(?:\/([\w-]+))?$/.exec(url.pathname)
      if (!match || req.method !== 'POST') return send(404,{error:'接口不存在'})
      let raw = ''
      for await (const chunk of req) {
        raw += chunk
        if (raw.length > 16384) return send(413,{error:'请求内容过长'})
      }
      let input
      try { input = JSON.parse(raw) } catch { return send(400,{error:'请求格式无效'}) }
      if (!input || typeof input !== 'object' || !roles.has(input.actor) || !Object.hasOwn(label,input.action)) return send(400,{error:'操作无效'})
      const {actor,action,version} = input
      const id = match[1] ?? randomUUID()
      const row = read.get(id)
      if (match[1] && !row) return send(404,{error:'申请不存在'})
      const record = row ? JSON.parse(row.data) : {id,version:0,status:'draft',history:[]}
      if (record.version !== version) return send(409,{error:'申请已被更新，请刷新后重试。'})
      let note = ''
      if (action === 'save' || action === 'submit') {
        if (actor !== 'applicant' || !['draft','returned'].includes(record.status)) return send(403,{error:'当前角色或状态不允许修改'})
        const clean = value => typeof value === 'string' ? value.trim() : ''
        const title = clean(input.title), supplier = clean(input.supplier), reason = clean(input.reason)
        const amount = input.amount
        if (!title || title.length > 120 || supplier.length > 120 || reason.length > 2000 || !Number.isSafeInteger(amount) || amount < 0 || (action === 'submit' && (!supplier || !reason || !amount))) return send(422,{error:'请检查标题、供应商、预算和采购用途。'})
        Object.assign(record,{title,supplier,reason,amount})
        if (action === 'submit') record.status = 'pending'
      } else {
        if (actor !== 'reviewer' || record.status !== 'pending') return send(403,{error:'仅审核人可以处理待审申请'})
        note = typeof input.note === 'string' ? input.note.trim() : ''
        if (note.length > 500 || (action === 'return' && !note)) return send(422,{error:'请填写 1–500 字的退回原因。'})
        record.status = action === 'approve' ? 'approved' : 'returned'
      }
      record.version += 1
      record.history.push({action,actor,at:new Date().toISOString(),note})
      const serialized = JSON.stringify(record)
      if (row) {
        if (!update.run(serialized,id,version).changes) return send(409,{error:'申请已被更新，请刷新后重试。'})
      } else {
        write.run(id,serialized)
      }
      return send(row ? 200 : 201,record)
    } catch (error) {
      if (error.code === 'ENOENT') return send(404,{error:'页面资源不存在，请先构建。'})
      console.error(error)
      return send(500,{error:'服务暂时无法处理请求'})
    }
  })
  server.on('close',()=>db.close())
  return server
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT ?? 3001)
  createApp(process.env.REQUEST_DESK_DB).listen(port,()=>console.log('RequestDesk listening on '+port))
}
