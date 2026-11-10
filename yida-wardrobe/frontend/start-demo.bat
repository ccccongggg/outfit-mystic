@echo off
cd /d %~dp0
start http://localhost:4173/
py -m http.server 4173
