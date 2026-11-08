<script setup lang="ts">
import {onMounted,ref} from 'vue'
import {api,report} from '../api'
import {labels,time,type Log} from '../types'
const rows=ref<Log[]>([]),total=ref(0),page=ref(1),loading=ref(false)
async function load(){loading.value=true;try{const {data}=await api.get('/events',{params:{page:page.value,size:10}});rows.value=data.items;total.value=data.total}catch(e){report(e)}finally{loading.value=false}}
onMounted(load)
</script>
<template><div class="page-heading"><div><h1>操作记录</h1><p>追溯当前工作空间中的客户维护与合同流转记录。</p></div><el-button :loading="loading" @click="load">刷新记录</el-button></div><section class="panel"><el-table v-loading="loading" :data="rows" empty-text="暂无操作记录"><el-table-column label="操作时间" min-width="170"><template #default="{row}">{{time(row.created_at)}}</template></el-table-column><el-table-column prop="actor" label="操作人" width="100"/><el-table-column label="业务对象" min-width="130"><template #default="{row}">{{labels[row.entity]}} {{row.entity_id?'#'+row.entity_id:'台账'}}</template></el-table-column><el-table-column label="操作类型" min-width="120"><template #default="{row}"><el-tag type="info">{{labels[row.action]??row.action}}</el-tag></template></el-table-column><el-table-column prop="note" label="处理备注" min-width="240" show-overflow-tooltip/></el-table><div class="pagination"><el-pagination v-model:current-page="page" :page-size="10" :total="total" layout="total, prev, pager, next" @current-change="load"/></div></section></template>
