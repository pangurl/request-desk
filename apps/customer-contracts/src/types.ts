export interface User {username:string;role:'admin'|'sales'|'viewer';tenant_id:number}
export interface Customer {id:number;name:string;contact:string;email:string;industry:string;status:string;version:number;contracts?:Contract[]}
export interface Contract {id:number;customer_id:number;customer_name:string;title:string;amount_cents:number;start_date:string;end_date:string;status:string;version:number;updated_at:string;events?:Log[]}
export interface Log {id:number;actor:string;entity:string;entity_id:number;action:string;note:string;created_at:string}
export const labels:Record<string,string>={draft:'草稿',pending:'待审核',returned:'已退回',active:'已生效',submit:'提交审核',approve:'审核通过',return:'退回修改',create:'创建',update:'修改',export:'导出',customer:'客户',contract:'合同',admin:'管理员',sales:'业务员',viewer:'只读成员'}
export const money=(n:number)=>new Intl.NumberFormat('zh-CN',{style:'currency',currency:'CNY'}).format(n/100)
export const time=(s:string)=>new Date(s).toLocaleString('zh-CN',{hour12:false})
