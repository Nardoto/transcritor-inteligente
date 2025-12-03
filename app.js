// ==========================================
// TRANSCRITOR INTELIGENTE - Whisper no Navegador
// 100% Gratuito - Sem API Key - Sem Limites
// ==========================================

import { pipeline } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.1';

// Elementos do DOM
const modelSection = document.getElementById('modelSection');
const modelStatus = document.getElementById('modelStatus');
const modelProgress = document.getElementById('modelProgress');
const modelProgressFill = document.getElementById('modelProgressFill');
const modelProgressText = document.getElementById('modelProgressText');
const uploadArea = document.getElementById('uploadArea');
const audioInput = document.getElementById('audioInput');
const fileInfo = document.getElementById('fileInfo');
const fileName = document.getElementById('fileName');
const removeFile = document.getElementById('removeFile');
const minTimeInput = document.getElementById('minTime');
const maxTimeInput = document.getElementById('maxTime');
const maxCharsInput = document.getElementById('maxChars');
const languageSelect = document.getElementById('language');
const transcribeBtn = document.getElementById('transcribeBtn');
const progressSection = document.getElementById('progressSection');
const progressFill = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');
const resultSection = document.getElementById('resultSection');
const resultStats = document.getElementById('resultStats');
const srtOutput = document.getElementById('srtOutput');
const copyBtn = document.getElementById('copyBtn');
const downloadBtn = document.getElementById('downloadBtn');

// Estado do app
let selectedFile = null;
let transcriber = null;
let modelReady = false;

// ==========================================
// INICIALIZAÇÃO - CARREGAR MODELO
// ==========================================

async function initModel() {
    try {
        updateModelStatus('loading', '⏳', 'Carregando modelo Whisper...');
        modelProgress.hidden = false;

        // Carregar o modelo Whisper (versão pequena para ser rápido)
        transcriber = await pipeline(
            'automatic-speech-recognition',
            'Xenova/whisper-small',
            {
                progress_callback: (progress) => {
                    if (progress.status === 'downloading') {
                        const percent = progress.progress || 0;
                        modelProgressFill.style.width = percent + '%';
                        modelProgressText.textContent = `Baixando modelo: ${Math.round(percent)}%`;
                    } else if (progress.status === 'loading') {
                        modelProgressText.textContent = 'Carregando modelo na memória...';
                    }
                }
            }
        );

        modelReady = true;
        modelProgress.hidden = true;
        updateModelStatus('ready', '✅', 'Modelo pronto! Selecione um áudio.');
        updateTranscribeButton();

    } catch (error) {
        console.error('Erro ao carregar modelo:', error);
        updateModelStatus('error', '❌', 'Erro ao carregar modelo. Recarregue a página.');
    }
}

function updateModelStatus(status, icon, text) {
    modelStatus.className = 'model-status ' + status;
    modelStatus.innerHTML = `
        <span class="status-icon">${icon}</span>
        <span class="status-text">${text}</span>
    `;
}

// Iniciar carregamento do modelo
initModel();

// ==========================================
// UPLOAD DE ARQUIVO
// ==========================================

uploadArea.addEventListener('click', () => audioInput.click());

uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('dragover');
});

uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('dragover');
});

uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');

    const file = e.dataTransfer.files[0];
    if (file && (file.type.startsWith('audio/') || file.type.startsWith('video/'))) {
        handleFileSelect(file);
    }
});

audioInput.addEventListener('change', (e) => {
    if (e.target.files[0]) {
        handleFileSelect(e.target.files[0]);
    }
});

removeFile.addEventListener('click', () => {
    selectedFile = null;
    audioInput.value = '';
    fileInfo.hidden = true;
    uploadArea.hidden = false;
    updateTranscribeButton();
});

function handleFileSelect(file) {
    selectedFile = file;
    fileName.textContent = `✓ ${file.name} (${formatFileSize(file.size)})`;
    uploadArea.hidden = true;
    fileInfo.hidden = false;
    updateTranscribeButton();
}

function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// ==========================================
// BOTÃO TRANSCREVER
// ==========================================

function updateTranscribeButton() {
    transcribeBtn.disabled = !selectedFile || !modelReady;
}

transcribeBtn.addEventListener('click', startTranscription);

// ==========================================
// TRANSCRIÇÃO
// ==========================================

async function startTranscription() {
    const minTime = parseFloat(minTimeInput.value) || 8;
    const maxTime = parseFloat(maxTimeInput.value) || 20;
    const maxChars = parseInt(maxCharsInput.value) || 42;
    const language = languageSelect.value;

    // Mostrar progresso
    transcribeBtn.disabled = true;
    progressSection.hidden = false;
    resultSection.hidden = true;

    try {
        updateProgress(5, 'Preparando áudio...');

        // Converter arquivo para formato adequado
        const audioData = await prepareAudio(selectedFile);

        updateProgress(20, 'Transcrevendo com Whisper...');

        // Transcrever com Whisper
        const result = await transcriber(audioData, {
            language: language,
            task: 'transcribe',
            return_timestamps: true,
            chunk_length_s: 30,
            stride_length_s: 5
        });

        updateProgress(70, 'Gerando legendas SRT...');

        // Gerar SRT customizado
        const srtContent = generateCustomSRT(result, minTime, maxTime, maxChars);

        updateProgress(100, 'Concluído!');

        // Mostrar resultado
        setTimeout(() => {
            showResult(srtContent, result);
        }, 500);

    } catch (error) {
        console.error('Erro:', error);
        updateProgress(0, `Erro: ${error.message}`);
        progressFill.style.background = '#ef4444';

        setTimeout(() => {
            progressSection.hidden = true;
            transcribeBtn.disabled = false;
        }, 3000);
    }
}

async function prepareAudio(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const audioContext = new (window.AudioContext || window.webkitAudioContext)({
                    sampleRate: 16000 // Whisper espera 16kHz
                });

                const arrayBuffer = e.target.result;
                const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

                // Converter para mono e extrair dados
                const audioData = audioBuffer.getChannelData(0);

                // Converter Float32Array para array normal
                resolve(Array.from(audioData));

            } catch (err) {
                reject(new Error('Não foi possível processar o áudio. Tente outro formato.'));
            }
        };
        reader.onerror = () => reject(new Error('Erro ao ler arquivo'));
        reader.readAsArrayBuffer(file);
    });
}

function updateProgress(percent, text) {
    progressFill.style.width = percent + '%';
    progressText.textContent = text;
}

// ==========================================
// GERADOR DE SRT CUSTOMIZADO
// ==========================================

function generateCustomSRT(transcription, minTime, maxTime, maxChars) {
    // Whisper retorna { text: "...", chunks: [{text, timestamp: [start, end]}, ...] }
    const chunks = transcription.chunks || [];

    if (chunks.length === 0 && transcription.text) {
        // Se não tem chunks, criar um único bloco
        return `1\n00:00:00,000 --> 00:00:${minTime.toString().padStart(2, '0')},000\n${transcription.text}\n`;
    }

    const blocks = [];
    let currentBlock = {
        text: '',
        start: chunks[0]?.timestamp?.[0] || 0,
        end: 0
    };

    for (const chunk of chunks) {
        const chunkStart = chunk.timestamp?.[0] || 0;
        const chunkEnd = chunk.timestamp?.[1] || chunkStart + 2;
        const chunkText = chunk.text?.trim() || '';

        if (!chunkText) continue;

        const currentDuration = currentBlock.end - currentBlock.start;
        const wouldBeDuration = chunkEnd - currentBlock.start;
        const combinedText = currentBlock.text + (currentBlock.text ? ' ' : '') + chunkText;

        // Verificar se deve criar novo bloco
        const shouldSplit =
            wouldBeDuration > maxTime ||
            combinedText.length > maxChars * 2 ||
            (currentDuration >= minTime && wouldBeDuration > minTime);

        if (shouldSplit && currentBlock.text) {
            // Garantir tempo mínimo
            if (currentBlock.end - currentBlock.start < minTime) {
                currentBlock.end = currentBlock.start + minTime;
            }
            blocks.push({ ...currentBlock });

            currentBlock = {
                text: chunkText,
                start: chunkStart,
                end: chunkEnd
            };
        } else {
            currentBlock.text = combinedText;
            currentBlock.end = chunkEnd;
        }
    }

    // Adicionar último bloco
    if (currentBlock.text) {
        if (currentBlock.end - currentBlock.start < minTime) {
            currentBlock.end = currentBlock.start + minTime;
        }
        blocks.push(currentBlock);
    }

    // Converter para formato SRT
    return blocksToSRT(blocks, maxChars);
}

function blocksToSRT(blocks, maxChars) {
    let srt = '';

    blocks.forEach((block, index) => {
        // Quebrar texto em linhas se necessário
        const lines = wrapText(block.text, maxChars);

        srt += `${index + 1}\n`;
        srt += `${formatTimestamp(block.start)} --> ${formatTimestamp(block.end)}\n`;
        srt += `${lines.join('\n')}\n\n`;
    });

    return srt.trim();
}

function wrapText(text, maxChars) {
    const words = text.split(' ');
    const lines = [];
    let currentLine = '';

    for (const word of words) {
        if (currentLine.length + word.length + 1 <= maxChars) {
            currentLine += (currentLine ? ' ' : '') + word;
        } else {
            if (currentLine) lines.push(currentLine);
            currentLine = word;
        }
    }

    if (currentLine) lines.push(currentLine);

    // Máximo 2 linhas por bloco
    if (lines.length > 2) {
        const mid = Math.ceil(lines.length / 2);
        return [
            lines.slice(0, mid).join(' '),
            lines.slice(mid).join(' ')
        ];
    }

    return lines;
}

function formatTimestamp(seconds) {
    if (seconds === null || seconds === undefined || isNaN(seconds)) {
        seconds = 0;
    }

    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);

    return `${pad(h)}:${pad(m)}:${pad(s)},${pad(ms, 3)}`;
}

function pad(num, size = 2) {
    return num.toString().padStart(size, '0');
}

// ==========================================
// RESULTADOS
// ==========================================

function showResult(srtContent, transcription) {
    progressSection.hidden = true;
    resultSection.hidden = false;
    transcribeBtn.disabled = false;

    srtOutput.value = srtContent;

    // Calcular estatísticas
    const blocks = srtContent.split('\n\n').filter(b => b.trim());
    const fullText = transcription.text || '';
    const totalWords = fullText.split(/\s+/).filter(w => w).length;

    resultStats.innerHTML = `
        <strong>${blocks.length}</strong> blocos de legenda |
        <strong>${totalWords}</strong> palavras |
        <strong>${fullText.length}</strong> caracteres
    `;
}

// Copiar
copyBtn.addEventListener('click', async () => {
    try {
        await navigator.clipboard.writeText(srtOutput.value);
        copyBtn.textContent = '✓ Copiado!';
        setTimeout(() => copyBtn.textContent = '📋 Copiar', 2000);
    } catch (err) {
        srtOutput.select();
        document.execCommand('copy');
        copyBtn.textContent = '✓ Copiado!';
        setTimeout(() => copyBtn.textContent = '📋 Copiar', 2000);
    }
});

// Download
downloadBtn.addEventListener('click', () => {
    const blob = new Blob([srtOutput.value], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = (selectedFile?.name?.replace(/\.[^/.]+$/, '') || 'legenda') + '.srt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
});
