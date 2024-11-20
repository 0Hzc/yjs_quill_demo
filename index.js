import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
import { QuillBinding } from 'y-quill'
import Quill from 'quill'

// 等待 DOM 加载完成
document.addEventListener('DOMContentLoaded', () => {
    const joinButton = document.getElementById('joinButton')
    joinButton.addEventListener('click', joinEditor)

    // 添加回车键支持
    document.getElementById('userName').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            joinEditor()
        }
    })
})

function joinEditor() {
    const userName = document.getElementById('userName').value.trim()
    if (!userName) {
        alert('请输入名字')
        return
    }
    
    // 隐藏用户信息输入界面
    document.getElementById('userInfo').style.display = 'none'
    // 显示编辑器
    const editorElement = document.getElementById('editor')
    editorElement.style.display = 'block'
    
    // 确保编辑器容器可见后再初始化
    setTimeout(() => {
        initEditor(userName)
    }, 100)
}

function initEditor(userName) {
    console.log('初始化编辑器:', userName)

    // 创建 Yjs 文档
    const ydoc = new Y.Doc()

    // 创建 WebSocket 连接
    const wsUrl = `ws://${window.location.hostname}/ws`
    const provider = new WebsocketProvider(
        wsUrl,
        'quill-demo-room',
        ydoc
    )

    // 创建 Quill 编辑器
    const editor = new Quill('#editor', {
        theme: 'snow',
        modules: {
            toolbar: [
                [{ 'header': [1, 2, 3, false] }],
                ['bold', 'italic', 'underline', 'strike'],
                ['blockquote', 'code-block'],
                [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                [{ 'color': [] }, { 'background': [] }],
                ['clean']
            ]
        },
        placeholder: '开始输入...'
    })

    // 设置用户状态，包括光标信息
    provider.awareness.setLocalState({
        user: {
            name: userName,
            color: '#' + Math.floor(Math.random()*16777215).toString(16)
        },
        cursor: null
    })

    // 监听编辑器选择变化
    editor.on('selection-change', function(range) {
        if (range) {
            provider.awareness.setLocalState({
                user: {
                    name: userName,
                    color: provider.awareness.getLocalState().user.color
                },
                cursor: range
            })
        }
    })

    // 创建共享文本类型
    const ytext = ydoc.getText('quill')

    // 绑定 Quill 和 Yjs
    const binding = new QuillBinding(ytext, editor)

    // 存储光标标志的定时器
    const cursorTimers = new Map()

    // 监听用户状态变化
    provider.awareness.on('change', () => {
        // 更新用户列表
        const states = Array.from(provider.awareness.getStates().values())
        updateUserList(states)

        // 清除所有现有的光标
        document.querySelectorAll('.cursor-caret').forEach(el => el.remove())
        
        // 为每个用户创建光标
        provider.awareness.getStates().forEach((state, clientId) => {
            if (clientId !== provider.awareness.clientID && state.cursor && state.user) {
                const cursor = state.cursor
                const userColor = state.user.color
                const userName = state.user.name

                // 清除之前的定时器（如果存在）
                if (cursorTimers.has(clientId)) {
                    clearTimeout(cursorTimers.get(clientId))
                    const oldFlag = document.querySelector(`.cursor-flag-${clientId}`)
                    if (oldFlag) oldFlag.remove()
                }

                // 创建光标标志
                const flag = document.createElement('div')
                flag.className = `cursor-flag cursor-flag-${clientId}`
                flag.style.backgroundColor = userColor
                flag.textContent = userName
                flag.style.opacity = '1'
                flag.style.transition = 'opacity 0.3s ease'

                // 创建光标线
                const caret = document.createElement('div')
                caret.className = 'cursor-caret'
                caret.style.backgroundColor = userColor

                // 获取光标位置
                const bounds = editor.getBounds(cursor.index)
                
                // 设置位置
                flag.style.transform = `translateY(-100%)`
                flag.style.left = bounds.left + 'px'
                flag.style.top = bounds.top + 'px'
                
                caret.style.height = bounds.height + 'px'
                caret.style.left = bounds.left + 'px'
                caret.style.top = bounds.top + 'px'

                // 添加到编辑器
                editor.container.appendChild(flag)
                editor.container.appendChild(caret)

                // 设置定时器在2秒后隐藏用户名
                const timer = setTimeout(() => {
                    flag.style.opacity = '0'
                    setTimeout(() => {
                        flag.remove()
                    }, 300) // 等待淡出动画完成后移除元素
                }, 2000)

                // 存储定时器ID
                cursorTimers.set(clientId, timer)
            }
        })
    })

    // 更新连接状态显示
    const statusDiv = document.getElementById('status')
    provider.on('status', event => {
        console.log('连接状态变化:', event.status)
        statusDiv.textContent = `连接状态: ${event.status} - ${userName}`
        statusDiv.style.color = event.status === 'connected' ? '#4caf50' : '#f44336'
    })

    // 监听同步状态
    provider.on('sync', (isSynced) => {
        console.log('同步状态:', isSynced)
        if (isSynced) {
            console.log('文档同步完成')
        }
    })

    // 添加错误监听
    provider.on('error', error => {
        console.error('WebSocket 错误:', error)
        statusDiv.textContent = `连接错误: ${error.message}`
        statusDiv.style.color = '#f44336'
    })

    // 确保编辑器可编辑
    editor.enable(true)

    // 添加断开连接时的处理
    window.addEventListener('beforeunload', () => {
        provider.disconnect()
        ydoc.destroy()
    })

    // 添加 WebSocket 连接监听
    provider.ws.addEventListener('open', () => {
        console.log('WebSocket 连接已建立')
    })

    provider.ws.addEventListener('close', () => {
        console.log('WebSocket 连接已关闭')
        // 尝试重新连接
        setTimeout(() => {
            console.log('尝试重新连接...')
            provider.connect()
        }, 3000)
    })

    provider.ws.addEventListener('error', (error) => {
        console.error('WebSocket 连接错误:', error)
    })
}

// 更新用户列表
function updateUserList(states) {
    const users = states
        .filter(state => state.user?.name)
        .map(state => ({
            name: state.user.name,
            color: state.user.color
        }))

    const userListEl = document.getElementById('activeUsers')
    userListEl.innerHTML = users
        .map(user => `<li style="color: ${user.color}">${user.name}</li>`)
        .join('')
    
    console.log('当前在线用户:', users)
}

// 添加错误处理
window.addEventListener('error', (event) => {
    console.error('全局错误:', event.error)
})

// 添加未捕获的 Promise 错误处理
window.addEventListener('unhandledrejection', (event) => {
    console.error('未处理的 Promise 错误:', event.reason)
})
