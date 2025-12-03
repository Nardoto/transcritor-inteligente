# Transcritor Inteligente

Aplicativo web para transcrever áudios e gerar legendas SRT customizadas.

## Funcionalidades

- Upload de áudio/vídeo (qualquer formato)
- Suporte a áudios longos (1h+)
- Transcrição via Whisper AI (Hugging Face - GRATUITO)
- Configuração do tempo mínimo/máximo por bloco de legenda
- Configuração de caracteres por linha
- Download do arquivo .SRT

## Como usar

1. Acesse o site
2. Crie uma chave gratuita em [Hugging Face](https://huggingface.co/settings/tokens)
3. Cole a chave no campo indicado
4. Faça upload do áudio
5. Configure os tempos (min/max segundos por bloco)
6. Clique em "Transcrever"
7. Baixe o arquivo .SRT

## Deploy no Vercel

### Opção 1: Via GitHub

1. Suba este código para um repositório no GitHub
2. Acesse [vercel.com](https://vercel.com)
3. Clique em "New Project"
4. Importe o repositório do GitHub
5. Clique em "Deploy"

### Opção 2: Via CLI

```bash
npm i -g vercel
vercel
```

## Tecnologias

- HTML5 / CSS3 / JavaScript puro
- Web Audio API (para processar áudios longos)
- Hugging Face Inference API (Whisper)

## Gratuito e Ilimitado

A API do Hugging Face é gratuita para uso. Não há limites de transcrição.

## Licença

MIT
