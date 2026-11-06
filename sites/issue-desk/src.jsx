import React,{useState} from 'react'
import {createRoot} from 'react-dom/client'
import {GitPullRequest,Inbox,RefreshCw,ExternalLink} from 'lucide-react'
import {Group,Panel,Separator} from 'react-resizable-panels'
import {MotionConfig,LazyMotion,domAnimation} from 'motion/react'
import {section as MotionSection} from "motion/react-m"
import {Button} from './ui/button'
import './style.css'
import samples from './sample.json'

const key='pangurl-issue-desk-v1'
const initial = {repos:{'demo/evidence-scout':{issues:samples}},runs:[]}
function readState() {
  try {return JSON.parse(localStorage.getItem(key)) ?? initial}
  catch {return initial}
}
const states={new:'待受理',accepted:'已接受',deferred:'暂缓',archived:'已归档'}
function App(){
  const [data,setData]=useState(readState)
  const [repo,setRepo]=useState('demo/evidence-scout')
  const [selected,setSelected]=useState(null)
  const [query,setQuery]=useState('')
  const [status,setStatus]=useState('')
  const [remote,setRemote]=useState('')
  const [label,setLabel]=useState('')
  const [page,setPage]=useState(1)
  const [view,setView]=useState('queue')
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const [mobileDetail,setMobileDetail]=useState(false)
  const [wide,setWide]=useState(()=>matchMedia('(min-width:900px)').matches)
  React.useEffect(()=>{
    const media=matchMedia('(min-width:900px)')
    const update=event=>setWide(event.matches)
    media.addEventListener('change',update)
    return ()=>media.removeEventListener('change',update)
  },[])
  const name=repo.trim().toLowerCase()
  const issues=data.repos[name]?.issues ?? []
  const current=issues.find(i=>i.id===selected)
  const labels=[...new Set(issues.flatMap(i=>i.labels))]
  const visible=issues.filter(i=>i.title.toLowerCase().includes(query.toLowerCase())&&(!status||i.local===status)&&(!remote||i.state===remote)&&(!label||i.labels.includes(label)))
  const total=Math.max(1,Math.ceil(visible.length/12))
  const currentPage=Math.min(page,total)
  function persist(next){
    localStorage.setItem(key,JSON.stringify(next))
    setData(next)
  }
  async function sync(event){
    event.preventDefault()
    if (!/^[\w.-]+\/[\w.-]+$/.test(name)) return setError('请输入 owner/repository 格式。')
    setBusy(true);setError('')
    const at=new Date().toISOString()
    try{
      const incoming=[]
      for(let cursor=1;cursor<=3;cursor++){
        const response=await fetch('https://api.github.com/repos/'+name+'/issues?state=all&per_page=50&page='+cursor,{signal:AbortSignal.timeout(10000)})
        if(!response.ok) throw new Error(response.status===404?'仓库不可访问，请检查名称和公开状态。':[403,429].includes(response.status)?'GitHub API 请求受限，稍后重试。':'GitHub 返回 '+response.status)
        const batch=await response.json()
        incoming.push(...batch.filter(item=>!item.pull_request))
        if(batch.length<50) break
      }
      const latest=readState()
      const merged=new Map((latest.repos[name]?.issues??[]).map(item=>[item.id,item]))
      for(const item of incoming){
        const old=merged.get(item.id)
        merged.set(item.id,{id:item.id,number:item.number,title:item.title,body:item.body??'',url:item.html_url,state:item.state,labels:item.labels.map(x=>x.name),local:old?.local??'new',note:old?.note??''})
      }
      persist({repos:{...latest.repos,[name]:{at,issues:[...merged.values()].sort((a,b)=>b.number-a.number)}},runs:[{name,at,result:'成功',detail:'本次读取 '+incoming.length+' 条 Issue'},...latest.runs].slice(0,30)})
      setView('queue')
    }catch(failure){
      const latest=readState()
      const detail=failure.name==='TimeoutError'?'GitHub 请求超时，请重试。':failure.message
      setError(detail)
      try{persist({...latest,runs:[{name,at,result:'失败',detail},...latest.runs].slice(0,30)})}catch{}
    }finally{setBusy(false)}
  }
  function change(local,note){
    const latest=readState(), existing=latest.repos[name]
    if(!existing||!current)return
    try{persist({...latest,repos:{...latest.repos,[name]:{...existing,issues:existing.issues.map(i=>i.id===current.id?{...i,local,note}:i)}}});setError('')}
    catch{setError('浏览器存储不可用，未保存此次更改。')}
  }
  const queue=<section className="list"><div className="filters">
    <input aria-label="搜索标题" placeholder="搜索标题" value={query} onChange={e=>{setQuery(e.target.value);setPage(1)}}/>
    <select aria-label="受理状态" value={status} onChange={e=>{setStatus(e.target.value);setPage(1)}}><option value="">全部受理状态</option>{Object.entries(states).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select>
    <select aria-label="GitHub 状态" value={remote} onChange={e=>{setRemote(e.target.value);setPage(1)}}><option value="">GitHub 状态</option><option value="open">Open</option><option value="closed">Closed</option></select>
    <select aria-label="标签" value={label} onChange={e=>{setLabel(e.target.value);setPage(1)}}><option value="">全部标签</option>{labels.map(value=><option key={value}>{value}</option>)}</select>
  </div>{visible.length===0?<p className="empty">{data.repos[name]?'没有符合筛选条件的 Issue。':'输入公开仓库并点击同步。'}</p>:<table><thead><tr><th>Issue</th><th>受理状态</th></tr></thead><tbody>{visible.slice((currentPage-1)*12,currentPage*12).map(i=><tr key={i.id} className={selected===i.id?'selected':''}><td><button className="record" onClick={()=>{setSelected(i.id);setMobileDetail(true)}}>#{i.number} {i.title}</button><small>{i.state} {i.labels.join(' · ')}</small></td><td><span className={'badge '+({accepted:'approved',deferred:'pending'}[i.local]??'')}>{states[i.local]}</span></td></tr>)}</tbody></table>}
  <footer><span>{visible.length} 条</span><Button variant="outline" disabled={currentPage===1} onClick={()=>setPage(currentPage-1)}>上一页</Button><span>{currentPage} / {total}</span><Button variant="outline" disabled={currentPage===total} onClick={()=>setPage(currentPage+1)}>下一页</Button></footer></section>
  const detail=current?<Issue key={current.id} issue={current} change={change} busy={busy}/>:<p className="empty">选择一条 Issue 查看上下文。</p>
  return <div className="shell"><aside><div className="brand"><span><GitPullRequest size={20}/></span> Issue Desk</div><Button variant={view==='queue'?'secondary':'ghost'} onClick={()=>setView('queue')}><Inbox/>受理队列</Button><Button variant={view==='runs'?'secondary':'ghost'} onClick={()=>setView('runs')}><RefreshCw/>同步记录</Button></aside><main>
  <header><div><div className="eyebrow">WORKSPACE / GITHUB</div><h1>{view==='queue'?'问题受理':'同步记录'}</h1></div></header>
  <form className="filters" onSubmit={sync}><input aria-label="GitHub 仓库" value={repo} disabled={busy} onChange={e=>{setRepo(e.target.value);setSelected(null);setMobileDetail(false);setLabel('');setPage(1)}}/><Button disabled={busy}><RefreshCw/>{busy?'同步中…':'同步 Issue'}</Button></form>
  <p>仅访问公开仓库，每次最多读取 150 条 GitHub 记录。受理决定保存在当前浏览器。</p>
  {data.repos[name]&&<small>{data.repos[name].at ? '最近成功同步 '+new Date(data.repos[name].at).toLocaleString() : 'Evidence Scout 示例数据'}</small>}
  {error&&<p className="error" role="alert">{error}</p>}
  <div className="workspace">{view==='runs'?<section className="list">{data.runs.length===0?<p className="empty">暂无同步记录。</p>:<table><thead><tr><th>仓库与时间</th><th>结果</th></tr></thead><tbody>{data.runs.map((r,i)=><tr key={i}><td>{r.name}<small>{new Date(r.at).toLocaleString()}</small></td><td>{r.result}<small>{r.detail}</small></td></tr>)}</tbody></table>}</section>:wide?<Group orientation="horizontal"><Panel defaultSize="55%" minSize="35%">{queue}</Panel><Separator className="separator"/><Panel minSize="30%">{detail}</Panel></Group>:mobileDetail&&current?<><Button variant="ghost" onClick={()=>setMobileDetail(false)}>返回队列</Button>{detail}</>:queue}</div>
  </main></div>
}
function Issue({issue,change,busy}){
  const [note,setNote]=useState(issue.note)
  const [status,setStatus]=useState(issue.local)
  return <MotionSection className="detail" initial={{opacity:0}} animate={{opacity:1}}><div className="eyebrow">GITHUB ISSUE #{issue.number}</div><h2>{issue.title}</h2>
  <a className="inline-flex gap-2 underline" href={issue.url} target="_blank" rel="noreferrer">GitHub 原文 <ExternalLink size={14}/></a>
  <p className="my-4 whitespace-pre-wrap">{issue.body||'此 Issue 没有正文。'}</p>
  <form onSubmit={e=>{e.preventDefault();change(status,note)}}><label>受理决定<select value={status} onChange={e=>setStatus(e.target.value)}>{Object.entries(states).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
  <label>内部备注<textarea value={note} maxLength={1000} onChange={e=>setNote(e.target.value)}/></label><Button disabled={busy}>保存决定</Button></form></MotionSection>
}
createRoot(document.getElementById('root')).render(<MotionConfig reducedMotion="user"><LazyMotion features={domAnimation} strict><App/></LazyMotion></MotionConfig>)
