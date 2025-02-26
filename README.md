# RAG-Powered Q&A System with Document Intelligence 🧠📚

A Retrieval-Augmented Generation (RAG) system that enables natural language queries over custom documents using LangChain, FAISS, and Mistral-7B.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
![Node Version](https://img.shields.io/badge/node-%3E%3D18.0-blue)
![LangChain Version](https://img.shields.io/badge/langchain-0.1.0-red)

## Features ✨
- Document ingestion from text, CSV, and JSON files
- FAISS vector store for efficient similarity search
- Conversation history with session management
- File upload API endpoint
- Ollama integration for local LLM inference
- Metadata tracking for documents

## Tech Stack 🛠️
- **LangChain** - AI orchestration
- **FAISS** - Vector similarity search
- **Ollama** - Local LLM (Mistral-7B)
- **Hugging Face** - Sentence embeddings
- **Express.js** - API server

## Installation 💻

### Prerequisites
- Node.js ≥18.x
- Python 3.8+ (for Hugging Face embeddings)
- [Ollama](https://ollama.ai/) running locally

```bash
# Clone repository
git clone https://github.com/yourusername/rag-qa-system.git
cd rag-qa-system

# Install dependencies
npm install

# Start Ollama service (in separate terminal)
ollama serve
```

## Configuration ⚙️
Create .env file:
```bash
PORT=3000
FAISS_STORE_PATH=./faiss_store
EMBEDDING_MODEL=Xenova/all-MiniLM-L6-v2
```
Usage 🚀
1. Start Server
```bash
npm start
```
3. Initialize Documents
 ```bash
curl -X POST http://localhost:3000/api/initialize \
     -H "Content-Type: application/json" \
     -d '{"documents": ["Your document text here..."]}'
```
5. Query Documents
```bash
curl -X POST http://localhost:3000/api/chat \
     -H "Content-Type: application/json" \
     -d '{"message": "What is Skynet?"}
```  
5.API Reference 📚

```bash
#Endpoint	Method	Description
/api/initialize	POST	Initialize document store
/api/chat	POST	Submit natural language query
```
6.Troubleshooting 🔧
Common Issues:
# Connection refused
Ensure Ollama is running: ollama serve

# Missing dependencies
npm install express @langchain/community @langchain/core langchain multer csv-parser dotenv @xenova/transformers

# FAISS load errors
Delete the faiss_store folder and reinitialize


![Screenshot 2025-02-27 013117](https://github.com/user-attachments/assets/e9e3b627-82f7-46ae-b93a-cfad353726db)


