; CJCRSG Presenter — per-user Windows installer.
;
; Built in CI after `cargo build --release --target x86_64-pc-windows-msvc`.
; Per-user on purpose: a presentation volunteer should not need an administrator
; password to install a slide app on a church machine. Application data lives in
; %APPDATA% and is deliberately not removed by the uninstaller.
;
; Requires:
;   installer/MicrosoftEdgeWebview2Setup.exe   (CI downloads the Evergreen
;                                               bootstrapper; see the workflow)
;
; Usage: makensis /DAPP_VERSION=0.1.0 installer/windows.nsi

Unicode true

!include "MUI2.nsh"
!include "LogicLib.nsh"
!include "x64.nsh"

!ifndef APP_VERSION
  !define APP_VERSION "0.1.0"
!endif

!define APP_NAME "CJCRSG Presenter"
!define APP_EXE "cjcrsg-presenter.exe"
!define APP_KEY "CJCRSGPresenter"
!define WEBVIEW2_GUID "{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}"

Name "${APP_NAME}"
OutFile "..\dist\CJCRSG-Presenter-Setup-${APP_VERSION}.exe"
InstallDir "$LOCALAPPDATA\Programs\${APP_NAME}"
InstallDirRegKey HKCU "Software\${APP_KEY}" "InstallDir"
RequestExecutionLevel user
SetCompressor /SOLID lzma
ShowInstDetails show

VIProductVersion "${APP_VERSION}.0"
VIAddVersionKey "ProductName" "${APP_NAME}"
VIAddVersionKey "FileDescription" "${APP_NAME} installer"
VIAddVersionKey "FileVersion" "${APP_VERSION}"
VIAddVersionKey "LegalCopyright" "GPL-3.0-only"

!define MUI_ABORTWARNING
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "English"

; WebView2 is a runtime dependency, not a build one. Install it quietly if a
; machine has never had it, and fail the install if it still is not there —
; otherwise the app starts and immediately shows a blank window.
!macro EnsureWebView2
  ReadRegStr $0 HKLM "SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\${WEBVIEW2_GUID}" "pv"
  ${If} $0 == ""
    ReadRegStr $0 HKCU "SOFTWARE\Microsoft\EdgeUpdate\Clients\${WEBVIEW2_GUID}" "pv"
  ${EndIf}

  ${If} $0 == ""
    DetailPrint "Installing the WebView2 runtime…"
    InitPluginsDir
    File /oname=$PLUGINSDIR\MicrosoftEdgeWebview2Setup.exe "MicrosoftEdgeWebview2Setup.exe"
    ExecWait '"$PLUGINSDIR\MicrosoftEdgeWebview2Setup.exe" /silent /install'

    ReadRegStr $0 HKLM "SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\${WEBVIEW2_GUID}" "pv"
    ${If} $0 == ""
      ReadRegStr $0 HKCU "SOFTWARE\Microsoft\EdgeUpdate\Clients\${WEBVIEW2_GUID}" "pv"
    ${EndIf}
    ${If} $0 == ""
      MessageBox MB_ICONSTOP|MB_OK "${APP_NAME} needs the Microsoft Edge WebView2 runtime. Install it from https://go.microsoft.com/fwlink/p/?LinkId=2124703 and run this installer again."
      Abort
    ${EndIf}
  ${Else}
    DetailPrint "WebView2 runtime $0 already present."
  ${EndIf}
!macroend

Section "Install"
  SetShellVarContext current
  SetOutPath "$INSTDIR"

  File "..\target\x86_64-pc-windows-msvc\release\${APP_EXE}"

  !insertmacro EnsureWebView2

  WriteUninstaller "$INSTDIR\Uninstall.exe"

  CreateDirectory "$SMPROGRAMS\${APP_NAME}"
  CreateShortcut "$SMPROGRAMS\${APP_NAME}\${APP_NAME}.lnk" "$INSTDIR\${APP_EXE}"
  CreateShortcut "$DESKTOP\${APP_NAME}.lnk" "$INSTDIR\${APP_EXE}"

  WriteRegStr HKCU "Software\${APP_KEY}" "InstallDir" "$INSTDIR"
  WriteRegStr HKCU "Software\${APP_KEY}" "Version" "${APP_VERSION}"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_KEY}" "DisplayName" "${APP_NAME}"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_KEY}" "DisplayVersion" "${APP_VERSION}"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_KEY}" "Publisher" "CJCRSG"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_KEY}" "DisplayIcon" "$INSTDIR\${APP_EXE}"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_KEY}" "UninstallString" '"$INSTDIR\Uninstall.exe"'
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_KEY}" "NoModify" 1
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_KEY}" "NoRepair" 1
SectionEnd

Section "Uninstall"
  SetShellVarContext current

  Delete "$SMPROGRAMS\${APP_NAME}\${APP_NAME}.lnk"
  RMDir "$SMPROGRAMS\${APP_NAME}"
  Delete "$DESKTOP\${APP_NAME}.lnk"

  Delete "$INSTDIR\${APP_EXE}"
  Delete "$INSTDIR\Uninstall.exe"
  RMDir "$INSTDIR"

  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_KEY}"
  DeleteRegKey HKCU "Software\${APP_KEY}"

  ; %APPDATA%\cjcrsg-presenter (recent projects) is left in place on purpose:
  ; reinstalling should remember the operator's projects.
SectionEnd
