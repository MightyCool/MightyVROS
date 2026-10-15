#ifndef Version
  #define Version "1.0.0"
#endif
[Setup]
AppName=VR OS Host
AppVersion={#Version}
AppPublisher=VR OS
DefaultDirName={localappdata}\VR OS Host
DefaultGroupName=VR OS Host
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
OutputDir=..\out
OutputBaseFilename=VR-OS-Host-Setup
Compression=lzma2
SolidCompression=yes
UninstallDisplayName=VR OS Host
WizardStyle=modern

[Tasks]
Name: "desktopicon"; Description: "Create a desktop shortcut"; Flags: unchecked
Name: "autostart"; Description: "Start with Windows (background, no window; open the Start menu shortcut to see the pairing code)"; Flags: unchecked

[Files]
Source: "..\stage\*"; DestDir: "{app}"; Flags: recursesubdirs ignoreversion createallsubdirs

[Icons]
Name: "{group}\VR OS Host"; Filename: "{sys}\wscript.exe"; Parameters: """{app}\launch.vbs"""; WorkingDir: "{app}"
Name: "{group}\Stop VR OS Host"; Filename: "{sys}\wscript.exe"; Parameters: """{app}\stop.vbs"""
Name: "{autodesktop}\VR OS Host"; Filename: "{sys}\wscript.exe"; Parameters: """{app}\launch.vbs"""; WorkingDir: "{app}"; Tasks: desktopicon

[Registry]
Root: HKCU; Subkey: "Software\Microsoft\Windows\CurrentVersion\Run"; ValueType: string; ValueName: "VROSHost"; ValueData: """{sys}\wscript.exe"" ""{app}\launch.vbs"" --no-open"; Tasks: autostart; Flags: uninsdeletevalue

[Run]
Filename: "{sys}\wscript.exe"; Parameters: """{app}\launch.vbs"""; Description: "Start VR OS Host now"; Flags: postinstall nowait skipifsilent

[UninstallRun]
Filename: "{sys}\wscript.exe"; Parameters: """{app}\stop.vbs"""; Flags: runhidden; RunOnceId: "StopHost"
