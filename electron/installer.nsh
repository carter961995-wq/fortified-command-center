!macro preInit
  SetRegView 64
  WriteRegExpandStr HKLM "${INSTALL_REGISTRY_KEY}" InstallLocation "$LOCALAPPDATA\FortifiedCC"
  WriteRegExpandStr HKCU "${INSTALL_REGISTRY_KEY}" InstallLocation "$LOCALAPPDATA\FortifiedCC"
  StrCpy $INSTDIR "$LOCALAPPDATA\FortifiedCC"
!macroend
