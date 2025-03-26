document.addEventListener('DOMContentLoaded', () => {
    const chatMessages = document.getElementById('chatMessages');
    const messageInput = document.getElementById('messageInput');
    const sendBtn = document.getElementById('sendBtn');
    const loadingIndicator = document.getElementById('loading');
    const fileInput = document.getElementById('pdf-upload');
    const uploadBtn = document.getElementById('upload-btn');
    const uploadStatus = document.getElementById('upload-status');

    // Handle Enter key for sending messages
    messageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    // Handle Send button click
    sendBtn.addEventListener('click', sendMessage);

    // Handle PDF upload button click
    uploadBtn.addEventListener('click', uploadPDF);

    async function sendMessage() {
        const message = messageInput.value.trim();
        if (!message) return;

        addMessage(message, 'user');
        messageInput.value = '';
        loadingIndicator.style.display = 'block';

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message })
            });

            if (!response.ok) {
                throw new Error(`Server error: ${response.status}`);
            }

            const data = await response.json();
            addMessage(data?.response || "I'm not sure how to respond to that.", 'bot');
        } catch (error) {
            addMessage('Error: Unable to process request.', 'bot');
            console.error('Chat Error:', error);
        } finally {
            loadingIndicator.style.display = 'none';
        }
    }

    function addMessage(text, sender) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', `${sender}-message`);
        messageDiv.textContent = text;

        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    async function uploadPDF() {
        if (!fileInput.files[0]) {
            uploadStatus.textContent = 'Please select a PDF file first!';
            return;
        }

        uploadStatus.textContent = 'Uploading and processing PDF...';

        try {
            const formData = new FormData();
            formData.append('file', fileInput.files[0]);

            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error(`Upload failed: ${response.status}`);
            }

            const result = await response.json();

            if (result.success) {
                uploadStatus.textContent = `PDF processed successfully! Pages: ${result.pages}, Chunks: ${result.chunks}`;
            } else {
                uploadStatus.textContent = 'Upload failed: ' + (result.error || 'Unknown error');
            }
        } catch (error) {
            uploadStatus.textContent = 'Upload failed: ' + error.message;
            console.error('PDF Upload Error:', error);
        }
    }
});
