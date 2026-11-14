; AL-NASR Windows installer scaffold.
; The installer deploys the local runtime files; Docker Desktop/WSL2 remain prerequisites.
#define AppName "AL-NASR ERP"
#define AppVersion "0.1.0"
#define AppPublisher "AL-NASR"

[Setup]
AppId={{8E8F2B37-6C20-4B42-A90D-A1A5A0000001}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher={#AppPublisher}
DefaultDirName={localappdata}\Programs\AL-NASR ERP
DefaultGroupName={#AppName}
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
ArchitecturesAllowed=x64
ArchitecturesInstallIn64BitMode=x64
OutputDir=..\..\dist\installer
OutputBaseFilename=AL-NASR-Setup
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
Uninstallable=yes
UninstallDisplayName={#AppName}
CloseApplications=yes

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Dirs]
Name: "{app}\deploy"
Name: "{app}\apps"

[Files]
Source: "..\\..\\apps\\xpos\\LICENSE"; DestDir: "{app}\\licenses"; DestName: "X-POS-MIT-LICENSE.txt"; Flags: ignoreversion
Source: "..\..\.dockerignore"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\Dockerfile"; DestDir: "{app}\deploy"; Flags: ignoreversion
Source: "..\compose.yaml"; DestDir: "{app}\deploy"; Flags: ignoreversion
Source: "..\Caddyfile"; DestDir: "{app}\deploy"; Flags: ignoreversion
Source: "..\Caddy-ANDROID-TRUST.md"; DestDir: "{app}\deploy"; Flags: ignoreversion
Source: "..\.env.example"; DestDir: "{app}\deploy"; Flags: ignoreversion
Source: "..\README.md"; DestDir: "{app}\deploy"; Flags: ignoreversion
Source: "alnasr.ps1"; DestDir: "{app}\deploy\windows"; Flags: ignoreversion
Source: "..\..\apps\alnasr\*"; DestDir: "{app}\apps\alnasr"; Flags: ignoreversion recursesubdirs createallsubdirs; Excludes: ".git\*,__pycache__\*,*.pyc"
Source: "..\..\apps\xpos\*"; DestDir: "{app}\apps\xpos"; Flags: ignoreversion recursesubdirs createallsubdirs; Excludes: ".git\*,__pycache__\*,*.pyc,frontend\node_modules\*,frontend\dist\*,frontend\dist-electron\*"
Source: "..\..\dist\offline\alnasr-runtime-images.tar.gz"; DestDir: "{app}\offline"; Flags: ignoreversion nocompression
Source: "..\..\dist\offline\SHA256SUMS.txt"; DestDir: "{app}\offline"; Flags: ignoreversion

[Icons]
Name: "{autoprograms}\AL-NASR ERP\First-time setup"; Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\deploy\windows\alnasr.ps1"" -Action setup"; WorkingDir: "{app}"
Name: "{autoprograms}\AL-NASR ERP\Open AL-NASR"; Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\deploy\windows\alnasr.ps1"" -Action open"; WorkingDir: "{app}"
Name: "{autoprograms}\AL-NASR ERP\Start server"; Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\deploy\windows\alnasr.ps1"" -Action start"; WorkingDir: "{app}"
Name: "{autoprograms}\AL-NASR ERP\Stop server"; Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\deploy\windows\alnasr.ps1"" -Action stop"; WorkingDir: "{app}"
Name: "{autoprograms}\AL-NASR ERP\Backup"; Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\deploy\windows\alnasr.ps1"" -Action backup"; WorkingDir: "{app}"

Name: "{autoprograms}\AL-NASR ERP\Restore"; Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\deploy\windows\alnasr.ps1"" -Action restore"; WorkingDir: "{app}"

[Run]
Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\deploy\windows\alnasr.ps1"" -Action prepare"; Description: "Prepare private local configuration (Docker Desktop is still required)"; Flags: postinstall runhidden

[UninstallDelete]
; Intentionally do not remove Docker volumes or %LOCALAPPDATA%\AL-NASR ERP.
; Business data and backups must survive removal of the launcher.
