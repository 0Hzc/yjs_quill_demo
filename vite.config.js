import { defineConfig } from 'vite'

export default {
    base: '/edit/',
    server: {
        host: '0.0.0.0',
        port: 5173,
        strictPort: true,
        cors: true
    },
    preview: {
        port: 5173
    }
}
