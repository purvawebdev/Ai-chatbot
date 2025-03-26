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
const { ChatOllama } = require('@langchain/community/chat_models/ollama');

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

const llm = new ChatOllama({
    baseUrl: 'http://localhost:11434',
    model: 'mistral'
});

const upload = multer({ dest: 'uploads/' });
let vectorStore;

// **Load or Create Vector Store**
async function loadVectorStore() {
    if (!vectorStore) {
        try {
            vectorStore = await FaissStore.load('./faiss_store', embeddings);
            console.log('FAISS index loaded.');
        } catch (error) {
            console.warn('FAISS index not found, initializing new store.');
            vectorStore = new FaissStore(embeddings);
        }
    }
}

//  **Process PDF Files**
async function processPDF(filePath) {
    try {
        const dataBuffer = fs.readFileSync(filePath);
        const data = await pdf(dataBuffer);
        return data.text.split('\f').map(page => page.trim()); // Split by page
    } catch (error) {
        throw new Error(`PDF processing failed: ${error.message}`);
    }
}

//  **Initialize Vector Store with Documents**
app.post('/api/initialize', async (req, res) => {
    try {
        if (!req.body.documents || !Array.isArray(req.body.documents)) {
            return res.status(400).json({ error: 'Documents array required' });
        }

        await loadVectorStore();

        const docs = req.body.documents.map(text =>
            new Document({ pageContent: text, metadata: { source: 'user' } })
        );

        const processedDocs = await textSplitter.splitDocuments(docs);
        await vectorStore.addDocuments(processedDocs);
        await vectorStore.save('./faiss_store');

        res.status(200).json({ success: true, chunks: processedDocs.length });
    } catch (error) {
        console.error('Initialization error:', error);
        res.status(500).json({ error: error.message });
    }
});

//  **Handle Chat Requests**
app.post('/api/chat', async (req, res) => {
    try {
        const { message } = req.body;
        if (!message || typeof message !== 'string') {
            return res.status(400).json({ error: 'Message string required' });
        }

        await loadVectorStore();

        const relevantDocs = await vectorStore.similaritySearch(message, 3);
        const context = relevantDocs.map(doc => doc.pageContent).join('\n\n');

        const response = await llm.invoke([
            ['system', `Answer based on this context:\n${context}`],
            ['user', message]
        ]);

        res.json({ response: response.content });
    } catch (error) {
        console.error('Chat error:', error);
        res.status(500).json({ error: 'Failed to process request' });
    }
});

//  **Handle PDF Upload & Processing**
app.post('/api/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const filePath = req.file.path;
        const fileType = path.extname(req.file.originalname).toLowerCase();

        if (fileType !== '.pdf') {
            fs.unlinkSync(filePath); // Delete unsupported file
            return res.status(400).json({ error: 'Only PDF files are supported' });
        }

        const content = await processPDF(filePath);

        await loadVectorStore();

        const newDocs = content.map(text =>
            new Document({
                pageContent: text,
                metadata: {
                    source: req.file.originalname,
                    type: 'pdf',
                    pages: content.length
                }
            })
        );

        const processedDocs = await textSplitter.splitDocuments(newDocs);
        await vectorStore.addDocuments(processedDocs);
        await vectorStore.save('./faiss_store');

        fs.unlinkSync(filePath); // Cleanup after processing
        res.json({
            success: true,
            pages: content.length,
            chunks: processedDocs.length
        });

    } catch (error) {
        fs.unlinkSync(req.file?.path);
        console.error('Upload error:', error);
        res.status(500).json({ error: error.message });
    }
});

//  **Start Server**
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
