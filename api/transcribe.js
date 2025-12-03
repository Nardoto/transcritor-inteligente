export const config = {
    api: {
        bodyParser: {
            sizeLimit: '50mb'
        }
    }
};

export default async function handler(req, res) {
    // Permitir CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { audio, apiKey } = req.body;

        if (!audio || !apiKey) {
            return res.status(400).json({ error: 'Missing audio or apiKey' });
        }

        const API_URL = 'https://api-inference.huggingface.co/models/openai/whisper-small';

        // Converter base64 para buffer
        const audioBuffer = Buffer.from(audio, 'base64');

        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'audio/mpeg'
            },
            body: audioBuffer
        });

        const data = await response.json();

        if (!response.ok) {
            return res.status(response.status).json(data);
        }

        return res.status(200).json(data);

    } catch (error) {
        console.error('Transcription error:', error);
        return res.status(500).json({ error: error.message });
    }
}
