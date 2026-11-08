<script setup lang="ts">
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import {useRoute,useRouter} from 'vue-router'
import {DataAnalysis,User,Document,Clock,SwitchButton} from '@element-plus/icons-vue'
import {useAuth} from './stores/auth'
import {labels} from './types'
import {report} from './api'
const auth=useAuth(),route=useRoute(),router=useRouter()
async function logout(){try{await auth.logout();router.push('/login')}catch(e){report(e)}}
</script>
<template><el-config-provider :locale="zhCn">
 <router-view v-if="route.path==='/login'"/>
 <div v-else-if="auth.user" class="shell">
  <aside class="sidebar"><div class="brand"><span class="brand-mark">合</span><div>客户与合同<span>业务协同管理系统</span></div></div><div class="nav-caption">工作空间 / 租户 {{auth.user.tenant_id}}</div>
  <el-menu :default-active="route.path" router background-color="transparent" text-color="#aebbc9" active-text-color="#fff">
   <el-menu-item index="/overview"><el-icon><DataAnalysis/></el-icon><span>业务概览</span></el-menu-item>
   <el-menu-item index="/customers"><el-icon><User/></el-icon><span>客户档案</span></el-menu-item>
   <el-menu-item index="/contracts"><el-icon><Document/></el-icon><span>合同管理</span></el-menu-item>
   <el-menu-item v-if="auth.admin" index="/events"><el-icon><Clock/></el-icon><span>操作记录</span></el-menu-item>
  </el-menu><div class="sidebar-bottom">客户关系 · 合同流转<br>同一工作空间，完整业务记录</div></aside>
  <section class="workspace"><header class="topbar"><span class="breadcrumb">工作台 <span>/</span> {{route.meta.title}}</span><div class="account"><el-tag type="info" effect="plain">{{labels[auth.user.role]}}</el-tag><span>{{auth.user.username}}</span><el-button :icon="SwitchButton" text @click="logout">退出</el-button></div></header><main><router-view/></main><footer>客户与合同管理系统 · 金额以人民币结算</footer></section>
 </div>
</el-config-provider></template>
