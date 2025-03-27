document.addEventListener('DOMContentLoaded', () => {
    const startTestButton = document.getElementById('start-test');
    const outputsContainer = document.getElementById('outputs-container');
    const responseTemplate = document.getElementById('response-template');
    const presetPromptsSelect = document.getElementById('preset-prompts');
    
    // Track active requests
    const activeRequests = new Map();
    let requestCounter = 0;

    startTestButton.addEventListener('click', startConcurrentTests);

    // Helper function to get all questions from the dropdown
    function getAllQuestions() {
        const questions = [];
        for (let i = 1; i < presetPromptsSelect.options.length; i++) {
            questions.push(presetPromptsSelect.options[i].value);
        }
        return questions;
    }

    // Helper function to get a random question
    function getRandomQuestion() {
        const questions = getAllQuestions();
        if (questions.length === 0) {
            return "用简单的语言解释量子计算"; // Fallback if no questions are found
        }
        const randomIndex = Math.floor(Math.random() * questions.length);
        return questions[randomIndex];
    }

    function startConcurrentTests() {
        const concurrentCount = parseInt(document.getElementById('concurrent-requests').value, 10);
        
        // Clear existing outputs if needed
        if (confirm('清除现有输出？')) {
            outputsContainer.innerHTML = '';
            activeRequests.forEach((controller) => controller.abort());
            activeRequests.clear();
            requestCounter = 0;
        }
        
        // Start the specified number of concurrent requests with random questions
        for (let i = 0; i < concurrentCount; i++) {
            const randomPrompt = getRandomQuestion();
            createNewRequest(randomPrompt);
        }
    }

    function createNewRequest(prompt) {
        requestCounter++;
        const responseId = `response-${Date.now()}-${requestCounter}`;
        
        // Clone the template
        const responseWindow = document.importNode(responseTemplate.content, true).querySelector('.response-window');
        responseWindow.id = responseId;
        responseWindow.querySelector('.response-number').textContent = `请求 #${requestCounter}`;
        
        // Add question content to the question area (limit to 200 characters for display)
        const questionElement = responseWindow.querySelector('.question-content');
        const displayPrompt = prompt.length > 200 ? prompt.substring(0, 197) + '...' : prompt;
        questionElement.textContent = `问题: ${displayPrompt}`;
        
        // Store the full prompt as a data attribute for reference
        questionElement.dataset.fullPrompt = prompt;
        questionElement.dataset.expanded = 'false';
        
        // Add click handler to toggle between shortened and full question
        if (prompt.length > 200) {
            questionElement.style.cursor = 'pointer';
            questionElement.title = '点击展开/折叠完整问题';
            
            questionElement.addEventListener('click', function() {
                const isExpanded = this.dataset.expanded === 'true';
                if (isExpanded) {
                    this.textContent = `问题: ${displayPrompt}`;
                    this.dataset.expanded = 'false';
                } else {
                    this.textContent = `问题: ${prompt}`;
                    this.dataset.expanded = 'true';
                }
            });
        }
        
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
        const tokensInfoElement = responseWindow.querySelector('.tokens-info');
        const totalTokensElement = responseWindow.querySelector('.total-tokens');
        const tokensPerSecondElement = responseWindow.querySelector('.tokens-per-second');
        
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
        
        // Track time and tokens
        const startTime = Date.now();
        let totalTokens = 0;
        
        const timeInterval = setInterval(() => {
            const elapsedSeconds = ((Date.now() - startTime) / 1000).toFixed(1);
            responseTime.textContent = `${elapsedSeconds}s`;
            
            // Update tokens per second if we have tokens
            if (totalTokens > 0) {
                const elapsedSecondsNum = parseFloat(elapsedSeconds);
                const tokensPerSecond = (totalTokens / elapsedSecondsNum).toFixed(1);
                tokensPerSecondElement.textContent = tokensPerSecond;
            }
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
                                    // Increment token count - roughly estimate tokens as words
                                    totalTokens += estimateTokens(textChunk);
                                } else if (data.choices[0].delta && data.choices[0].delta.content) {
                                    textChunk = data.choices[0].delta.content;
                                    // Increment token count - roughly estimate tokens as words
                                    totalTokens += estimateTokens(textChunk);
                                }
                            }
                            
                            if (textChunk) {
                                responseText += textChunk;
                                responseContent.textContent = responseText;
                                responseContent.scrollTop = responseContent.scrollHeight;
                                
                                // Show tokens information
                                tokensInfoElement.classList.remove('hidden');
                                totalTokensElement.textContent = totalTokens;
                            }
                        } catch (parseError) {
                            // If we can't parse as JSON, just append the raw text
                            responseText += line;
                            responseContent.textContent = responseText;
                            
                            // Roughly estimate tokens
                            totalTokens += estimateTokens(line);
                            tokensInfoElement.classList.remove('hidden');
                            totalTokensElement.textContent = totalTokens;
                        }
                    }
                } catch (err) {
                    // Fallback for any parsing error - display raw chunk
                    responseText += chunk;
                    responseContent.textContent = responseText;
                    
                    // Roughly estimate tokens
                    totalTokens += estimateTokens(chunk);
                    tokensInfoElement.classList.remove('hidden');
                    totalTokensElement.textContent = totalTokens;
                }
            }
            
            // Complete
            updateStatus(statusElement, 'finished');
            responseContent.classList.remove('typing-animation');
            
            // Final token rate calculation
            const elapsedSeconds = (Date.now() - startTime) / 1000;
            const tokensPerSecond = (totalTokens / elapsedSeconds).toFixed(1);
            tokensPerSecondElement.textContent = tokensPerSecond;
        } catch (error) {
            if (error.name === 'AbortError') {
                updateStatus(statusElement, 'error');
                responseContent.textContent = '请求已中止';
            } else {
                updateStatus(statusElement, 'error');
                responseContent.textContent = `错误: ${error.message}`;
                console.error('Streaming error:', error);
            }
            responseContent.classList.remove('typing-animation');
        } finally {
            clearInterval(timeInterval);
            activeRequests.delete(responseId);
        }
    }

    // Helper function to estimate tokens from text
    // This is a rough approximation - actual token count depends on the tokenizer
    function estimateTokens(text) {
        if (!text) return 0;
        
        // Count Chinese characters (each roughly counts as one token)
        const chineseCharCount = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
        
        // Count non-Chinese words (each roughly counts as one token)
        const nonChineseText = text.replace(/[\u4e00-\u9fa5]/g, '');
        const nonChineseWords = nonChineseText.trim().split(/[\s,.!?;:"'-]+/).filter(word => word.length > 0);
        const nonChineseWordCount = nonChineseWords.length;
        
        // Sum of Chinese characters and non-Chinese words as token estimate
        return chineseCharCount + nonChineseWordCount || 1; // Return at least 1 if there's any text
    }

    function updateStatus(statusElement, status) {
        statusElement.className = `response-status text-xs px-2 py-1 rounded-full status-${status}`;
        
        switch (status) {
            case 'waiting':
                statusElement.textContent = '等待中';
                break;
            case 'loading':
                statusElement.textContent = '连接中...';
                break;
            case 'streaming':
                statusElement.textContent = '流式接收中';
                break;
            case 'finished':
                statusElement.textContent = '已完成';
                break;
            case 'error':
                statusElement.textContent = '错误';
                break;
        }
    }
}); 