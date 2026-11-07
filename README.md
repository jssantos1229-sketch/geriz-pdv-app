# GERIZ PDV para Windows

Dois aplicativos (uma solução GERIZ, desenvolvida por Salusti Company), com o
mesmo sistema, login e dados do site:

| Aplicativo | Abre | Baixar |
|---|---|---|
| **GERIZ PDV** (administrador) | "Entre com seu estabelecimento" e o Painel do Administrador | [GERIZ-PDV-Setup.exe](https://github.com/jssantos1229-sketch/geriz-pdv-app/releases/latest/download/GERIZ-PDV-Setup.exe) |
| **GERIZ Frente de Caixa** (operador) | "Abrir o caixa" e só o caixa, em tela cheia, junto com o Windows | [GERIZ-Frente-de-Caixa-Setup.exe](https://github.com/jssantos1229-sketch/geriz-pdv-app/releases/latest/download/GERIZ-Frente-de-Caixa-Setup.exe) |

Os dois imprimem **direto na impressora térmica** (ESC/POS: corte do papel e
gaveta), sem a janela "Imprimir", e **se atualizam sozinhos** (Frente de Caixa
pelo `latest.yml`, GERIZ PDV pelo `painel.yml`).

Na primeira instalação o Windows pode avisar "O Windows protegeu o computador":
clique em **Mais informações → Executar assim mesmo**.

## Configurar (no caixa)

Aperte **Alt** para ver o menu: **Impressora** (escolher, imprimir teste, tipo de
impressão, gaveta), **Endereço** (homologação ou site real) e **GERIZ PDV**
(tela cheia, abrir com o Windows, procurar atualização).

## Publicar versão nova

Aumente a `version` no `package.json` e envie para a `main`: o GitHub gera o
os dois
instaladores e publica nas Releases. Nenhuma senha ou chave fica neste repositório.
