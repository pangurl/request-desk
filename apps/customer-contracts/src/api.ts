import axios from 'axios'
import {ElMessage} from 'element-plus/es/components/message/index'
export const api=axios.create({baseURL:'/api',timeout:12000,withCredentials:true})
export function report(error:unknown){ const e=error as {response?:{status:number;data?:{error:string}};message?:string};ElMessage.error(e.response?.data?.error??'网络连接失败，请保留当前输入后重试');return e.response?.status }
