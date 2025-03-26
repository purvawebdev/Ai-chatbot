require('dotenv').config();
const express = require('express');
const multer = require('multer');
const pdf = require('pdf-parse');
const path = require('path');
const fs = require('fs');
const { FaissStore } = require('@langchain/community/vectorstores/faiss');
const { Document } = require('@langchain/core/documents');
const { RecursiveCharacterTextSplitter } = require('langchain/text_splitter');
const { HuggingFaceTransformersEmbeddings } = require('@langchain/community/embeddings/hf_transformers');

const app = express();
app.use(express.json());
app.use(express.static('public'));

// Initialize components
const textSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200
});

const embeddings = new HuggingFaceTransformersEmbeddings({
    modelName: 'Xenova/all-MiniLM-L6-v2'
});

const upload = multer({ dest: 'uploads/' });
let vectorStore;

// Improved vector store loading
async function loadVectorStore() {
    if (!vectorStore) {
        try {
            vectorStore = await FaissStore.load('./faiss_store', embeddings);
            console.log('FAISS index loaded');
        } catch (error) {
            console.warn('Initializing new FAISS store');
            vectorStore = await FaissStore.fromDocuments([], embeddings); // Initialize with empty docs
            await vectorStore.save('./faiss_store');
        }
    }
}

// Enhanced Gemini query function
async function queryGemini(message, context) {
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: `Context:\n${context}\n\nQuestion: ${message}\nAnswer:`
                    }]
                }]
            })
        });

        const data = await response.json();
        return data?.candidates?.[0]?.content?.parts?.[0]?.text || "No response from AI.";
    } catch (error) {
        console.error("Gemini API error:", error);
        return "Failed to fetch response.";
    }
}

// Unified document processing
async function processDocuments(content, metadata) {
    const newDocs = content.map(text =>
        new Document({
            pageContent: text,
            metadata: metadata
        })
    );

    const processedDocs = await textSplitter.splitDocuments(newDocs);
    await vectorStore.addDocuments(processedDocs);
    await vectorStore.save('./faiss_store');

    return processedDocs;
}

// API Endpoints
app.post('/api/initialize', async (req, res) => {
    try {
        if (!Array.isArray(req.body.documents)) {
            return res.status(400).json({ error: 'Documents array required' });
        }

        await loadVectorStore();

        const processed = await processDocuments(
            req.body.documents.map(d => typeof d === 'string' ? d : d.text),
            { source: 'user-provided' }
        );

        res.json({
            success: true,
            chunks: processed.length
        });
    } catch (error) {
        console.error('Initialization error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/chat', async (req, res) => {
    try {
        const { message } = req.body;
        if (!message || typeof message !== 'string') {
            return res.status(400).json({ error: 'Message string required' });
        }

        await loadVectorStore();
        const relevantDocs = await vectorStore.similaritySearch(message, 3);
        const context = relevantDocs.map(doc => doc.pageContent).join('\n\n');
        const response = await queryGemini(message, context);

        res.json({ response });
    } catch (error) {
        console.error('Chat error:', error);
        res.status(500).json({ error: 'Failed to process request' });
    }
});

app.post('/api/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

        const filePath = req.file.path;
        const ext = path.extname(req.file.originalname).toLowerCase();

        if (ext !== '.pdf') {
            fs.unlinkSync(filePath);
            return res.status(400).json({ error: 'Only PDF files are supported' });
        }

        const content = await pdf(fs.readFileSync(filePath));
        const textChunks = content.text.split('\n').filter(Boolean);

        await loadVectorStore();
        const processed = await processDocuments(textChunks, {
            source: req.file.originalname,
            type: 'pdf'
        });

        fs.unlinkSync(filePath);
        res.json({
            success: true,
            pages: textChunks.length,
            chunks: processed.length
        });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Server start
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));