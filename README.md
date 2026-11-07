# GERIZ PDV para Windows

Aplicativo **GERIZ Frente de Caixa** (GERIZ PDV) (uma solução GERIZ, desenvolvida por Salusti Company).

- Abre a Frente de Caixa do GERIZ (o mesmo sistema, login e dados do site).
- Imprime o cupom **direto na impressora térmica** (ESC/POS: corte do papel e gaveta), sem a janela "Imprimir".
- Abre junto com o Windows, em tela cheia, e **se atualiza sozinho**.

## Baixar

**[GERIZ-Frente-de-Caixa-Setup.exe](https://github.com/jssantos1229-sketch/geriz-pdv-app/releases/latest/download/GERIZ-Frente-de-Caixa-Setup.exe)**

Na primeira instalação o Windows pode avisar "O Windows protegeu o computador":
clique em **Mais informações → Executar assim mesmo**.

## Configurar (no caixa)

Aperte **Alt** para ver o menu: **Impressora** (escolher, imprimir teste, tipo de
impressão, gaveta), **Endereço** (homologação ou site real) e **GERIZ PDV**
(tela cheia, abrir com o Windows, procurar atualização).

## Publicar versão nova

Aumente a `version` no `package.json` e envie para a `main`: o GitHub gera o
instalador e publica nas Releases. Nenhuma senha ou chave fica neste repositório.
