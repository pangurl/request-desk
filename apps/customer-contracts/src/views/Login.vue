<script setup lang="ts">
import {reactive,ref} from 'vue'
import {useRouter} from 'vue-router'
import {api,report} from '../api'
import {useAuth} from '../stores/auth'
const form=reactive({username:'',password:''}),busy=ref(false),router=useRouter(),auth=useAuth()
async function login(){if(!form.username||!form.password)return;busy.value=true;try{auth.user=(await api.post('/login',form)).data;router.push('/overview')}catch(e){report(e)}finally{busy.value=false}}
</script>
<template><div class="login-page"><section class="login-intro"><div class="eyebrow">客户 · 合同 · 协作</div><h1>每一份合同，<br>都有清晰的来路。</h1><p>从客户建档到审核生效，将业务信息、处理状态与操作记录留在同一个工作空间。</p><div class="login-rule"></div><span>客户档案 / 合同流转 / 权限与留痕</span></section><el-card class="login-card" shadow="never"><h2>登录工作空间</h2><p class="muted">使用已分配的账号继续</p><el-form :model="form" label-position="top" @submit.prevent="login"><el-form-item label="账号"><el-input v-model="form.username" autocomplete="username" placeholder="请输入账号"/></el-form-item><el-form-item label="密码"><el-input v-model="form.password" type="password" show-password autocomplete="current-password" placeholder="请输入密码"/></el-form-item><el-button class="full" type="primary" native-type="submit" :loading="busy">登录</el-button></el-form><p class="login-help">管理员、业务员与只读成员根据角色访问功能。账号配置请参阅项目运行说明。</p></el-card></div></template>
