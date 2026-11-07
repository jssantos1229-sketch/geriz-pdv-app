// Ponte segura entre o site do GERIZ e o aplicativo: o site só enxerga
// "window.gerizDesktop.imprimir". Nada do computador fica exposto.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("gerizDesktop", {
  aplicativo: "GERIZ PDV",
  versao: process.env.GERIZ_PDV_VERSAO || "",
  imprimir: (html, opcoes) => ipcRenderer.invoke("geriz:imprimir", String(html || ""), opcoes || {}),
  // 1.1+: cupom em ESC/POS (térmica) e gaveta de dinheiro.
  imprimirCupom: (cupom) => ipcRenderer.invoke("geriz:imprimir-cupom", cupom || {}),
  abrirGaveta: () => ipcRenderer.invoke("geriz:abrir-gaveta"),
});
