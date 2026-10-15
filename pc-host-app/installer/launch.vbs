' Starts the VR OS Host with no console window. Pass --no-open to skip opening the control page.
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
dir = fso.GetParentFolderName(WScript.ScriptFullName)
extra = ""
For i = 0 To WScript.Arguments.Count - 1
  extra = extra & " " & WScript.Arguments(i)
Next
sh.CurrentDirectory = dir & "\app"
sh.Run """" & dir & "\node.exe"" --max-old-space-size=64 --max-semi-space-size=1 src\main.js" & extra, 0, False
