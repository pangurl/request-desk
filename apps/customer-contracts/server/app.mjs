import express from 'express'
import {DatabaseSync} from 'node:sqlite'
import {randomBytes,scryptSync,timingSafeEqual,createHash} from 'node:crypto'
import {fileURLToPath} from 'node:url'

const statuses = new Set(['draft','pending','returned','active'])
const hashToken = token => createHash('sha256').update(token).digest('hex')
const passwordHash = (password,salt) => scryptSync(password,salt,32).toString('hex')
class ApiError extends Error { constructor(status,message){super(message);this.status=status} }
function fail(status,message){throw new ApiError(status,message)}
function textField(value,label,max=120,required=true) {
  if(typeof value!=='string'||value.trim().length>max||(required&&!value.trim()))fail(422,label+'格式不正确')
  return value.trim()
}
function version(value){if(!Number.isSafeInteger(value)||value<1)fail(422,'版本号无效');return value}
function pagination(query){
 const page=Math.max(1,Math.min(100000,Number(query.page)||1))
 const size=Math.max(1,Math.min(50,Number(query.size)||10))
 if(!Number.isInteger(page)||!Number.isInteger(size))fail(422,'分页参数无效')
 return {page,size,offset:(page-1)*size}
}
export function createApp({databasePath=':memory:',initialPassword='LocalDemo2026!',trustProxy=false}={}) {
 const db=new DatabaseSync(databasePath)
 db.exec(`
 PRAGMA foreign_keys=ON;
 PRAGMA journal_mode=WAL;
 PRAGMA busy_timeout=5000;
 CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY, tenant_id INTEGER NOT NULL,username TEXT UNIQUE NOT NULL,role TEXT NOT NULL,salt TEXT NOT NULL,password_hash TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY,user_id INTEGER REFERENCES users(id),expires INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS login_limits(username TEXT PRIMARY KEY, failures INTEGER NOT NULL, reset_at INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS customers(id INTEGER PRIMARY KEY,tenant_id INTEGER NOT NULL,name TEXT NOT NULL,contact TEXT NOT NULL,email TEXT NOT NULL,industry TEXT NOT NULL,status TEXT NOT NULL,version INTEGER NOT NULL DEFAULT 1, UNIQUE(id,tenant_id));
 CREATE TABLE IF NOT EXISTS contracts(id INTEGER PRIMARY KEY,tenant_id INTEGER NOT NULL,customer_id INTEGER NOT NULL,title TEXT NOT NULL,amount_cents INTEGER NOT NULL,start_date TEXT NOT NULL,end_date TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'draft',version INTEGER NOT NULL DEFAULT 1,created_by INTEGER NOT NULL REFERENCES users(id),updated_at TEXT NOT NULL, FOREIGN KEY(customer_id,tenant_id) REFERENCES customers(id,tenant_id));
 CREATE TABLE IF NOT EXISTS events(id INTEGER PRIMARY KEY,tenant_id INTEGER NOT NULL,actor TEXT NOT NULL,entity TEXT NOT NULL,entity_id INTEGER NOT NULL,action TEXT NOT NULL,note TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL);
 CREATE INDEX IF NOT EXISTS customers_tenant_idx ON customers(tenant_id,id);
 CREATE INDEX IF NOT EXISTS contracts_tenant_status_idx ON contracts(tenant_id,status,id);
 CREATE INDEX IF NOT EXISTS contracts_customer_idx ON contracts(tenant_id,customer_id,id);
 CREATE INDEX IF NOT EXISTS events_tenant_idx ON events(tenant_id,id);
 `)
 function transaction(action){db.exec('BEGIN IMMEDIATE');try{const result=action();db.exec('COMMIT');return result}catch(e){db.exec('ROLLBACK');throw e}}
 function event(user,entity,id,action,note=''){
  db.prepare('INSERT INTO events(tenant_id,actor,entity,entity_id,action,note,created_at) VALUES(?,?,?,?,?,?,?)').run(user.tenant_id,user.username,entity,id,action,note,new Date().toISOString())
 }
 transaction(()=>{
  for(const [username,role,tenant] of [['admin','admin',1],['sales','sales',1],['viewer','viewer',1],['tenant2','admin',2]]){
   if(db.prepare('SELECT id FROM users WHERE username=?').get(username))continue
   const salt=randomBytes(16).toString('hex')
   db.prepare('INSERT INTO users(tenant_id,username,role,salt,password_hash) VALUES(?,?,?,?,?)').run(tenant,username,role,salt,passwordHash(initialPassword,salt))
  }
  if(!db.prepare('SELECT id FROM customers LIMIT 1').get()){
   db.prepare('INSERT INTO customers(tenant_id,name,contact,email,industry,status) VALUES(?,?,?,?,?,?)').run(1,'星河设计（示例）','林女士','contact@example.com','设计服务','active')
   db.prepare('INSERT INTO customers(tenant_id,name,contact,email,industry,status) VALUES(?,?,?,?,?,?)').run(2,'远山科技（示例）','陈先生','sales@example.com','软件服务','active')
  }
 })
 const app=express()
 if(trustProxy)app.set('trust proxy',1)
 app.disable('x-powered-by')
 app.use(express.json({limit:'64kb'}))
 app.use((req,res,next)=>{
  res.set({'X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin','Cache-Control':req.path.startsWith('/api')?'no-store':'public, max-age=0'})
  if(!['GET','HEAD','OPTIONS'].includes(req.method)&&req.headers.origin){
   let origin;try{origin=new URL(req.headers.origin)}catch{return res.status(403).json({error:'请求来源无效'})}
   if(origin.host!==req.headers.host) return res.status(403).json({error:'请求来源不匹配'})
  }
  next()
 })
 app.use((req,res,next)=>{req.body??={};next()})
 app.post('/api/login',(req,res)=>{
  const username=textField(req.body.username,'用户名',60), password=textField(req.body.password,'密码',200)
  const now=Date.now(), limit=db.prepare('SELECT * FROM login_limits WHERE username=?').get(username)
  if(limit&&limit.reset_at>now&&limit.failures>=8)fail(429,'尝试过于频繁，请 15 分钟后重试')
  const user=db.prepare('SELECT * FROM users WHERE username=?').get(username)
  const actual=passwordHash(password,user?.salt??'missing-account-salt')
  if(!user||!timingSafeEqual(Buffer.from(actual,'hex'),Buffer.from(user.password_hash,'hex'))){
   db.prepare('INSERT INTO login_limits VALUES(?,?,?) ON CONFLICT(username) DO UPDATE SET failures=?,reset_at=?').run(username,1,now+900000,limit&&limit.reset_at>now?limit.failures+1:1,now+900000)
   fail(401,'用户名或密码错误')
  }
  db.prepare('DELETE FROM login_limits WHERE username=?').run(username)
  db.prepare('DELETE FROM sessions WHERE expires<?').run(now)
  const token=randomBytes(32).toString('hex')
  db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(hashToken(token),user.id,now+8*3600000)
  res.cookie('session',token,{httpOnly:true,sameSite:'strict',secure:req.secure,maxAge:8*3600000,path:'/'})
  res.json({username:user.username,role:user.role,tenant_id:user.tenant_id})
 })
 app.use('/api',(req,res,next)=>{
  const token=(req.headers.cookie??'').split(';').map(s=>s.trim()).find(s=>s.startsWith('session='))?.slice(8)
  const user=token&&db.prepare('SELECT u.id,u.tenant_id,u.username,u.role FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.token_hash=? AND s.expires>?').get(hashToken(token),Date.now())
  if(!user)return res.status(401).json({error:'请先登录'})
  req.user=user;next()
 })
 const canWrite=(req,res,next)=>{if(!['sales','admin'].includes(req.user.role))fail(403,'当前账号没有写入权限');next()}
 app.get('/api/me',(req,res)=>res.json(req.user))
 app.post('/api/logout',(req,res)=>{
  const token=(req.headers.cookie??'').split(';').map(s=>s.trim()).find(s=>s.startsWith('session='))?.slice(8)
  if(token)db.prepare('DELETE FROM sessions WHERE token_hash=?').run(hashToken(token))
  res.clearCookie('session',{path:'/'}).json({ok:true})
 })
 function customerInput(body){
  const result={name:textField(body.name,'客户名称'),contact:textField(body.contact,'联系人'),email:textField(body.email,'邮箱',160,false),industry:textField(body.industry,'行业',60),status:body.status}
  if(result.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result.email))fail(422,'邮箱格式不正确')
  if(!['active','inactive'].includes(result.status))fail(422,'客户状态无效')
  return result
 }
 function customer(id,user){
  const row=db.prepare('SELECT * FROM customers WHERE id=? AND tenant_id=?').get(id,user.tenant_id)
  if(!row)fail(404,'客户不存在');return row
 }
 function contract(id,user){
  const row=db.prepare('SELECT c.*,u.name customer_name FROM contracts c JOIN customers u ON u.id=c.customer_id AND u.tenant_id=c.tenant_id WHERE c.id=? AND c.tenant_id=?').get(id,user.tenant_id)
  if(!row)fail(404,'合同不存在');return row
 }
 app.get('/api/customers',(req,res)=>{
  const {page,size,offset}=pagination(req.query),q=String(req.query.q??'').slice(0,120),status=String(req.query.status??'')
  const where='tenant_id=? AND (name LIKE ? OR contact LIKE ?) AND (?=\'\' OR status=?)'
  const params=[req.user.tenant_id,'%'+q+'%','%'+q+'%',status,status]
  res.json({items:db.prepare('SELECT * FROM customers WHERE '+where+' ORDER BY id DESC LIMIT ? OFFSET ?').all(...params,size,offset),total:db.prepare('SELECT count(*) n FROM customers WHERE '+where).get(...params).n,page,size})
 })
 app.get('/api/customer-options',(req,res)=>res.json(db.prepare("SELECT id,name,contact FROM customers WHERE tenant_id=? AND status='active' ORDER BY name").all(req.user.tenant_id)))
 app.get('/api/customers/:id',(req,res)=>{
  const row=customer(Number(req.params.id),req.user)
  res.json({...row,contracts:db.prepare('SELECT * FROM contracts WHERE customer_id=? AND tenant_id=? ORDER BY id DESC').all(row.id,req.user.tenant_id)})
 })
 app.post('/api/customers',canWrite,(req,res)=>{
  const v=customerInput(req.body)
  const id=transaction(()=>{const result=db.prepare('INSERT INTO customers(tenant_id,name,contact,email,industry,status) VALUES(?,?,?,?,?,?)').run(req.user.tenant_id,v.name,v.contact,v.email,v.industry,v.status);event(req.user,'customer',Number(result.lastInsertRowid),'create');return Number(result.lastInsertRowid)})
  res.status(201).json(customer(id,req.user))
 })
 app.put('/api/customers/:id',canWrite,(req,res)=>{
  const id=Number(req.params.id),v=customerInput(req.body),ver=version(req.body.version)
  transaction(()=>{customer(id,req.user);const result=db.prepare('UPDATE customers SET name=?,contact=?,email=?,industry=?,status=?,version=version+1 WHERE id=? AND tenant_id=? AND version=?').run(v.name,v.contact,v.email,v.industry,v.status,id,req.user.tenant_id,ver);if(!result.changes)fail(409,'客户已更新，请刷新后核对');event(req.user,'customer',id,'update')})
  res.json(customer(id,req.user))
 })
 function filters(req){
  const q=String(req.query.q??'').slice(0,120),state=String(req.query.status??'')
  if(state&&!statuses.has(state))fail(422,'合同状态无效')
  const id=req.query.customer_id?Number(req.query.customer_id):0
  if(!Number.isSafeInteger(id)||id<0)fail(422,'客户编号无效')
  return {where:"c.tenant_id=? AND (c.title LIKE ? OR u.name LIKE ?) AND (?='' OR c.status=?) AND (?=0 OR c.customer_id=?)",params:[req.user.tenant_id,'%'+q+'%','%'+q+'%',state,state,id,id]}
 }
 const join=' FROM contracts c JOIN customers u ON u.id=c.customer_id AND u.tenant_id=c.tenant_id WHERE '
 app.get('/api/contracts/export',(req,res)=>{
  const {where,params}=filters(req)
  const rows=db.prepare('SELECT c.id,c.title,u.name,c.amount_cents,c.status'+join+where+' ORDER BY c.id DESC LIMIT 10001').all(...params)
  if(rows.length>10000)fail(422,'导出超过 10000 条，请缩小筛选范围')
  const cell=v=>'"'+String(v).replace(/^[=+\-@\t\r]/,"'$&").replaceAll('"','""')+'"'
  const csv=[['编号','合同名称','客户','金额（元）','状态'],...rows.map(r=>['CT-'+r.id,r.title,r.name,(r.amount_cents/100).toFixed(2),r.status])].map(r=>r.map(cell).join(',')).join('\r\n')
  event(req.user,'contract',0,'export')
  res.set({'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename=contracts.csv'}).send('\uFEFF'+csv)
 })
 app.get('/api/contracts',(req,res)=>{
  const {page,size,offset}=pagination(req.query),{where,params}=filters(req)
  res.json({items:db.prepare('SELECT c.*,u.name customer_name'+join+where+' ORDER BY c.id DESC LIMIT ? OFFSET ?').all(...params,size,offset),total:db.prepare('SELECT count(*) n'+join+where).get(...params).n,page,size})
 })
 app.get('/api/contracts/:id',(req,res)=>{
  const row=contract(Number(req.params.id),req.user)
  res.json({...row,events:db.prepare("SELECT * FROM events WHERE tenant_id=? AND entity='contract' AND entity_id=? ORDER BY id DESC").all(req.user.tenant_id,row.id)})
 })
 function contractInput(body,user){
  const title=textField(body.title,'合同名称')
  const cust=customer(body.customer_id,user)
  if(cust.status!=='active')fail(422,'请选择启用中的客户')
  const amount=body.amount_cents
  if(!Number.isSafeInteger(amount)||amount<=0||amount>1e12)fail(422,'合同金额必须为正数且不超过一百亿元')
  const dates=[body.start_date,body.end_date]
  for(const d of dates){if(typeof d!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(d)||Number.isNaN(Date.parse(d))||new Date(d).toISOString().slice(0,10)!==d)fail(422,'合同日期无效')}
  if(dates[0]>dates[1])fail(422,'结束日期不得早于开始日期')
  return {title,customer_id:cust.id,amount_cents:amount,start_date:dates[0],end_date:dates[1]}
 }
 app.post('/api/contracts',canWrite,(req,res)=>{
  const v=contractInput(req.body,req.user)
  const id=transaction(()=>{const result=db.prepare('INSERT INTO contracts(tenant_id,customer_id,title,amount_cents,start_date,end_date,created_by,updated_at) VALUES(?,?,?,?,?,?,?,?)').run(req.user.tenant_id,v.customer_id,v.title,v.amount_cents,v.start_date,v.end_date,req.user.id,new Date().toISOString());event(req.user,'contract',Number(result.lastInsertRowid),'create');return Number(result.lastInsertRowid)})
  res.status(201).json(contract(id,req.user))
 })
 app.put('/api/contracts/:id',canWrite,(req,res)=>{
  const id=Number(req.params.id),v=contractInput(req.body,req.user),ver=version(req.body.version)
  transaction(()=>{const old=contract(id,req.user);if(!['draft','returned'].includes(old.status))fail(409,'当前状态不允许编辑，请刷新核对')
   const result=db.prepare('UPDATE contracts SET customer_id=?,title=?,amount_cents=?,start_date=?,end_date=?,version=version+1,updated_at=? WHERE id=? AND tenant_id=? AND version=?').run(v.customer_id,v.title,v.amount_cents,v.start_date,v.end_date,new Date().toISOString(),id,req.user.tenant_id,ver)
   if(!result.changes)fail(409,'合同已更新，请刷新后核对');event(req.user,'contract',id,'update')})
  res.json(contract(id,req.user))
 })
 app.post('/api/contracts/:id/actions',canWrite,(req,res)=>{
  const id=Number(req.params.id),ver=version(req.body.version),action=req.body.action
  if(!['submit','approve','return'].includes(action))fail(422,'操作无效')
  const note=typeof req.body.note==='string'?req.body.note.trim():''
  if(note.length>500||(action==='return'&&!note))fail(422,'退回原因须为 1–500 字')
  transaction(()=>{
   const row=contract(id,req.user)
   if(row.version!==ver)fail(409,'合同已更新，请刷新后核对')
   if(action==='submit'&&!['draft','returned'].includes(row.status))fail(409,'当前状态无法提交')
   if(action!=='submit'&&req.user.role!=='admin')fail(403,'仅管理员可以审核')
   if(action!=='submit'&&row.status!=='pending')fail(409,'仅待审核合同可以处理')
   if(action==='submit'&&customer(row.customer_id,req.user).status!=='active')fail(422,'客户已停用，无法提交合同')
   const next=action==='submit'?'pending':action==='approve'?'active':'returned'
   db.prepare('UPDATE contracts SET status=?,version=version+1,updated_at=? WHERE id=? AND tenant_id=?').run(next,new Date().toISOString(),id,req.user.tenant_id)
   event(req.user,'contract',id,action,note)
  })
  res.json(contract(id,req.user))
 })
 app.get('/api/events',(req,res)=>{
  if(req.user.role!=='admin')fail(403,'仅管理员可查看操作日志')
  const {page,size,offset}=pagination(req.query)
  res.json({items:db.prepare('SELECT * FROM events WHERE tenant_id=? ORDER BY id DESC LIMIT ? OFFSET ?').all(req.user.tenant_id,size,offset),total:db.prepare('SELECT count(*) n FROM events WHERE tenant_id=?').get(req.user.tenant_id).n})
 })
 app.get('/api/dashboard',(req,res)=>{
  res.json({customers:db.prepare('SELECT count(*) n FROM customers WHERE tenant_id=?').get(req.user.tenant_id).n,states:db.prepare('SELECT status,count(*) count,sum(amount_cents) amount FROM contracts WHERE tenant_id=? GROUP BY status').all(req.user.tenant_id)})
 })
 app.use('/api',(req,res)=>res.status(404).json({error:'接口不存在'}))
 app.use(express.static(fileURLToPath(new URL('../dist/',import.meta.url))))
 app.get('/{*path}',(req,res)=>res.sendFile(fileURLToPath(new URL('../dist/index.html',import.meta.url))))
 app.use((error,req,res,next)=>{if(res.headersSent)return next(error);const status=error.status??500;if(status>=500)console.error(error);res.status(status).json({error:status>=500?'服务处理失败，请稍后重试':error.message})})
 return {app,close:()=>db.close()}
}
