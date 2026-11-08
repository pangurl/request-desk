import {defineStore} from 'pinia'
import {ref,computed} from 'vue'
import {api} from '../api'
import type {User} from '../types'
export const useAuth=defineStore('auth',()=>{
 const user=ref<User|null>(null),ready=ref(false)
 const writable=computed(()=>user.value?.role!=='viewer'),admin=computed(()=>user.value?.role==='admin')
 async function load(){try{user.value=(await api.get('/me')).data}catch{user.value=null}finally{ready.value=true}}
 async function logout(){await api.post('/logout');user.value=null}
 return {user,ready,writable,admin,load,logout}
})
