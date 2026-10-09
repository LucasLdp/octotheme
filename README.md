<div align="center">

<img src="media/octotheme-octopus.png" alt="Mascote do OctoTheme: um polvo colorido segurando uma paleta e uma engrenagem" width="220">

# OctoTheme

**Troque a cor de destaque do GNOME e deixe o tema e os ícones acompanharem.**
Uma cor, um tema, um pacote de ícones. Sem mexer em nada à mão.

![GNOME Shell](https://img.shields.io/badge/GNOME_Shell-45%20→%2050-4a86cf?logo=gnome&logoColor=white)
![Versão](https://img.shields.io/badge/vers%C3%A3o-0.2.0-8e5ab5)
![Idiomas](https://img.shields.io/badge/idiomas-pt--BR%20%7C%20en-3a944a)
![Sem Adw no GNOME Shell](https://img.shields.io/badge/runtime-GJS%20%2F%20ESM-ed5b00)

[English](README.en.md) · **Português**

</div>

---

## O que é

O GNOME mudou só a cor de destaque (*accent color*) a partir da versão 47, e o resto da aparência continua manual. O OctoTheme resolve isso: você diz **qual tema GTK, GNOME Shell e conjunto de ícones** combinam com cada cor, e a extensão aplica tudo sozinha quando a cor muda.

```
🟢 Verde   →   tema X   +   ícones Y
🔵 Azul    →   tema Z   +   ícones W
```

A cor ativa pode vir das **Configurações do GNOME**, de uma escolha **manual** ou da **cor dominante do plano de fundo** (opcional).

## Destaques

- 🎨 **Uma cor, um visual completo.** Cada uma das 9 cores do GNOME tem seu tema e seus ícones.
- 🖼️ **Cor extraída do plano de fundo (opcional).** Desligada por padrão. Quando ligada, a extensão escolhe o accent mais próximo da imagem e cai em cinza se o wallpaper for neutro.
- 👀 **Prévia do plano de fundo claro e escuro** nas preferências, só para ver, sem aplicar nada.
- 🌗 **Padrão simples, claro/escuro opcional.** Por padrão um único tema e um único pacote de ícones valem para qualquer aparência. Se quiser, separe configurações para claro e escuro.
- 🧩 **Famílias automáticas.** Em vez de caçar pastas como `Yaru-dark`, `YARU-DARK` ou `Yaru-blue-dark`, você escolhe a família "Yaru" e a extensão encontra a variante certa para a cor e a aparência atuais.
- 🗂️ **Grupo "Outros".** Pacotes únicos e cores que o GNOME não tem ficam separados, sem poluir a lista principal.
- 🛠️ **Ajuste fino por cor.** Escolhas exatas por cor substituem a família automática quando você quiser.
- 🌍 **Português (Brasil) e English**, com troca ao vivo na aba **Idioma**, ou seguindo o sistema.
- 🪶 **Leve e sem dependências extras.** Só GJS e bibliotecas que já vêm com o GNOME.

## Compatibilidade

| Item | Suporte |
| --- | --- |
| GNOME Shell | 45, 46, 47, 48, 49, 50 |
| Accent color nativo | GNOME 47 ou mais novo (`org.gnome.desktop.interface accent-color`) |
| GNOME 45 e 46 | Sem accent nativo: a cor ativa é guardada pela própria extensão e escolhida nas preferências |
| Tema do GNOME Shell | Exige a extensão **User Themes** instalada |
| Extração de cor do wallpaper | Usa GdkPixbuf. Se faltar, a extensão avisa e o resto continua funcionando |

## Instalação

```bash
git clone <url-do-repositorio> octotheme
cd octotheme
./install.sh
```

O script precisa do `glib-compile-schemas`:

| Distro | Pacote |
| --- | --- |
| Fedora | `sudo dnf install glib2-devel` |
| Debian / Ubuntu | `sudo apt install libglib2.0-bin` |

Depois da instalação:

1. **Saia da sessão e entre de novo.** No Wayland, extensões novas só aparecem após um novo login.
2. Ative e abra as preferências:

```bash
gnome-extensions enable octotheme@lucas.local
gnome-extensions prefs  octotheme@lucas.local
```

## Como usar

1. Abra as preferências e deixe **Ativar troca automática** ligado.
2. Em **Famílias de temas** e **Famílias de ícones**, abra uma família e use **Usar família** para o pacote automático, ou **Aplicar à cor** em uma variante específica.
3. Em **Ajustes manuais por cor**, abra uma cor para escolher o tema e os ícones exatos dela. Isso tem prioridade sobre a família automática.
4. Troque a cor em **Configurações → Aparência** (ou use a **Cor ativa** das preferências) e veja tudo mudar.
5. Quer acompanhar o plano de fundo? Ligue **Usar cor do plano de fundo**.
6. Quer configurações diferentes para claro e escuro? Mude **Configuração de aparência** para **Personalizado**.

## Como a detecção de famílias funciona

A extensão lê as pastas instaladas, sem alterar nenhum arquivo:

| Tipo | Locais |
| --- | --- |
| Temas | `~/.themes`, `~/.local/share/themes`, `/usr/local/share/themes`, `/usr/share/themes` |
| Ícones | `~/.icons`, `~/.local/share/icons`, `/usr/local/share/icons`, `/usr/share/icons` |

O nome da pasta é quebrado em partes. As primeiras palavras formam a **família**; as palavras seguintes são classificadas como **aparência** (`dark`, `light`, `white`, `black`, `night`, `day`), **cor** (`blue`, `green`, `brown`...) ou **detalhe extra** (`compact`, `nord`...).

| Pasta | Família | Aparência | Cor | Extra |
| --- | --- | --- | --- | --- |
| `Yaru-blue-dark` | Yaru | escuro | azul | |
| `YARU-DARK` | Yaru | escuro | | |
| `Colloid-Dark-Compact` | Colloid | escuro | | compact |
| `Flat-Remix-GTK-Blue-Dark` | Flat Remix | escuro | azul | |
| `Reversal-brown` | Reversal | | marrom (fora do GNOME) | |

Maiúsculas, hífens, pontos e sublinhados não importam. Nomes que apontam para o mesmo lugar são marcados como **ambíguos** para você decidir.

### Quando algo vai para "Outros"

| Tipo | Vai para "Outros" quando... | Exemplos |
| --- | --- | --- |
| **Temas** | não tem variação de cor **e** não tem modo escuro/claro | Dracula, Nordic, Default |
| **Ícones** | é um pacote único, sem variação de cor nem de aparência | hicolor, Adwaita, Adwaita Legacy |
| **Ícones** | a variante usa uma cor que o GNOME não tem | `Reversal-brown`, `Yaru-sage` |

Famílias com variação real (Colloid, Marble Shell, Papirus...) continuam na lista principal. Uma variante de cor fora do GNOME sai da família e vai para "Outros", e o restante da família fica onde estava.

## Configurações guardadas

Tudo fica em GSettings (`org.gnome.shell.extensions.octotheme`):

| Chave | Descrição |
| --- | --- |
| `enabled` | Liga e desliga a troca automática |
| `use-wallpaper` | Usa a cor dominante do plano de fundo |
| `manual-color` | Cor ativa quando o GNOME não tem accent nativo |
| `theme-mode` | `shared` (um visual para tudo) ou `per-mode` (claro e escuro separados) |
| `auto-theme-family` / `auto-icon-family` | Famílias automáticas escolhidas |
| `mappings` | JSON com as escolhas exatas por cor |
| `language` | `auto`, `pt-BR` ou `en` |

Exemplo de `mappings`:

```json
{
  "green": {
    "theme": "Marble-shell-green-dark",
    "icon": "Papirus",
    "light": { "icon": "Papirus-Light" },
    "dark":  { "icon": "Papirus-Dark" }
  }
}
```

Campos de `light` e `dark` só valem no modo **Personalizado** e, se estiverem vazios, usam o valor compartilhado.

## Estrutura do projeto

```
octotheme/
├── extension.js        # lógica principal: aplica tema, ícones e cor do wallpaper
├── prefs.js            # janela de preferências (abas Aparência e Idioma)
├── theme-catalog.js    # agrupamento por família, variantes e regras de "Outros"
├── theme-inventory.js  # leitura das pastas de temas e ícones instalados
├── i18n.js             # traduções pt-BR / en
├── schemas/            # schema GSettings
├── media/              # mascote
├── metadata.json
└── install.sh
```

## Solução de problemas

**A extensão não aparece depois de instalar.**
Saia da sessão e entre de novo. No Wayland é o único jeito de a extensão nova ser descoberta.

**Nada muda ao trocar a cor.**
Confira se uma família ou uma escolha manual existe para aquela cor. Cores sem configuração são ignoradas. O tema do Shell só muda com a extensão User Themes instalada.

**Um app não mudou de tema.**
Apps libadwaita ignoram o tema GTK e seguem só a cor de destaque do sistema.

**Um pacote novo não aparece.**
Use **Reexaminar pastas de temas** nas preferências.

**Ver os logs da extensão:**

```bash
journalctl -f -o cat /usr/bin/gnome-shell | grep OctoTheme
```

**Ler uma configuração direto no terminal:**

```bash
gsettings --schemadir ~/.local/share/gnome-shell/extensions/octotheme@lucas.local/schemas \
  get org.gnome.shell.extensions.octotheme mappings
```

## Limitações conhecidas

- Apps libadwaita não seguem o tema GTK escolhido, apenas o accent do sistema.
- Wallpapers dinâmicos (`.xml`) não são analisados para extrair cor.
- Em famílias coloridas, a seleção automática exige a cor exata e não cai para uma variante genérica.

## Roadmap

- [ ] Preencher automaticamente cada cor com a variante de mesmo nome (por exemplo `-green` para o verde)
- [ ] Variante automática por claro/escuro, escolhendo só a família
- [ ] Presets: exportar e importar combinações em JSON
- [ ] Extração de cor mais refinada (agrupamento por cores, ignorar bordas e legendas)
- [ ] Cor fixa por plano de fundo
- [ ] Tema de cursor e fonte por cor
- [ ] Atalho nas Configurações Rápidas
- [ ] Agendamento por horário, nascer e pôr do sol
- [ ] Recolorir apps libadwaita via `gtk.css`
- [ ] Publicar em extensions.gnome.org

## Contribuindo

Bugs e ideias são bem-vindos. Ao reportar um problema de agrupamento, inclua a saída de:

```bash
ls ~/.themes ~/.icons /usr/share/themes /usr/share/icons
```

Ela mostra os nomes reais das pastas e ajuda a ajustar a detecção.

## Licença

Defina a licença antes de publicar. Para enviar a extensão ao extensions.gnome.org, ela precisa ser compatível com a GPL (GPL-2.0-or-later ou GPL-3.0-or-later são escolhas comuns).

---

<div align="center">
Feito com 🐙 por <b>Lucas Gomes</b>
</div>
