<script setup lang="ts">
import {onMounted,onBeforeUnmount,ref,nextTick} from 'vue'
import {useRouter} from 'vue-router'
import {init,use,type EChartsType} from 'echarts/core'
import {BarChart} from 'echarts/charts'
import {GridComponent,TooltipComponent} from 'echarts/components'
import {CanvasRenderer} from 'echarts/renderers'
import {api,report} from '../api'
import {labels,money} from '../types'
use([BarChart,GridComponent,TooltipComponent,CanvasRenderer])
const chartEl=ref<HTMLElement>(),loading=ref(false),error=ref(false),router=useRouter()
const data=ref<{customers:number;states:{status:string;count:number;amount:number}[]}>({customers:0,states:[]})
let chart:EChartsType|undefined,observer:ResizeObserver|undefined
const count=(state:string)=>data.value.states.find(s=>s.status===state)?.count??0
const totalAmount=()=>data.value.states.filter(s=>s.status==='active').reduce((sum,s)=>sum+s.amount,0)
async function load(){loading.value=true;error.value=false;try{data.value=(await api.get('/dashboard')).data;await nextTick();if(chartEl.value){chart??=init(chartEl.value);const states=['draft','pending','returned','active'];chart.setOption({tooltip:{trigger:'axis'},grid:{left:40,right:25,top:25,bottom:35},xAxis:{type:'category',data:states.map(s=>labels[s]),axisLine:{lineStyle:{color:'#dce3eb'}},axisTick:{show:false},axisLabel:{color:'#71859a'}},yAxis:{type:'value',minInterval:1,splitLine:{lineStyle:{color:'#eef2f5'}},axisLabel:{color:'#8c9aa8'}},series:[{type:'bar',barWidth:38,data:states.map((s,i)=>({value:count(s),itemStyle:{color:['#9bafc1','#c79d58','#ba827d','#528b7b'][i],borderRadius:[3,3,0,0]}}))}]});if(!observer){observer=new ResizeObserver(()=>chart?.resize());observer.observe(chartEl.value)}}}catch(e){error.value=true;report(e)}finally{loading.value=false}}
onMounted(load);onBeforeUnmount(()=>{observer?.disconnect();chart?.dispose()})
</script>
<template><div class="page-heading"><div><h1>业务概览</h1><p>客户关系与合同进展，及时掌握当前业务状态。</p></div><el-button :loading="loading" @click="load">刷新概览</el-button></div><el-alert v-if="error" title="概览加载失败，当前显示上次成功查询的数据。请点击刷新重试。" type="error" class="error-box" :closable="false"/><div v-loading="loading" class="metrics"><div class="metric"><span>客户档案</span><strong>{{data.customers}}</strong><small>当前租户的客户总数</small></div><div class="metric"><span>待审核合同</span><strong>{{count('pending')}}</strong><button class="link" @click="router.push({path:'/contracts',query:{status:'pending'}})">前往合同台账 →</button></div><div class="metric"><span>已生效合同</span><strong>{{count('active')}}</strong><small>已完成审核的合同</small></div><div class="metric"><span>生效合同总额</span><strong style="font-size:26px">{{money(totalAmount())}}</strong><small>合同金额合计，非实收金额</small></div></div><div class="chart-grid"><section class="panel"><h3 class="subheading" style="margin-top:0">合同状态分布</h3><p class="muted">统计当前租户全部合同，单位：份</p><div ref="chartEl" class="chart" role="img" :aria-label="'合同分布：草稿'+count('draft')+'，待审核'+count('pending')+'，已退回'+count('returned')+'，已生效'+count('active')"/></section><section class="panel"><h3 class="subheading" style="margin-top:0">业务办理路径</h3><div v-for="(step,i) in [['客户建档','维护客户与联系人，选择启用中的客户开展业务。'],['起草与提交','录入金额和履约日期，保存草稿后提交审核。'],['审核与修订','管理员通过或说明退回原因，业务员修改后重提。'],['生效与追溯','查询生效合同、导出台账，按流转记录追溯处理。']]" :key="i" class="flow-row"><span class="step-num">0{{i+1}}</span><div><strong>{{step[0]}}</strong><p>{{step[1]}}</p></div></div></section></div></template>
