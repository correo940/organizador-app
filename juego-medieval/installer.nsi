; Instalador de Windows. Compilar con: makensis installer.nsi (tras exportar build/SangreYLinaje.exe)
Unicode true
Name "Sangre y Linaje"
OutFile "build\SangreYLinaje_Instalador.exe"
InstallDir "$LOCALAPPDATA\SangreYLinaje"
RequestExecutionLevel user
!include "MUI2.nsh"
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "Spanish"

Section "Juego"
  SetOutPath "$INSTDIR"
  File "build\SangreYLinaje.exe"
  WriteUninstaller "$INSTDIR\Desinstalar.exe"
  CreateDirectory "$SMPROGRAMS\Sangre y Linaje"
  CreateShortcut "$SMPROGRAMS\Sangre y Linaje\Sangre y Linaje.lnk" "$INSTDIR\SangreYLinaje.exe"
  CreateShortcut "$SMPROGRAMS\Sangre y Linaje\Desinstalar.lnk" "$INSTDIR\Desinstalar.exe"
  CreateShortcut "$DESKTOP\Sangre y Linaje.lnk" "$INSTDIR\SangreYLinaje.exe"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\SangreYLinaje" "DisplayName" "Sangre y Linaje"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\SangreYLinaje" "UninstallString" "$INSTDIR\Desinstalar.exe"
SectionEnd

Section "Uninstall"
  Delete "$INSTDIR\SangreYLinaje.exe"
  Delete "$INSTDIR\Desinstalar.exe"
  RMDir "$INSTDIR"
  Delete "$DESKTOP\Sangre y Linaje.lnk"
  RMDir /r "$SMPROGRAMS\Sangre y Linaje"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\SangreYLinaje"
SectionEnd
