const chatMessages = document.getElementById('chatMessages');
const messageInput = document.getElementById('messageInput');
const loadingIndicator = document.getElementById('loading');

// Handle Enter key
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

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

        if (!response.ok) throw new Error('Server error. Please try again.');

        const data = await response.json();
        addMessage(data.response || "Sorry, I didn't understand that.", 'bot');
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
