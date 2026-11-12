# Assistente da marca (IA)

A inteligência artificial fica **só no Núcleo da Marca e no Radar de Tendências**, na área restrita. O gerador de peças continua sem IA: ele só lê as regras publicadas.

## Como funciona

1. Você escreve o pedido em palavras. Por exemplo: "inclua a área Ouvidoria" ou "crie um branding de campanha para o Outubro Rosa".
2. O assistente lê os arquivos de regras e devolve as mudanças, com o motivo de cada uma. No Núcleo, são a marca e, se você escolher, um formato. No Radar, são as tendências.
3. Você vê o **antes e depois** de cada linha.
4. **Testar na prévia** abre o gerador em modo teste, com as regras novas, só no seu navegador e sem publicar nada.
5. **Publicar no site** grava no GitHub, e o site atualiza em 1 a 2 minutos.

O assistente só pode mexer em:
- **Núcleo:** `config/marca.json` e `config/formatos/*.json`.
- **Radar:** `config/tendencias.json`. Ele cria tendências, liga e desliga cada uma, muda o bloco `campanha` e monta brandings novos. O ciclo anterior fica guardado em `ciclosAnteriores`.

Quando um pedido precisa de desenho novo (código), ele avisa em "limites". É o caso de uma tendência com um efeito visual que os modelos ainda não conhecem.

## Configuração (uma vez só)

### 1. Chave da IA

1. Entre em https://console.anthropic.com, crie uma chave de API e copie.
2. O uso é cobrado por pedido.

### 2. Função no Supabase

1. No painel do Supabase, abra **Edge Functions → Deploy a new function → Via Editor**.
2. Dê o nome `assistente` e cole todo o conteúdo de `supabase/functions/assistente/index.ts`.
3. Clique em **Deploy function**.
4. Em **Edge Functions → Secrets**, adicione:
   - `ANTHROPIC_API_KEY`: a chave do passo 1.
   - `ASSISTENTE_MODELO` (opcional): o modelo da IA. O padrão é `claude-sonnet-5-5`.
   - `PAPEIS_IA` (opcional): quem pode usar. O padrão é `dono`. Para liberar a equipe, use `dono,equipe`.

A chave fica só no Supabase, nunca no site nem no GitHub.

### 3. Permissão para publicar

1. O login da área restrita agora pede ao GitHub a permissão de gravar no repositório público (`public_repo`).
2. Para valer, clique em **Sair** e entre de novo. O GitHub vai mostrar a nova permissão.
3. Sua conta precisa ter permissão de escrita em `informativoudi/sistemamarketing`.
4. Se a organização restringir aplicativos de terceiros, aprove o aplicativo OAuth em **GitHub → Settings da organização → Third-party access**.

## Modo teste do gerador

- `index.html?teste=1` usa as regras propostas e guardadas pelo botão "Testar na prévia".
- Uma faixa amarela avisa que é teste, e "Sair do teste" volta às regras publicadas.
- Ao publicar, o teste daquele arquivo é limpo sozinho.
