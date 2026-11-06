import React, {useEffect,useState} from 'react'
import {createRoot} from 'react-dom/client'
import {ArrowLeft, ClipboardList, Inbox, Plus, RefreshCw, Search, ShieldCheck} from 'lucide-react'
import {MotionConfig,LazyMotion,domAnimation} from 'motion/react'
import {section as MotionSection} from "motion/react-m"
import {Group,Panel,Separator} from 'react-resizable-panels'
import {create} from 'zustand'
import {Button} from './ui/button'
import './style.css'

const useWorkspace = create(set=>({
  role:'applicant',view:'requests',selected:null,editing:false,
  navigate: patch=>set(patch),
}))
const statuses = {draft:'草稿',pending:'待审核',returned:'已退回',approved:'已通过'}
const actions = {save:'保存草稿',submit:'提交审核',return:'退回修改',approve:'审批通过'}
const money = amount => new Intl.NumberFormat('zh-CN',{style:'currency',currency:'CNY'}).format(amount/100)
const date = value => new Date(value).toLocaleString('zh-CN',{hour12:false})
const pageSize = 8

const storageKey = 'request-desk-demo-v1'
const seed = [{id:'sample-monitor',title:'新员工显示器采购',supplier:'明远办公设备',amount:625000,reason:'为五位新员工配备显示器。',status:'returned',version:2,history:[
  {action:'submit',actor:'applicant',at:'2026-11-04T02:00:00Z',note:''},
  {action:'return',actor:'reviewer',at:'2026-11-04T03:00:00Z',note:'请补充显示器支架费用后重新提交。'},
]}]
async function request(path, body) {
  const records = JSON.parse(localStorage.getItem(storageKey) || 'null') ?? structuredClone(seed)
  if (!body) return records
  const {actor,action,version} = body
  const current = records.find(item=>'/'+item.id===path)
  if (path && !current) throw new Error('申请不存在')
  const record = current ?? {id:crypto.randomUUID(),status:'draft',version:0,history:[]}
  if (record.version!==version) throw new Error('申请已被更新，请刷新后重试。')
  let note = ''
  if (action==='save' || action==='submit') {
    if (actor!=='applicant' || !['draft','returned'].includes(record.status)) throw new Error('当前角色或状态不允许修改')
    const {title,supplier,amount,reason} = body
    if (!title.trim() || (action==='submit' && (!supplier.trim() || !reason.trim() || amount<=0))) throw new Error('请检查标题、供应商、预算和采购用途。')
    Object.assign(record,{title:title.trim(),supplier:supplier.trim(),amount,reason:reason.trim()})
    if (action==='submit') record.status='pending'
  } else {
    if (actor!=='reviewer' || record.status!=='pending') throw new Error('仅审核人可以处理待审申请')
    note = body.note?.trim() ?? ''
    if (action==='return' && !note) throw new Error('请填写退回原因。')
    record.status = action==='approve' ? 'approved' : 'returned'
  }
  record.version++
  record.history.push({action,actor,at:new Date().toISOString(),note})
  if (!current) records.unshift(record)
  localStorage.setItem(storageKey,JSON.stringify(records))
  return record
}
function Badge({status}) {
  return <span className={'badge '+status}>{statuses[status]}</span>
}
function ApplicationForm({record,send,busy,cancel}) {
  const [draft,setDraft] = useState({
    title:record?.title ?? '',supplier:record?.supplier ?? '',
    amount:record?.amount ? (record.amount/100).toFixed(2) : '',reason:record?.reason ?? '',
  })
  const [invalid,setInvalid] = useState('')
  const update = key=>event=>setDraft({...draft,[key]:event.target.value})
  function submit(event) {
    event.preventDefault()
    const action = event.nativeEvent.submitter?.value ?? 'submit'
    const amount = draft.amount.trim()
    if (amount && !/^\d{1,10}(\.\d{1,2})?$/.test(amount)) return setInvalid('预算请输入非负金额，最多两位小数。')
    setInvalid('')
    send({...draft,action,amount:Math.round(Number(amount)*100)})
  }
  return <form className="detail" onSubmit={submit}>
    <h2>{record ? '编辑申请' : '新建采购申请'}</h2>
    <label>采购标题<input required maxLength={120} value={draft.title} onChange={update('title')}/></label>
    <label>供应商<input maxLength={120} value={draft.supplier} onChange={update('supplier')}/></label>
    <label>预算金额（人民币）<input inputMode="decimal" value={draft.amount} onChange={update('amount')}/></label>
    <label>采购用途<textarea maxLength={2000} rows={4} value={draft.reason} onChange={update('reason')}/></label>
    {invalid && <p role="alert" className="error">{invalid}</p>}
    <div className="actions">
      <Button type="button" variant="ghost" onClick={cancel}>取消</Button>
      <Button type="submit" variant="outline" value="save" disabled={busy}>保存草稿</Button>
      <Button type="submit" value="submit" disabled={busy}>提交审核</Button>
    </div>
  </form>
}
function Detail({record,role,busy,send,edit}) {
  const [returning,setReturning] = useState(false)
  const [note,setNote] = useState('')
  if (!record) return <div className="empty">选择一条申请查看明细与审批记录。</div>
  return <MotionSection initial={{opacity:0,y:5}} animate={{opacity:1,y:0}} className="detail">
    <div className="eyebrow">采购申请</div><h2>{record.title}</h2><Badge status={record.status}/>
    <dl><dt>供应商</dt><dd>{record.supplier || '—'}</dd><dt>预算</dt><dd>{money(record.amount)}</dd>
    <dt>采购用途</dt><dd>{record.reason || '—'}</dd></dl>
    {role==='applicant' && ['draft','returned'].includes(record.status) && <Button onClick={edit}>编辑申请</Button>}
    {role==='reviewer' && record.status==='pending' && <div className="actions">
      <Button onClick={()=>send({action:'approve'})} disabled={busy}>审批通过</Button>
      <Button variant="outline" onClick={()=>setReturning(!returning)} disabled={busy}>退回修改</Button>
    </div>}
    {returning && role==='reviewer' && record.status==='pending' &&
      <form onSubmit={event=>{event.preventDefault();send({action:'return',note})}}>
        <label>退回原因<textarea required maxLength={500} value={note} onChange={event=>setNote(event.target.value)}/></label>
        <Button type="submit" disabled={busy || !note.trim()}>确认退回</Button>
      </form>}
    <h3>操作记录</h3><ol className="timeline">{[...record.history].reverse().map((entry,index)=>
      <li key={index}><strong>{actions[entry.action]}</strong><small>{entry.actor==='reviewer'?'审核人':'申请人'} · {date(entry.at)}</small>{entry.note && <p>{entry.note}</p>}</li>)}</ol>
  </MotionSection>
}
function App() {
  const {role,view,selected,editing,navigate} = useWorkspace()
  const [records,setRecords] = useState([])
  const [loading,setLoading] = useState(true)
  const [busy,setBusy] = useState(false)
  const [error,setError] = useState('')
  const [notice,setNotice] = useState('')
  const [query,setQuery] = useState('')
  const [filter,setFilter] = useState('')
  const [page,setPage] = useState(1)
  const [mobileDetail,setMobileDetail] = useState(false)
  const [wide,setWide] = useState(()=>matchMedia('(min-width: 900px)').matches)
  useEffect(()=>{
    const media = matchMedia('(min-width: 900px)')
    const update = event=>setWide(event.matches)
    media.addEventListener('change',update)
    return ()=>media.removeEventListener('change',update)
  },[])
  async function load() {
    setLoading(true)
    setError('')
    try { setRecords(await request('')) }
    catch (failure) { setError(failure.message) }
    finally { setLoading(false) }
  }
  useEffect(()=>{load()},[])
  const record = records.find(item=>item.id===selected)
  const shown = records.filter(item=>
    (view!=='reviews' || item.status==='pending') && (!filter || item.status===filter) &&
    (item.title+' '+item.supplier).toLowerCase().includes(query.trim().toLowerCase()))
  const lastPage = Math.max(1,Math.ceil(shown.length/pageSize))
  const current = Math.min(page,lastPage)
  function open(patch) {
    setError('')
    setNotice('')
    setMobileDetail(true)
    navigate(patch)
  }
  function switchView(next) {
    navigate({view:next,selected:null,editing:false})
    setMobileDetail(false)
    setFilter('')
    setQuery('')
    setPage(1)
  }
  async function send(payload) {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const saved = await request(record ? '/'+record.id : '',{...payload,actor:role,version:record?.version ?? 0})
      setRecords(items=>record ? items.map(item=>item.id===saved.id?saved:item) : [saved,...items])
      navigate({selected:saved.id,editing:false})
      setNotice(actions[payload.action]+'成功')
    } catch (failure) { setError(failure.message) }
    finally { setBusy(false) }
  }
  const list = <section className="list">
    <div className="filters">
      <label className="search"><Search size={16}/><input aria-label="搜索申请" placeholder="搜索标题或供应商" value={query} onChange={event=>{setQuery(event.target.value);setPage(1)}}/></label>
      {view!=='reviews' && <select aria-label="按状态筛选" value={filter} onChange={event=>{setFilter(event.target.value);setPage(1)}}><option value="">全部状态</option>{Object.entries(statuses).map(([key,name])=><option key={key} value={key}>{name}</option>)}</select>}
    </div>
    {loading ? <div className="empty">正在加载…</div> : shown.length===0 ? <div className="empty">没有符合条件的申请。</div> :
    <table><thead><tr><th>申请 / 供应商</th><th>预算</th><th>状态</th></tr></thead><tbody>
      {shown.slice((current-1)*pageSize,current*pageSize).map(item=><tr key={item.id} className={selected===item.id?'selected':''}>
        <td><button className="record" onClick={()=>open({selected:item.id,editing:false})}>{item.title}</button><small>{item.supplier || '未填供应商'}</small></td>
        <td>{money(item.amount)}</td><td><Badge status={item.status}/></td>
      </tr>)}
    </tbody></table>}
    <footer><span>共 {shown.length} 条</span><Button variant="outline" size="sm" disabled={current===1} onClick={()=>setPage(current-1)}>上一页</Button><span>{current} / {lastPage}</span><Button variant="outline" size="sm" disabled={current===lastPage} onClick={()=>setPage(current+1)}>下一页</Button></footer>
  </section>
  const detail = editing
    ? <ApplicationForm key={selected ?? 'new'} record={record} busy={busy} send={send} cancel={()=>{navigate({editing:false});if(!record)setMobileDetail(false)}}/>
    : <Detail key={selected ?? 'empty'} record={record} role={role} busy={busy} send={send} edit={()=>navigate({editing:true})}/>
  return <div className="shell">
    <aside><div className="brand"><span><ClipboardList size={20}/></span> RequestDesk</div>
      <small>采购工作台</small>
      <Button variant={view==='requests'?'secondary':'ghost'} onClick={()=>switchView('requests')}><ClipboardList/> 采购申请</Button>
      <Button variant={view==='reviews'?'secondary':'ghost'} onClick={()=>switchView('reviews')}><Inbox/> 待审队列</Button>
      <div className="demo"><ShieldCheck size={16}/> 演示角色</div>
      <select aria-label="演示角色" value={role} disabled={busy} onChange={event=>{navigate({role:event.target.value,editing:false});setError('');setNotice('')}}><option value="applicant">申请人</option><option value="reviewer">审核人</option></select>
    </aside>
    <main>
      <header><div><div className="eyebrow">WORKSPACE / PROCUREMENT</div><h1>{view==='reviews'?'待审队列':'采购申请'}</h1></div>
        <div className="actions"><Button aria-label="刷新列表" variant="outline" onClick={load} disabled={loading || busy}><RefreshCw/></Button>
          {role==='applicant' && <Button onClick={()=>open({selected:null,editing:true})} disabled={busy}><Plus/> 新建申请</Button>}</div></header>
      {error && <div role="alert" className="error">{error}</div>}
      {notice && <div role="status" className="notice">{notice}</div>}
      <p className="demo-note">交互演示 · 数据仅保存在当前浏览器</p><div className="workspace">
      {wide ? <Group orientation="horizontal"><Panel defaultSize="55%" minSize="35%">{list}</Panel><Separator className="separator"/><Panel minSize="30%">{detail}</Panel></Group>
      : mobileDetail ? <><Button variant="ghost" onClick={()=>setMobileDetail(false)}><ArrowLeft/> 返回列表</Button>{detail}</> : list}
      </div>
    </main>
  </div>
}
createRoot(document.getElementById('root')).render(<MotionConfig reducedMotion="user"><LazyMotion features={domAnimation} strict><App/></LazyMotion></MotionConfig>)
