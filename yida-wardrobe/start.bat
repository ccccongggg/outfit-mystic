@echo off
setlocal
rem 易搭整合版1.0 便携启动脚本（不再写死特定机器路径）
rem 启动后访问 http://127.0.0.1:8790 （前端 wardrobe-app + 真实后端 API 同端口）
set "PORT=8790"
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

echo 启动 易搭整合版1.0 端口 %PORT% ...
cd /d "%ROOT%"
set "PORT=%PORT%"
"%VENVPY%" backend\server\app.py
endlocal
