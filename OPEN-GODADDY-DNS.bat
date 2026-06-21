@echo off
title AuraFX Elite — GoDaddy DNS
echo Opening GoDaddy DNS for aurafxelite.com ...
echo.
echo After sign-in, follow GODADDY-DNS-RECORDS.txt in this folder.
start "" "https://dcc.godaddy.com/manage/aurafxelite.com/dns"
start "" "https://render.com"
timeout /t 3 >nul
