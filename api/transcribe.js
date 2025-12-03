const formidable = require('formidable');
const fs = require('fs');

module.exports = async function handler(req, res) {
    // Permitir CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-Key');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // Parse form data
        const form = formidable({ maxFileSize: 50 * 1024 * 1024 }); // 50MB

        const [fields, files] = await new Promise((resolve, reject) => {
            form.parse(req, (err, fields, files) => {
                if (err) reject(err);
                else resolve([fields, files]);
            });
        });

        const apiKey = fields.apiKey?.[0] || fields.apiKey;
        const audioFile = files.audio?.[0] || files.audio;

        if (!audioFile || !apiKey) {
            return res.status(400).json({ error: 'Missing audio file or apiKey' });
        }

        // Ler o arquivo
        const audioBuffer = fs.readFileSync(audioFile.filepath);

        const API_URL = 'https://api-inference.huggingface.co/models/openai/whisper-small';

        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': audioFile.mimetype || 'audio/mpeg'
            },
            body: audioBuffer
        });

        const data = await response.json();

        // Limpar arquivo temporário
        fs.unlinkSync(audioFile.filepath);

        if (!response.ok) {
            return res.status(response.status).json(data);
        }

        return res.status(200).json(data);

    } catch (error) {
        console.error('Transcription error:', error);
        return res.status(500).json({ error: error.message });
    }
};

module.exports.config = {
    api: {
        bodyParser: false // Importante: desabilitar bodyParser padrão
    }
};
