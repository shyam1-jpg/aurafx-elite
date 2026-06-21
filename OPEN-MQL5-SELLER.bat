@echo off
title Open MQL5 Seller pages for shyam108
echo Opening MQL5 — log in in your browser, then use MQL5-FILL-FORM.txt to copy text.
start "" "https://www.mql5.com/en/auth_login?returnUrl=https%%3a%%2f%%2fwww.mql5.com%%2fen%%2fusers%%2fshyam108%%2fseller"
timeout /t 2 >nul
start "" "https://www.mql5.com/en/market"
notepad "%~dp0MQL5-FILL-FORM.txt"
