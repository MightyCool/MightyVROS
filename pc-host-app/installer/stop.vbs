' Asks a running VR OS Host to quit (same as the Quit button on its page).
Set sh = CreateObject("WScript.Shell")
sh.Run "powershell -NoProfile -WindowStyle Hidden -Command ""try { Invoke-WebRequest -UseBasicParsing -Method Post -Headers @{'X-VROS'='1'} http://127.0.0.1:8765/quit | Out-Null } catch {}""", 0, True
