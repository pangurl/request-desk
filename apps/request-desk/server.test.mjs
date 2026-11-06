import assert from 'node:assert/strict'
import {once} from 'node:events'
import {mkdtemp,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {test} from 'node:test'
import {createApp} from './server.mjs'

test('purchase lifecycle, permissions, conflicts, and restart persistence', async () => {
  const directory = await mkdtemp(join(tmpdir(),'request-desk-'))
  const database = join(directory,'test.sqlite')
  let server
  async function start() {
    server = createApp(database).listen(0,'127.0.0.1')
    await once(server,'listening')
    return 'http://127.0.0.1:'+server.address().port+'/api/requests'
  }
  async function stop() {
    if (server?.listening) await new Promise(resolve=>server.close(resolve))
  }
  try {
    let url = await start()
    async function post(id, body, expected) {
      const result = await fetch(url+(id ? '/'+id : ''),{
        method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),
      })
      const data = await result.json()
      assert.equal(result.status,expected,JSON.stringify(data))
      return data
    }
    const form = {title:'设备采购',supplier:'测试供应商',reason:'新同事入职',amount:10000,actor:'applicant'}
    await post('',{...form,amount:0,action:'submit',version:0},422)
    const draft = await post('',{...form,action:'save',version:0},201)
    assert.equal(draft.status,'draft')
    const {id} = draft
    await post(id,{...form,action:'submit',version:1},200)
    await post(id,{actor:'applicant',action:'approve',version:2},403)
    await post(id,{actor:'reviewer',action:'return',version:2,note:'  '},422)
    const returned = await post(id,{actor:'reviewer',action:'return',version:2,note:'补充支架费用'},200)
    assert.equal(returned.status,'returned')
    await post(id,{...form,amount:12000,action:'submit',version:3},200)
    const attempts = await Promise.all(['approve','return'].map(action=>fetch(url+'/'+id,{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({actor:'reviewer',action,version:4,note:'再次核实'}),
    })))
    assert.deepEqual(attempts.map(item=>item.status).sort(),[200,409])
    await stop()
    url = await start()
    const records = await (await fetch(url)).json()
    const saved = records.find(item=>item.id===id)
    assert.equal(saved.amount,12000)
    assert.equal(saved.version,5)
    assert.equal(saved.history.length,5)
    assert.equal(saved.history[2].note,'补充支架费用')
    assert.ok(['approved','returned'].includes(saved.status))
  } finally {
    await stop()
    await rm(directory,{recursive:true,force:true})
  }
})
