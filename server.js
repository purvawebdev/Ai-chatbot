require('dotenv').config();
const express = require('express');
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

let vectorStore;

// API Endpoints
app.post('/api/initialize', async (req, res) => {
    try {
        // Validate input
        if (!req.body.documents || !Array.isArray(req.body.documents)) {
            return res.status(400).json({ error: 'Documents array required' });
        }

        // Create documents with metadata
        const docs = req.body.documents.map(text =>
            new Document({
                pageContent: text,
                metadata: { source: 'user' }
            })
        );

        // Process documents
        const processedDocs = await textSplitter.splitDocuments(docs);
        console.log('Processed', processedDocs.length, 'document chunks');

        // Create and save FAISS index
        vectorStore = await FaissStore.fromDocuments(processedDocs, embeddings);
        await vectorStore.save('./faiss_store');
        console.log('FAISS index saved');

        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Initialization error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/chat', async (req, res) => {
    try {
        const { message } = req.body;

        // Validate input
        if (!message || typeof message !== 'string') {
            return res.status(400).json({ error: 'Message string required' });
        }

        // Load index if not loaded
        if (!vectorStore) {
            try {
                vectorStore = await FaissStore.load('./faiss_store', embeddings);
                console.log('Loaded FAISS index from disk');
            } catch (error) {
                console.error('Error loading FAISS index:', error);
                return res.status(500).json({ error: 'Failed to load vector store' });
            }
        }

        // Get relevant documents
        const relevantDocs = await vectorStore.similaritySearch(message, 3);
        console.log('Found', relevantDocs.length, 'relevant documents');

        // Create context
        const context = relevantDocs.map(doc => doc.pageContent).join('\n\n');

        // Generate response
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));