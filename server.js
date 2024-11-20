import { WebSocketServer } from 'ws'

const wss = new WebSocketServer({ 
    port: 1234,
    host: '0.0.0.0'
})

wss.on('connection', (ws) => {
    ws.on('message', (message) => {
        wss.clients.forEach(client => {
            if (client !== ws && client.readyState === ws.OPEN) {
                client.send(message)
            }
        })
    })
})

console.log('WebSocket 服务器运行在端口 1234')
