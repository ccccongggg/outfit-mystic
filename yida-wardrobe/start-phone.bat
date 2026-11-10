@echo off
setlocal
rem 易搭整合版1.0 · 手机/局域网访问启动脚本
rem 与 start.bat 的区别：把后端绑到 0.0.0.0，让同一 Wi-Fi 下的手机/其他设备能访问。
rem 手机浏览器打开启动后日志里打印的 http://<电脑局域网IP>:8790 即可。
rem 注意：0.0.0.0 会暴露到局域网，仅在可信网络(自家/赛场 Wi-Fi)使用；用完关掉本窗口即停。
set "PORT=8790"
set "HOST=0.0.0.0"
set "ROOT=%~dp0"
set "VENV=%ROOT%backend\venv"
set "PY="

where py >nul 2>nul && set "PY=py -3"
if not defined PY (where python >nul 2>nul && set "PY=python")
if not defined PY (where python3 >nul 2>nul && set "PY=python3")
if not defined PY (
  echo [错误] 未找到 Python。请先安装 Python 3.10+ 并勾选 "Add python.exe to PATH"。
  pause
  exit /b 1
)
echo 使用 Python: %PY%

if not exist "%VENV%" (
  echo 首次运行：创建虚拟环境 %VENV% ...
  %PY% -m venv "%VENV%"
)
set "VENVPY=%VENV%\Scripts\python.exe"
if not exist "%VENVPY%" (
  echo [错误] 虚拟环境创建失败，请检查 Python 安装。
  pause
  exit /b 1
)

echo 安装/更新依赖（首次较慢，含 rembg）...
"%VENVPY%" -m pip install -q --upgrade pip
"%VENVPY%" -m pip install -q -r "%ROOT%backend\requirements.txt"

echo 启动 易搭整合版1.0（局域网模式，手机可访问）端口 %PORT% ...
cd /d "%ROOT%"
set "PORT=%PORT%"
set "HOST=%HOST%"
"%VENVPY%" backend\server\app.py
endlocal
