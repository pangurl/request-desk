import {createRouter,createWebHistory} from 'vue-router'
import {useAuth} from './stores/auth'
export const router=createRouter({history:createWebHistory(),routes:[
 {path:'/login',component:()=>import('./views/Login.vue'),meta:{title:'登录'}},
 {path:'/',redirect:'/overview'},
 {path:'/overview',component:()=>import('./views/Overview.vue'),meta:{title:'业务概览'}},
 {path:'/customers',component:()=>import('./views/Customers.vue'),meta:{title:'客户档案'}},
 {path:'/contracts',component:()=>import('./views/Contracts.vue'),meta:{title:'合同管理'}},
 {path:'/events',component:()=>import('./views/Events.vue'),meta:{title:'操作记录',admin:true}},
 {path:'/:pathMatch(.*)*',redirect:'/overview'}
]})
router.beforeEach(async to=>{const auth=useAuth();if(!auth.ready)await auth.load();if(!auth.user&&to.path!=='/login')return '/login';if(auth.user&&to.path==='/login')return '/overview';if(to.meta.admin&&!auth.admin)return '/overview'})
