@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo 心歌随录：启动后请打开 http://127.0.0.1:18271
echo 关闭此窗口即可停止。请勿同时启动多个窗口。
python server.py
pause
