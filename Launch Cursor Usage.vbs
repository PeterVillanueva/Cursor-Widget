' One-click launcher with no console window.
' Double-click this file (or pin a shortcut to it) to start Cursor Usage.

Option Explicit

Dim shell, fso, root, batPath, electronPath, nodeModules

Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

root = fso.GetParentFolderName(WScript.ScriptFullName)
batPath = root & "\Launch Cursor Usage.bat"
electronPath = root & "\node_modules\electron\dist\electron.exe"
nodeModules = root & "\node_modules\electron"

shell.CurrentDirectory = root

If Not fso.FileExists(electronPath) Then
  ' First run needs install/build — show the console so progress is visible.
  shell.Run """" & batPath & """", 1, False
Else
  ' Fast path: rebuild quietly then launch Electron with no console.
  shell.Run "cmd /c npm run build >nul 2>&1 && """ & electronPath & """ .", 0, False
End If
