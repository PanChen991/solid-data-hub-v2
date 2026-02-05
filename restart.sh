#!/bin/bash

echo "=== 停止所有服务 ==="

# 强制杀掉所有相关进程
pkill -9 -f "uvicorn main:app" 2>/dev/null
pkill -9 -f "vite" 2>/dev/null

# 清理端口（确保彻底）
lsof -ti:8001 | xargs kill -9 2>/dev/null
lsof -ti:5173 | xargs kill -9 2>/dev/null

sleep 2

echo "=== 启动后端 (Port 8001) ==="
cd backend
uvicorn main:app --reload --host 0.0.0.0 --port 8001 > server.log 2>&1 &
BACKEND_PID=$!
echo "Backend PID: $BACKEND_PID"
cd ..

sleep 2

echo "=== 启动前端 (Port 5173) ==="
npm run dev -- --host --port 5173 > frontend.log 2>&1 &
FRONTEND_PID=$!
echo "Frontend PID: $FRONTEND_PID"

sleep 3

echo ""
echo "=== 服务状态检查 ==="
if lsof -i:8001 > /dev/null 2>&1; then
    echo "✅ Backend: http://0.0.0.0:8001"
else
    echo "❌ Backend: 启动失败"
fi

if lsof -i:5173 > /dev/null 2>&1; then
    echo "✅ Frontend: http://0.0.0.0:5173/login"
else
    echo "❌ Frontend: 启动失败"
fi

echo ""
echo "进程ID已保存到 .pids 文件"
echo "$BACKEND_PID" > .pids
echo "$FRONTEND_PID" >> .pids
