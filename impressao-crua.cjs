// Manda bytes "crus" (ESC/POS) direto para a fila da impressora do Windows,
// sem passar pelo desenho de página (API winspool, tipo de dado RAW).
// Usa o PowerShell que já vem no Windows: não precisa instalar nada.
const { execFile } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const SCRIPT = String.raw`param([string]$Impressora, [string]$Arquivo)
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class GerizRaw {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  public class DOCINFO { [MarshalAs(UnmanagedType.LPWStr)] public string pDocName; [MarshalAs(UnmanagedType.LPWStr)] public string pOutputFile; [MarshalAs(UnmanagedType.LPWStr)] public string pDataType; }
  [DllImport("winspool.drv", EntryPoint = "OpenPrinterW", SetLastError = true, CharSet = CharSet.Unicode)] public static extern bool OpenPrinter(string n, out IntPtr h, IntPtr d);
  [DllImport("winspool.drv", SetLastError = true)] public static extern bool ClosePrinter(IntPtr h);
  [DllImport("winspool.drv", EntryPoint = "StartDocPrinterW", SetLastError = true, CharSet = CharSet.Unicode)] public static extern int StartDocPrinter(IntPtr h, int level, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFO di);
  [DllImport("winspool.drv", SetLastError = true)] public static extern bool EndDocPrinter(IntPtr h);
  [DllImport("winspool.drv", SetLastError = true)] public static extern bool StartPagePrinter(IntPtr h);
  [DllImport("winspool.drv", SetLastError = true)] public static extern bool EndPagePrinter(IntPtr h);
  [DllImport("winspool.drv", SetLastError = true)] public static extern bool WritePrinter(IntPtr h, byte[] b, int n, out int w);
  public static string Enviar(string impressora, byte[] dados) {
    IntPtr h;
    if (!OpenPrinter(impressora, out h, IntPtr.Zero)) return "ERRO ao abrir a impressora (" + Marshal.GetLastWin32Error() + ")";
    try {
      DOCINFO di = new DOCINFO(); di.pDocName = "GERIZ PDV - Cupom"; di.pDataType = "RAW";
      if (StartDocPrinter(h, 1, di) == 0) return "ERRO ao iniciar (" + Marshal.GetLastWin32Error() + ")";
      try {
        StartPagePrinter(h);
        int escritos;
        bool ok = WritePrinter(h, dados, dados.Length, out escritos);
        EndPagePrinter(h);
        if (!ok || escritos != dados.Length) return "ERRO ao enviar (" + Marshal.GetLastWin32Error() + ")";
      } finally { EndDocPrinter(h); }
    } finally { ClosePrinter(h); }
    return "OK";
  }
}
"@
$bytes = [System.IO.File]::ReadAllBytes($Arquivo)
Write-Output ([GerizRaw]::Enviar($Impressora, $bytes))
`;

function enviarCru(impressora, bytes, pastaApp) {
  return new Promise((resolver) => {
    if (process.platform !== "win32") return resolver({ ok: false, erro: "Só no Windows." });
    if (!impressora) return resolver({ ok: false, erro: "Nenhuma impressora escolhida." });
    try {
      const script = path.join(pastaApp, "imprimir-cru.ps1");
      if (!fs.existsSync(script) || fs.readFileSync(script, "utf8") !== SCRIPT) fs.writeFileSync(script, SCRIPT, "utf8");
      const arquivo = path.join(os.tmpdir(), `geriz-cupom-${Date.now()}.bin`);
      fs.writeFileSync(arquivo, bytes);
      execFile(
        "powershell.exe",
        ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", script, impressora, arquivo],
        { windowsHide: true, timeout: 20000 },
        (erro, saida) => {
          fs.rm(arquivo, { force: true }, () => {});
          const texto = String(saida || "").trim();
          if (erro) return resolver({ ok: false, erro: String(erro.message || erro) });
          resolver(texto.endsWith("OK") ? { ok: true } : { ok: false, erro: texto || "falhou" });
        },
      );
    } catch (e) {
      resolver({ ok: false, erro: String((e && e.message) || e) });
    }
  });
}

module.exports = { enviarCru };
