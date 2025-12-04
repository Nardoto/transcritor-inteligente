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
const languageGroup = document.getElementById('languageGroup');
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
const textSection = document.getElementById('textSection');
const originalText = document.getElementById('originalText');
const modeRadios = document.querySelectorAll('input[name="mode"]');
const apiSection = document.querySelector('.api-section');

// Estado do app
let selectedFile = null;
let currentMode = 'transcribe';

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

    // Event listeners para mudanca de modo
    modeRadios.forEach(radio => {
        radio.addEventListener('change', handleModeChange);
    });

    updateTranscribeButton();
});

// ==========================================
// MODO DE OPERACAO
// ==========================================

function handleModeChange(e) {
    currentMode = e.target.value;

    if (currentMode === 'align') {
        // Modo alinhamento: mostrar campo de texto, esconder API key e idioma
        textSection.hidden = false;
        apiSection.hidden = true;
        languageGroup.hidden = true;
        transcribeBtn.textContent = 'GERAR LEGENDAS';
    } else {
        // Modo transcrever: esconder campo de texto, mostrar API key e idioma
        textSection.hidden = true;
        apiSection.hidden = false;
        languageGroup.hidden = false;
        transcribeBtn.textContent = 'TRANSCREVER';
    }

    updateTranscribeButton();
}

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
    if (currentMode === 'align') {
        // Modo alinhamento: precisa de arquivo e texto
        transcribeBtn.disabled = !selectedFile || !originalText.value.trim();
    } else {
        // Modo transcricao: precisa de arquivo e API key
        transcribeBtn.disabled = !selectedFile || !apiKeyInput.value.trim();
    }
}

// Atualizar botao quando texto muda
originalText.addEventListener('input', updateTranscribeButton);

transcribeBtn.addEventListener('click', startTranscription);

// ==========================================
// TRANSCRIÇÃO
// ==========================================

async function startTranscription() {
    const minTime = parseFloat(minTimeInput.value) || 8;
    const maxTime = parseFloat(maxTimeInput.value) || 20;
    const maxChars = parseInt(maxCharsInput.value) || 42;

    // Mostrar progresso
    transcribeBtn.disabled = true;
    progressSection.hidden = false;
    resultSection.hidden = true;
    progressFill.style.background = 'linear-gradient(90deg, #6366f1, #22c55e)';

    try {
        if (currentMode === 'align') {
            // Modo alinhamento forçado
            await startAlignment(minTime, maxTime, maxChars);
        } else {
            // Modo transcrição normal
            await startTranscriptionMode(minTime, maxTime, maxChars);
        }
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

async function startTranscriptionMode(minTime, maxTime, maxChars) {
    const apiKey = apiKeyInput.value.trim();
    const language = languageSelect.value;

    updateProgress(10, 'Enviando audio para transcricao...');

    const transcription = await transcribeAudio(selectedFile, apiKey, language);

    updateProgress(70, 'Gerando legendas SRT...');

    // Gerar SRT com configuracoes customizadas
    const srtContent = generateCustomSRT(transcription, minTime, maxTime, maxChars);

    updateProgress(100, 'Concluido!');

    // Mostrar resultado
    setTimeout(() => {
        showResult(srtContent, transcription);
    }, 500);
}

async function startAlignment(minTime, maxTime, maxChars) {
    const text = originalText.value.trim();

    updateProgress(10, 'Preparando audio...');

    // Converter audio para base64
    const audioBase64 = await fileToBase64(selectedFile);

    updateProgress(30, 'Enviando para alinhamento forcado...');

    // API do Gradio - precisa primeiro fazer upload do arquivo
    const SPACE_URL = 'https://nardoto-forced-aligner.hf.space';

    try {
        // Gradio Client API - fazer upload primeiro
        const uploadResponse = await fetch(`${SPACE_URL}/upload`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                files: [audioBase64]
            })
        });

        let audioPath = null;

        if (uploadResponse.ok) {
            const uploadResult = await uploadResponse.json();
            audioPath = uploadResult[0];
        }

        updateProgress(50, 'Gerando legendas...');

        // Chamar a funcao principal
        const response = await fetch(`${SPACE_URL}/call/forced_align`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                data: [
                    audioPath ? { path: audioPath } : { name: selectedFile.name, data: audioBase64 },
                    text,
                    minTime,
                    maxTime,
                    maxChars
                ]
            })
        });

        if (!response.ok) {
            if (response.status === 503) {
                updateProgress(40, 'Space carregando... aguarde (1-2 min primeira vez)...');
                await sleep(30000);
                return await startAlignment(minTime, maxTime, maxChars);
            }
            throw new Error(`Erro no Space: ${response.status}`);
        }

        const callResult = await response.json();
        const eventId = callResult.event_id;

        updateProgress(70, 'Processando resultado...');

        // Buscar resultado via SSE
        const resultResponse = await fetch(`${SPACE_URL}/call/forced_align/${eventId}`);
        const resultText = await resultResponse.text();

        // Parse SSE response
        const lines = resultText.split('\n');
        let srtContent = '';

        for (const line of lines) {
            if (line.startsWith('data: ')) {
                try {
                    const data = JSON.parse(line.substring(6));
                    if (data && data[0]) {
                        srtContent = data[0];
                    }
                } catch (e) {
                    // Ignorar linhas que nao sao JSON
                }
            }
        }

        if (!srtContent || srtContent.startsWith('Erro:')) {
            throw new Error(srtContent || 'Erro ao gerar legendas');
        }

        updateProgress(100, 'Concluido!');

        setTimeout(() => {
            showResultAlign(srtContent, text);
        }, 500);

    } catch (error) {
        // Fallback: gerar SRT localmente baseado no texto e duracao estimada
        console.warn('Erro no Space, usando fallback local:', error);
        updateProgress(60, 'Gerando legendas localmente...');

        const srtContent = generateLocalSRT(text, minTime, maxTime, maxChars);

        updateProgress(100, 'Concluido (modo local)!');

        setTimeout(() => {
            showResultAlign(srtContent, text);
        }, 500);
    }
}

// Gera SRT localmente quando o Space nao esta disponivel
function generateLocalSRT(text, minTime, maxTime, maxChars) {
    // Dividir texto em sentencas
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    const blocks = [];

    let currentTime = 0;
    let currentBlock = { text: '', start: 0, end: 0 };

    for (const sentence of sentences) {
        const trimmed = sentence.trim();
        if (!trimmed) continue;

        // Estimar duracao baseada no numero de palavras (~150 palavras/minuto)
        const words = trimmed.split(/\s+/).length;
        const estimatedDuration = Math.max(minTime, Math.min((words / 150) * 60, maxTime));

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
            currentBlock.end = currentBlock.start + Math.max(minTime, Math.min(wouldBeDuration, maxTime));
        }

        currentTime = currentBlock.end;
    }

    if (currentBlock.text) {
        blocks.push(currentBlock);
    }

    // Converter para SRT
    let srt = '';
    blocks.forEach((block, index) => {
        const lines = wrapText(block.text, maxChars);
        srt += `${index + 1}\n`;
        srt += `${formatTimestamp(block.start)} --> ${formatTimestamp(block.end)}\n`;
        srt += `${lines.join('\n')}\n\n`;
    });

    return srt.trim();
}

function showResultAlign(srtContent, text) {
    progressSection.hidden = true;
    resultSection.hidden = false;
    transcribeBtn.disabled = false;

    srtOutput.value = srtContent;

    // Calcular estatisticas
    const blocks = srtContent.split('\n\n').filter(b => b.trim());
    const totalChars = text.length;
    const totalWords = text.split(/\s+/).length;

    resultStats.innerHTML = `
        <strong>${blocks.length}</strong> blocos de legenda |
        <strong>${totalWords}</strong> palavras |
        <strong>${totalChars}</strong> caracteres
    `;
}

async function transcribeAudio(file, apiKey, language) {
    // Verificar tamanho do arquivo (máx 25MB)
    const MAX_SIZE = 25 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
        throw new Error('Arquivo muito grande. Máximo 25MB. Tente comprimir o áudio para MP3.');
    }

    // Usar nosso próprio proxy para evitar CORS
    const API_URL = '/api/transcribe';

    // Usar FormData para enviar arquivo (evita limite de 4.5MB do JSON)
    const formData = new FormData();
    formData.append('audio', file);
    formData.append('apiKey', apiKey);

    const response = await fetch(API_URL, {
        method: 'POST',
        body: formData
    });

    // Tratar erro 413 antes de tentar parse JSON
    if (response.status === 413) {
        throw new Error('Arquivo muito grande. Máximo 25MB. Tente comprimir o áudio.');
    }

    let result;
    try {
        result = await response.json();
    } catch (e) {
        const text = await response.text().catch(() => '');
        throw new Error(`Erro no servidor: ${response.status} - ${text.substring(0, 100)}`);
    }

    if (!response.ok) {
        if (response.status === 401) {
            throw new Error('Chave API inválida. Verifique sua chave do Hugging Face.');
        }
        if (response.status === 503) {
            updateProgress(15, 'Modelo carregando... aguardando (pode levar até 20s)...');
            await sleep(20000);
            return await transcribeAudio(file, apiKey, language);
        }
        if (response.status === 400) {
            throw new Error('Formato de áudio não suportado. Tente MP3 ou WAV.');
        }

        throw new Error(result.error?.message || result.error || `Erro na API: ${response.status}`);
    }

    return result;
}

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            // Remove o prefixo "data:audio/xxx;base64,"
            const base64 = reader.result.split(',')[1];
            resolve(base64);
        };
        reader.onerror = error => reject(error);
    });
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
