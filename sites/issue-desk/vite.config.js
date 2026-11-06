import {defineConfig} from 'vite'
import tailwind from '@tailwindcss/vite'
export default defineConfig({plugins:[tailwind()], server:{proxy:{'/api':'http://localhost:3001'}}})
