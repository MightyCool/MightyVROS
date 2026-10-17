#ifndef Version
  #define Version "1.0.0"
#endif
[Setup]
AppName=MightyVR Host
AppVersion={#Version}
AppPublisher=MightyVR
DefaultDirName={localappdata}\MightyVR Host
DefaultGroupName=MightyVR Host
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
OutputDir=..\out
OutputBaseFilename=MightyVR-Host-Setup
Compression=lzma2
SolidCompression=yes
UninstallDisplayName=MightyVR Host
WizardStyle=modern

[Tasks]
Name: "desktopicon"; Description: "Create a desktop shortcut"; Flags: unchecked
Name: "autostart"; Description: "Start with Windows (background, no window; open the Start menu shortcut to see the pairing code)"; Flags: unchecked

[Files]
Source: "..\stage\*"; DestDir: "{app}"; Flags: recursesubdirs ignoreversion createallsubdirs

[Icons]
Name: "{group}\MightyVR Host"; Filename: "{sys}\wscript.exe"; Parameters: """{app}\launch.vbs"""; WorkingDir: "{app}"
Name: "{group}\Stop MightyVR Host"; Filename: "{sys}\wscript.exe"; Parameters: """{app}\stop.vbs"""
Name: "{autodesktop}\MightyVR Host"; Filename: "{sys}\wscript.exe"; Parameters: """{app}\launch.vbs"""; WorkingDir: "{app}"; Tasks: desktopicon

[Registry]
Root: HKCU; Subkey: "Software\Microsoft\Windows\CurrentVersion\Run"; ValueType: string; ValueName: "MightyVRHost"; ValueData: """{sys}\wscript.exe"" ""{app}\launch.vbs"" --no-open"; Tasks: autostart; Flags: uninsdeletevalue

[Run]
Filename: "{sys}\wscript.exe"; Parameters: """{app}\launch.vbs"""; Description: "Start MightyVR Host now"; Flags: postinstall nowait skipifsilent

[UninstallRun]
Filename: "{sys}\wscript.exe"; Parameters: """{app}\stop.vbs"""; Flags: runhidden; RunOnceId: "StopHost"
