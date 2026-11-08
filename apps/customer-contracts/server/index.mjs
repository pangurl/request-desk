import {mkdirSync} from 'node:fs'
import {createApp} from './app.mjs'
if(process.argv.includes('--production'))process.env.NODE_ENV='production'
if(process.env.NODE_ENV==='production'&&!process.env.INITIAL_PASSWORD)throw new Error('首次部署须设置 INITIAL_PASSWORD（至少 12 位）')
const password=process.env.INITIAL_PASSWORD??'LocalDemo2026!'
if(password.length<12)throw new Error('INITIAL_PASSWORD 至少 12 位')
mkdirSync('data',{recursive:true})
const {app,close}=createApp({databasePath:process.env.DATABASE_PATH??'data/contracts.sqlite',initialPassword:password,trustProxy:process.env.TRUST_PROXY==='1'})
const server=app.listen(Number(process.env.PORT??3100),process.env.HOST??'127.0.0.1',()=>console.log('客户与合同管理系统 http://localhost:'+(process.env.PORT??3100)))
function stop(){server.close(()=>{close();process.exit(0)})}
process.on('SIGTERM',stop)
process.on('SIGINT',stop)
