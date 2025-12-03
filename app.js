// ==========================================
// TRANSCRITOR INTELIGENTE - App Principal
// ==========================================

// Elementos do DOM
const uploadArea = document.getElementById('uploadArea');
const audioInput = document.getElementById('audioInput');
const fileInfo = document.getElementById('fileInfo');
const fileName = document.getElementById('fileName');
const removeFile = document.getElementById('removeFile');
const minTimeInput = document.getElementById('minTime');
const maxTimeInput = document.getElementById('maxTime');
const maxCharsInput = document.getElementById('maxChars');
const languageSelect = document.getElementById('language');
const apiKeyInput = document.getElementById('apiKey');
const toggleKey = document.getElementById('toggleKey');
const saveKeyCheckbox = document.getElementById('saveKey');
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

// ==========================================
// INICIALIZAÇÃO
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    // Carregar chave salva
    const savedKey = localStorage.getItem('hf_api_key');
    if (savedKey) {
        apiKeyInput.value = savedKey;
        saveKeyCheckbox.checked = true;
    }

    updateTranscribeButton();
});

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
// API KEY
// ==========================================

toggleKey.addEventListener('click', () => {
    if (apiKeyInput.type === 'password') {
        apiKeyInput.type = 'text';
        toggleKey.textContent = '🙈';
    } else {
        apiKeyInput.type = 'password';
        toggleKey.textContent = '👁️';
    }
});

apiKeyInput.addEventListener('input', () => {
    updateTranscribeButton();
    if (saveKeyCheckbox.checked) {
        localStorage.setItem('hf_api_key', apiKeyInput.value);
    }
});

saveKeyCheckbox.addEventListener('change', () => {
    if (saveKeyCheckbox.checked) {
        localStorage.setItem('hf_api_key', apiKeyInput.value);
    } else {
        localStorage.removeItem('hf_api_key');
    }
});

// ==========================================
// BOTÃO TRANSCREVER
// ==========================================

function updateTranscribeButton() {
    transcribeBtn.disabled = !selectedFile || !apiKeyInput.value.trim();
}

transcribeBtn.addEventListener('click', startTranscription);

// ==========================================
// TRANSCRIÇÃO
// ==========================================

async function startTranscription() {
    const apiKey = apiKeyInput.value.trim();
    const minTime = parseFloat(minTimeInput.value) || 8;
    const maxTime = parseFloat(maxTimeInput.value) || 20;
    const maxChars = parseInt(maxCharsInput.value) || 42;
    const language = languageSelect.value;

    // Mostrar progresso
    transcribeBtn.disabled = true;
    progressSection.hidden = false;
    resultSection.hidden = true;

    try {
        // Passo 1: Enviar áudio para API
        updateProgress(10, 'Enviando áudio para o servidor...');

        const transcription = await transcribeAudio(selectedFile, apiKey, language);

        updateProgress(60, 'Processando transcrição...');

        // Passo 2: Gerar SRT com configurações customizadas
        updateProgress(80, 'Gerando legendas SRT...');

        const srtContent = generateCustomSRT(transcription, minTime, maxTime, maxChars);

        updateProgress(100, 'Concluído!');

        // Mostrar resultado
        setTimeout(() => {
            showResult(srtContent, transcription);
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

async function transcribeAudio(file, apiKey, language) {
    // Para áudios longos (> 25MB ou > 30min), dividir em partes
    const MAX_SIZE = 24 * 1024 * 1024; // 24MB limite da API

    if (file.size > MAX_SIZE) {
        return await transcribeLongAudio(file, apiKey, language);
    }

    return await transcribeChunk(file, apiKey, language);
}

async function transcribeChunk(file, apiKey, language) {
    const API_URL = 'https://api-inference.huggingface.co/models/openai/whisper-large-v3';

    const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': file.type || 'audio/mpeg'
        },
        body: file
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));

        if (response.status === 401) {
            throw new Error('Chave API inválida. Verifique sua chave do Hugging Face.');
        }
        if (response.status === 503) {
            // Modelo está carregando, aguardar e tentar novamente
            updateProgress(15, 'Modelo carregando... aguardando 20s...');
            await sleep(20000);
            return await transcribeChunk(file, apiKey, language);
        }

        throw new Error(errorData.error || `Erro na API: ${response.status}`);
    }

    const result = await response.json();
    return result;
}

async function transcribeLongAudio(file, apiKey, language) {
    updateProgress(5, 'Áudio longo detectado. Preparando divisão...');

    // Criar AudioContext para processar o áudio
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const arrayBuffer = await file.arrayBuffer();

    updateProgress(10, 'Decodificando áudio...');
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    // Dividir em chunks de ~10 minutos (600 segundos)
    const CHUNK_DURATION = 600; // 10 minutos por chunk
    const sampleRate = audioBuffer.sampleRate;
    const totalDuration = audioBuffer.duration;
    const numChunks = Math.ceil(totalDuration / CHUNK_DURATION);

    updateProgress(15, `Dividindo em ${numChunks} partes...`);

    const allChunks = [];
    let timeOffset = 0;

    for (let i = 0; i < numChunks; i++) {
        const startTime = i * CHUNK_DURATION;
        const endTime = Math.min((i + 1) * CHUNK_DURATION, totalDuration);
        const chunkDuration = endTime - startTime;

        updateProgress(
            15 + (i / numChunks) * 70,
            `Transcrevendo parte ${i + 1} de ${numChunks}...`
        );

        // Extrair chunk do áudio
        const chunkBuffer = extractAudioChunk(audioBuffer, startTime, endTime, audioContext);
        const chunkBlob = await audioBufferToWav(chunkBuffer);

        // Transcrever chunk
        try {
            const result = await transcribeChunk(chunkBlob, apiKey, language);

            // Ajustar timestamps com offset
            if (result.chunks) {
                for (const chunk of result.chunks) {
                    if (chunk.timestamp) {
                        chunk.timestamp[0] += timeOffset;
                        chunk.timestamp[1] += timeOffset;
                    }
                    allChunks.push(chunk);
                }
            } else if (result.text) {
                // Se não tem chunks, criar um artificial
                allChunks.push({
                    text: result.text,
                    timestamp: [timeOffset, timeOffset + chunkDuration]
                });
            }

            timeOffset = endTime;
        } catch (error) {
            console.error(`Erro no chunk ${i + 1}:`, error);
            // Continuar com próximo chunk
            timeOffset = endTime;
        }
    }

    // Combinar todos os textos
    const fullText = allChunks.map(c => c.text).join(' ');

    return {
        text: fullText,
        chunks: allChunks
    };
}

function extractAudioChunk(audioBuffer, startTime, endTime, audioContext) {
    const sampleRate = audioBuffer.sampleRate;
    const startSample = Math.floor(startTime * sampleRate);
    const endSample = Math.floor(endTime * sampleRate);
    const frameCount = endSample - startSample;

    const chunkBuffer = audioContext.createBuffer(
        audioBuffer.numberOfChannels,
        frameCount,
        sampleRate
    );

    for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
        const sourceData = audioBuffer.getChannelData(channel);
        const targetData = chunkBuffer.getChannelData(channel);

        for (let i = 0; i < frameCount; i++) {
            targetData[i] = sourceData[startSample + i];
        }
    }

    return chunkBuffer;
}

async function audioBufferToWav(audioBuffer) {
    const numChannels = audioBuffer.numberOfChannels;
    const sampleRate = audioBuffer.sampleRate;
    const format = 1; // PCM
    const bitDepth = 16;

    const bytesPerSample = bitDepth / 8;
    const blockAlign = numChannels * bytesPerSample;

    const samples = audioBuffer.length;
    const dataSize = samples * blockAlign;
    const bufferSize = 44 + dataSize;

    const buffer = new ArrayBuffer(bufferSize);
    const view = new DataView(buffer);

    // WAV Header
    writeString(view, 0, 'RIFF');
    view.setUint32(4, bufferSize - 8, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, format, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitDepth, true);
    writeString(view, 36, 'data');
    view.setUint32(40, dataSize, true);

    // Interleave channels and write samples
    const offset = 44;
    const channelData = [];
    for (let i = 0; i < numChannels; i++) {
        channelData.push(audioBuffer.getChannelData(i));
    }

    let pos = offset;
    for (let i = 0; i < samples; i++) {
        for (let ch = 0; ch < numChannels; ch++) {
            const sample = Math.max(-1, Math.min(1, channelData[ch][i]));
            const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
            view.setInt16(pos, intSample, true);
            pos += 2;
        }
    }

    return new Blob([buffer], { type: 'audio/wav' });
}

function writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
    }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function updateProgress(percent, text) {
    progressFill.style.width = percent + '%';
    progressText.textContent = text;
}

// ==========================================
// GERADOR DE SRT CUSTOMIZADO
// ==========================================

function generateCustomSRT(transcription, minTime, maxTime, maxChars) {
    // Se a API retornou chunks com timestamps, usar eles
    if (transcription.chunks && transcription.chunks.length > 0) {
        return generateSRTFromChunks(transcription.chunks, minTime, maxTime, maxChars);
    }

    // Se só temos texto simples, criar blocos estimados
    return generateSRTFromText(transcription.text, minTime, maxTime, maxChars);
}

function generateSRTFromChunks(chunks, minTime, maxTime, maxChars) {
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

function generateSRTFromText(text, minTime, maxTime, maxChars) {
    // Dividir texto em sentenças
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    const blocks = [];

    let currentTime = 0;
    let currentBlock = { text: '', start: 0, end: 0 };

    for (const sentence of sentences) {
        const trimmed = sentence.trim();
        if (!trimmed) continue;

        // Estimar duração baseada no número de palavras (~150 palavras/minuto)
        const words = trimmed.split(/\s+/).length;
        const estimatedDuration = Math.max(minTime, (words / 150) * 60);

        const combinedText = currentBlock.text + (currentBlock.text ? ' ' : '') + trimmed;
        const wouldBeDuration = (currentBlock.end - currentBlock.start) + estimatedDuration;

        if (wouldBeDuration > maxTime && currentBlock.text) {
            blocks.push({ ...currentBlock });
            currentBlock = {
                text: trimmed,
                start: currentBlock.end,
                end: currentBlock.end + Math.min(estimatedDuration, maxTime)
            };
        } else {
            if (!currentBlock.text) {
                currentBlock.start = currentTime;
            }
            currentBlock.text = combinedText;
            currentBlock.end = currentBlock.start + Math.max(minTime, wouldBeDuration);
        }

        currentTime = currentBlock.end;
    }

    if (currentBlock.text) {
        blocks.push(currentBlock);
    }

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
    const totalChars = transcription.text?.length || 0;
    const totalWords = transcription.text?.split(/\s+/).length || 0;

    resultStats.innerHTML = `
        <strong>${blocks.length}</strong> blocos de legenda |
        <strong>${totalWords}</strong> palavras |
        <strong>${totalChars}</strong> caracteres
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
