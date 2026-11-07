// Receita do instalador "GERIZ PDV" (painel do administrador).
// Usa tudo do package.json (build) e troca só o que é do painel: nome, ícone,
// arquivo do instalador e o canal de atualização ("painel.yml").
const base = require("./package.json").build;

module.exports = {
  ...base,
  appId: "br.com.geriz.pdv.painel",
  productName: "GERIZ PDV",
  artifactName: "GERIZ-PDV-Setup.${ext}",
  directories: { output: "dist-painel" },
  extraMetadata: { gerizModo: "painel", productName: "GERIZ PDV" },
  win: { ...base.win, icon: "build/icon-painel.png" },
  nsis: {
    ...base.nsis,
    shortcutName: "GERIZ PDV",
    uninstallDisplayName: "GERIZ PDV",
  },
  publish: base.publish.map((p) => ({ ...p, channel: "painel" })),
};
