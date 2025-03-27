document.addEventListener('DOMContentLoaded', () => {
    const startTestButton = document.getElementById('start-test');
    const outputsContainer = document.getElementById('outputs-container');
    const responseTemplate = document.getElementById('response-template');
    
    // Track active requests
    const activeRequests = new Map();
    let requestCounter = 0;

    startTestButton.addEventListener('click', startConcurrentTests);

    function startConcurrentTests() {
        const concurrentCount = parseInt(document.getElementById('concurrent-requests').value, 10);
        const prompt = document.getElementById('prompt-template').value;
        
        // Clear existing outputs if needed
        if (confirm('Clear existing outputs?')) {
            outputsContainer.innerHTML = '';
            activeRequests.forEach((controller) => controller.abort());
            activeRequests.clear();
            requestCounter = 0;
        }
        
        // Start the specified number of concurrent requests
        for (let i = 0; i < concurrentCount; i++) {
            createNewRequest(prompt);
        }
    }

    function createNewRequest(prompt) {
        requestCounter++;
        const responseId = `response-${Date.now()}-${requestCounter}`;
        
        // Clone the template
        const responseWindow = document.importNode(responseTemplate.content, true).querySelector('.response-window');
        responseWindow.id = responseId;
        responseWindow.querySelector('.response-number').textContent = `Request #${requestCounter}`;
        
        // Add to container
        outputsContainer.prepend(responseWindow);
        
        // Set up close button
        const closeBtn = responseWindow.querySelector('.close-btn');
        closeBtn.addEventListener('click', () => {
            if (activeRequests.has(responseId)) {
                const controller = activeRequests.get(responseId);
                controller.abort();
                activeRequests.delete(responseId);
            }
            responseWindow.remove();
        });
        
        // Start the streaming request
        streamLLMResponse(responseId, prompt);
    }

    async function streamLLMResponse(responseId, prompt) {
        const responseWindow = document.getElementById(responseId);
        const statusElement = responseWindow.querySelector('.response-status');
        const responseContent = responseWindow.querySelector('.response-content');
        const responseTime = responseWindow.querySelector('.response-time');
        
        const endpointUrl = document.getElementById('endpoint-url').value;
        const modelName = document.getElementById('model-name').value;
        const maxTokens = parseInt(document.getElementById('max-tokens').value, 10);
        const temperature = parseFloat(document.getElementById('temperature').value);
        
        // Update status
        updateStatus(statusElement, 'loading');
        responseContent.classList.add('typing-animation');
        
        // Create AbortController for this request
        const controller = new AbortController();
        activeRequests.set(responseId, controller);
        
        // Track time
        const startTime = Date.now();
        const timeInterval = setInterval(() => {
            const elapsedSeconds = ((Date.now() - startTime) / 1000).toFixed(1);
            responseTime.textContent = `${elapsedSeconds}s`;
        }, 100);
        
        try {
            const payload = {
                model: modelName,
                prompt: prompt,
                max_tokens: maxTokens,
                temperature: temperature,
                stream: true // Enable streaming
            };
            
            const response = await fetch(endpointUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload),
                signal: controller.signal
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            
            if (!response.body) {
                throw new Error('ReadableStream not supported in this browser.');
            }
            
            updateStatus(statusElement, 'streaming');
            
            // Set up streaming
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let responseText = '';
            
            while (true) {
                const { done, value } = await reader.read();
                
                if (done) {
                    break;
                }
                
                // Decode the stream chunk
                const chunk = decoder.decode(value, { stream: true });
                
                // Handle chunk based on OpenAI-like streaming format
                try {
                    // Process the chunk - assuming JSON lines format
                    const lines = chunk.split('\n').filter(line => line.trim() !== '');
                    
                    for (const line of lines) {
                        if (line.trim() === 'data: [DONE]') continue;
                        
                        // Remove the "data: " prefix if it exists
                        const jsonStr = line.startsWith('data: ') ? line.slice(6) : line;
                        
                        try {
                            const data = JSON.parse(jsonStr);
                            // Extract text based on different API formats
                            let textChunk = '';
                            
                            if (data.choices && data.choices[0]) {
                                if (data.choices[0].text) {
                                    textChunk = data.choices[0].text;
                                } else if (data.choices[0].delta && data.choices[0].delta.content) {
                                    textChunk = data.choices[0].delta.content;
                                }
                            }
                            
                            if (textChunk) {
                                responseText += textChunk;
                                responseContent.textContent = responseText;
                                responseContent.scrollTop = responseContent.scrollHeight;
                            }
                        } catch (parseError) {
                            // If we can't parse as JSON, just append the raw text
                            responseText += line;
                            responseContent.textContent = responseText;
                        }
                    }
                } catch (err) {
                    // Fallback for any parsing error - display raw chunk
                    responseText += chunk;
                    responseContent.textContent = responseText;
                }
            }
            
            // Complete
            updateStatus(statusElement, 'finished');
            responseContent.classList.remove('typing-animation');
        } catch (error) {
            if (error.name === 'AbortError') {
                updateStatus(statusElement, 'error');
                responseContent.textContent = 'Request aborted';
            } else {
                updateStatus(statusElement, 'error');
                responseContent.textContent = `Error: ${error.message}`;
                console.error('Streaming error:', error);
            }
            responseContent.classList.remove('typing-animation');
        } finally {
            clearInterval(timeInterval);
            activeRequests.delete(responseId);
        }
    }

    function updateStatus(statusElement, status) {
        statusElement.className = `response-status text-xs px-2 py-1 rounded-full status-${status}`;
        
        switch (status) {
            case 'waiting':
                statusElement.textContent = 'Waiting';
                break;
            case 'loading':
                statusElement.textContent = 'Connecting...';
                break;
            case 'streaming':
                statusElement.textContent = 'Streaming';
                break;
            case 'finished':
                statusElement.textContent = 'Completed';
                break;
            case 'error':
                statusElement.textContent = 'Error';
                break;
        }
    }
}); 