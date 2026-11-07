// GERIZ PDV para Windows.
// Abre a Frente de Caixa do GERIZ (o mesmo site, mesmo login e mesmos dados)
// e imprime o cupom DIRETO na impressora escolhida, sem a janela "Imprimir".
// Não guarda chave nenhuma: é só uma janela do site com a impressão liberada.
const { app, BrowserWindow, Menu, ipcMain, shell, dialog } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const { montarEscPos, soGaveta } = require("./escpos.cjs");
const { enviarCru } = require("./impressao-crua.cjs");

// Atualização automática: o aplicativo procura versão nova nas "Releases" do
// repositório público github.com/jssantos1229-sketch/geriz-pdv-app (configurado
// no package.json → build.publish) e instala ao reiniciar.
let autoUpdater = null;
try {
  autoUpdater = require("electron-updater").autoUpdater;
} catch {
  autoUpdater = null;
}

const ENDERECOS = [
  { id: "homologacao", rotulo: "Homologação do PDV (testes)", url: "https://homologacao-pdv-geriz-delivery.jssantos1229.workers.dev/pdv/caixa" },
  { id: "geriz", rotulo: "Site real (geriz.com.br)", url: "https://geriz.com.br/pdv/caixa" },
  { id: "delivery", rotulo: "Site real (delivery.geriz.com.br)", url: "https://delivery.geriz.com.br/pdv/caixa" },
];
const HOSTS_PERMITIDOS = new Set(ENDERECOS.map((e) => new URL(e.url).host).concat(["www.geriz.com.br"]));

process.env.GERIZ_PDV_VERSAO = app.getVersion();

// ---------- Configuração deste computador ----------
const arquivoConfig = () => path.join(app.getPath("userData"), "config.json");
let config = {
  endereco: "homologacao",
  impressora: "",
  telaCheia: false,
  // "automatico": cupom em ESC/POS se a impressora for térmica (Epson TM, Elgin...).
  modoImpressao: "automatico",
  gavetaDinheiro: true,
  inicializado: false,
};

// Primeira vez neste computador: abre junto com o Windows e em tela cheia.
function primeiraVez() {
  if (config.inicializado) return;
  config.inicializado = true;
  config.telaCheia = true;
  try {
    app.setLoginItemSettings({ openAtLogin: true });
  } catch {
    // sem permissão: o operador marca pelo menu (Alt)
  }
  salvarConfig();
}
function lerConfig() {
  try {
    config = { ...config, ...JSON.parse(fs.readFileSync(arquivoConfig(), "utf8")) };
  } catch {
    // primeira vez: fica o padrão
  }
}
function salvarConfig() {
  try {
    fs.mkdirSync(path.dirname(arquivoConfig()), { recursive: true });
    fs.writeFileSync(arquivoConfig(), JSON.stringify(config, null, 2));
  } catch {
    // sem permissão de gravar: vale só até fechar
  }
}
const enderecoAtual = () => ENDERECOS.find((e) => e.id === config.endereco) || ENDERECOS[0];

function hostPermitido(url) {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && HOSTS_PERMITIDOS.has(u.host);
  } catch {
    return false;
  }
}

// ---------- Janela principal ----------
let janela = null;

function criarJanela() {
  janela = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    title: "GERIZ Frente de Caixa",
    icon: path.join(__dirname, "build", "icon.png"),
    backgroundColor: "#ffffff",
    // Menu escondido: aparece só ao apertar a tecla Alt (configurações do aplicativo).
    autoHideMenuBar: true,
    fullscreen: Boolean(config.telaCheia),
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      spellcheck: false,
    },
  });
  janela.maximize();
  janela.once("ready-to-show", () => janela.show());
  // O nome da janela fica sempre "GERIZ Frente de Caixa" (não o título da página).
  janela.on("page-title-updated", (e) => e.preventDefault());

  // Links de fora do GERIZ abrem no navegador normal.
  janela.webContents.setWindowOpenHandler(({ url }) => {
    if (hostPermitido(url)) return { action: "allow" };
    if (/^https?:/i.test(url)) void shell.openExternal(url);
    return { action: "deny" };
  });
  janela.webContents.on("will-navigate", (evento, url) => {
    if (!hostPermitido(url) && !url.startsWith("data:")) {
      evento.preventDefault();
      if (/^https?:/i.test(url)) void shell.openExternal(url);
    }
  });

  // Sem internet na primeira vez: mostra um aviso com "Tentar de novo".
  janela.webContents.on("did-fail-load", (_e, codigo, _desc, url, principal) => {
    if (!principal || codigo === -3) return; // -3 = carregamento cancelado (normal)
    const voltar = JSON.stringify(url || enderecoAtual().url);
    const pagina = `<!doctype html><meta charset="utf-8"><title>GERIZ PDV</title>
      <body style="font-family:Arial;display:grid;place-items:center;height:100vh;margin:0;background:#f8fafc;color:#0b1b3a">
      <div style="text-align:center"><h1>Sem conexão com o GERIZ</h1>
      <p>Confira a internet deste computador e clique em tentar de novo.</p>
      <button style="font-size:18px;padding:10px 24px;background:#1565FF;color:#fff;border:0;border-radius:8px"
        onclick='location.href=${voltar}'>Tentar de novo</button></div></body>`;
    void janela.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(pagina)}`);
  });

  void janela.loadURL(enderecoAtual().url);
}

// ---------- Impressão direta ----------
async function imprimirHtml(html) {
  const oculto = new BrowserWindow({
    show: false,
    webPreferences: { javascript: false, sandbox: true, contextIsolation: true },
  });
  try {
    await oculto.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    const opcoes = { silent: true, printBackground: false, margins: { marginType: "none" } };
    if (config.impressora) opcoes.deviceName = config.impressora;
    return await new Promise((resolver) => {
      oculto.webContents.print(opcoes, (ok, motivo) => resolver(ok ? { ok: true } : { ok: false, erro: motivo || "falhou" }));
    });
  } catch (erro) {
    return { ok: false, erro: String(erro && erro.message ? erro.message : erro) };
  } finally {
    setTimeout(() => {
      if (!oculto.isDestroyed()) oculto.destroy();
    }, 1500);
  }
}

ipcMain.handle("geriz:imprimir", async (evento, html) => {
  // Só o site do GERIZ pode pedir impressão.
  const origem = evento.senderFrame ? evento.senderFrame.url : "";
  if (!hostPermitido(origem)) return { ok: false, erro: "Pedido de impressão fora do GERIZ." };
  if (!html || html.length > 3_000_000) return { ok: false, erro: "Cupom vazio ou grande demais." };
  return imprimirHtml(html);
});

// ---------- Cupom térmico (ESC/POS) ----------
const PARECE_TERMICA = /tm-|epson|elgin|bematech|daruma|sweda|tanca|knup|control ?id|diebold|receipt|t[eé]rmica|pos[- ]?\d|80 ?mm|58 ?mm/i;

async function impressoraEfetiva() {
  if (config.impressora) return config.impressora;
  try {
    const lista = janela ? await janela.webContents.getPrintersAsync() : [];
    const padrao = lista.find((p) => p.isDefault);
    return padrao ? padrao.name : "";
  } catch {
    return "";
  }
}

async function usarEscPos() {
  if (process.platform !== "win32") return false;
  if (config.modoImpressao === "imagem") return false;
  if (config.modoImpressao === "termico") return true;
  return PARECE_TERMICA.test(await impressoraEfetiva());
}

ipcMain.handle("geriz:imprimir-cupom", async (evento, cupom) => {
  const origem = evento.senderFrame ? evento.senderFrame.url : "";
  if (!hostPermitido(origem)) return { ok: false, erro: "Pedido de impressão fora do GERIZ." };
  if (!cupom || !Array.isArray(cupom.linhas) || cupom.linhas.length > 2000) return { ok: false, erro: "Cupom inválido." };
  if (!(await usarEscPos())) return { ok: false, erro: "modo-imagem" };
  const abrir = Boolean(cupom.abrirGaveta) && config.gavetaDinheiro;
  return enviarCru(await impressoraEfetiva(), montarEscPos({ ...cupom, abrirGaveta: abrir }), app.getPath("userData"));
});

ipcMain.handle("geriz:abrir-gaveta", async (evento) => {
  const origem = evento.senderFrame ? evento.senderFrame.url : "";
  if (!hostPermitido(origem)) return { ok: false, erro: "Pedido fora do GERIZ." };
  return enviarCru(await impressoraEfetiva(), soGaveta(), app.getPath("userData"));
});

function cupomDeTesteEscPos() {
  return {
    colunas: 48,
    cortar: true,
    abrirGaveta: false,
    linhas: [
      { texto: "GERIZ PDV", alinhar: "centro", negrito: true, tamanho: "grande" },
      { texto: "Teste de impressão térmica", alinhar: "centro" },
      { separador: true },
      { texto: `Impressora: ${config.impressora || "padrão do Windows"}` },
      { texto: `Data: ${new Date().toLocaleString("pt-BR")}` },
      { texto: "Acentos: ação, café, pão, maçã, você" },
      { separador: true },
      { texto: "Se este papel saiu e cortou, está tudo certo!", alinhar: "centro", negrito: true },
    ],
  };
}

function cupomDeTeste() {
  const agora = new Date().toLocaleString("pt-BR");
  return `<!doctype html><meta charset="utf-8"><style>@page{margin:0}body{width:72mm;margin:0 auto;padding:2mm 1mm;font:600 13px "Courier New",monospace;color:#000}
    .c{text-align:center}hr{border:0;border-top:1.5px dashed #000}</style><body>
    <div class="c" style="font-size:18px;font-weight:800">GERIZ PDV</div>
    <div class="c">Teste de impressão</div><hr>
    <div>Impressora: ${config.impressora || "padrão do Windows"}</div>
    <div>Data: ${agora}</div><hr>
    <div class="c">Se este papel saiu, está tudo certo!</div><div style="height:10mm"></div></body>`;
}

// ---------- Menu ----------
async function montarMenu() {
  let impressoras = [];
  try {
    impressoras = janela ? await janela.webContents.getPrintersAsync() : [];
  } catch {
    impressoras = [];
  }
  const itensImpressora = [
    {
      label: "Padrão do Windows",
      type: "radio",
      checked: !config.impressora,
      click: () => {
        config.impressora = "";
        salvarConfig();
      },
    },
    ...impressoras.map((p) => ({
      label: p.displayName || p.name,
      type: "radio",
      checked: config.impressora === p.name,
      click: () => {
        config.impressora = p.name;
        salvarConfig();
      },
    })),
    { type: "separator" },
    { label: "Atualizar a lista", click: () => void montarMenu() },
    {
      label: "Imprimir um teste",
      click: async () => {
        const termica = await usarEscPos();
        const r = termica
          ? await enviarCru(await impressoraEfetiva(), montarEscPos(cupomDeTesteEscPos()), app.getPath("userData"))
          : await imprimirHtml(cupomDeTeste());
        if (!r.ok) dialog.showErrorBox("GERIZ PDV", `Não foi possível imprimir o teste: ${r.erro}`);
      },
    },
    { type: "separator" },
    {
      label: "Tipo de impressão",
      submenu: [
        ["automatico", "Automático (térmica = cupom ESC/POS)"],
        ["termico", "Sempre cupom térmico (ESC/POS)"],
        ["imagem", "Sempre como imagem (igual ao navegador)"],
      ].map(([id, rotulo]) => ({
        label: rotulo,
        type: "radio",
        checked: (config.modoImpressao || "automatico") === id,
        click: () => {
          config.modoImpressao = id;
          salvarConfig();
        },
      })),
    },
    {
      label: "Abrir a gaveta nas vendas em dinheiro",
      type: "checkbox",
      checked: config.gavetaDinheiro !== false,
      click: (item) => {
        config.gavetaDinheiro = item.checked;
        salvarConfig();
      },
    },
    {
      label: "Abrir a gaveta agora",
      click: async () => {
        const r = await enviarCru(await impressoraEfetiva(), soGaveta(), app.getPath("userData"));
        if (!r.ok) dialog.showErrorBox("GERIZ PDV", `Não foi possível abrir a gaveta: ${r.erro}`);
      },
    },
  ];

  const molde = [
    {
      label: "GERIZ PDV",
      submenu: [
        { label: "Recarregar", accelerator: "Ctrl+R", click: () => janela && janela.webContents.reload() },
        {
          label: "Recarregar tudo (versão nova)",
          accelerator: "Ctrl+Shift+R",
          click: () => janela && janela.webContents.reloadIgnoringCache(),
        },
        {
          label: "Tela cheia",
          accelerator: "F11",
          type: "checkbox",
          checked: Boolean(config.telaCheia),
          click: (item) => {
            config.telaCheia = item.checked;
            salvarConfig();
            if (janela) janela.setFullScreen(item.checked);
          },
        },
        {
          label: "Abrir junto com o Windows",
          type: "checkbox",
          checked: app.getLoginItemSettings().openAtLogin,
          click: (item) => app.setLoginItemSettings({ openAtLogin: item.checked }),
        },
        {
          label: "Procurar atualização",
          click: () => {
            if (!autoUpdater) return;
            autoUpdater
              .checkForUpdates()
              .then((r) => {
                if (!r || !r.updateInfo || r.updateInfo.version === app.getVersion()) {
                  void dialog.showMessageBox({ type: "info", title: "GERIZ PDV", message: `Você já está na versão mais nova (${app.getVersion()}).` });
                }
              })
              .catch(() => dialog.showErrorBox("GERIZ PDV", "Não foi possível procurar atualização agora."));
          },
        },
        { type: "separator" },
        { label: "Sair", accelerator: "Alt+F4", role: "quit" },
      ],
    },
    { label: "Impressora", submenu: itensImpressora },
    {
      label: "Endereço",
      submenu: ENDERECOS.map((e) => ({
        label: e.rotulo,
        type: "radio",
        checked: enderecoAtual().id === e.id,
        click: () => {
          config.endereco = e.id;
          salvarConfig();
          if (janela) void janela.loadURL(e.url);
        },
      })),
    },
    {
      label: "Ajuda",
      submenu: [
        { label: "Ferramentas de suporte", accelerator: "Ctrl+Shift+I", click: () => janela && janela.webContents.toggleDevTools() },
        {
          label: "Sobre",
          click: () =>
            dialog.showMessageBox({
              type: "info",
              title: "GERIZ PDV",
              message: `GERIZ PDV ${app.getVersion()}`,
              detail: `Endereço: ${enderecoAtual().rotulo}\nImpressora: ${config.impressora || "padrão do Windows"}`,
            }),
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(molde));
}

// ---------- Atualização automática ----------
function iniciarAtualizacoes() {
  if (!autoUpdater || !app.isPackaged) return;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on("error", () => {
    // sem internet ou sem versão publicada: tenta de novo mais tarde
  });
  autoUpdater.on("update-downloaded", async (info) => {
    const r = await dialog.showMessageBox({
      type: "info",
      title: "GERIZ PDV",
      message: `Versão nova do GERIZ PDV pronta (${info.version}).`,
      detail: "Reiniciar agora para atualizar? Se preferir, ela entra sozinha da próxima vez que o aplicativo abrir.",
      buttons: ["Reiniciar agora", "Depois"],
      defaultId: 1,
      cancelId: 1,
    });
    if (r.response === 0) autoUpdater.quitAndInstall();
  });
  const procurar = () => autoUpdater.checkForUpdates().catch(() => {});
  setTimeout(procurar, 15_000);
  setInterval(procurar, 60 * 60_000);
}

// ---------- Início ----------
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (janela) {
      if (janela.isMinimized()) janela.restore();
      janela.focus();
    }
  });
  app.whenReady().then(() => {
    lerConfig();
    primeiraVez();
    criarJanela();
    void montarMenu();
    iniciarAtualizacoes();
  });
  app.on("window-all-closed", () => app.quit());
}
