document.addEventListener('DOMContentLoaded', () => {
    console.log('页面加载完成，初始化流式测试工具...');
    
    const startTestButton = document.getElementById('start-test');
    const outputsContainer = document.getElementById('outputs-container');
    const responseTemplate = document.getElementById('response-template');
    const presetPromptsSelect = document.getElementById('preset-prompts');
    const showSummaryButton = document.getElementById('show-summary');
    const summaryModal = document.getElementById('summary-modal');
    const closeModalButton = document.getElementById('close-modal');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const exportCsvButton = document.getElementById('export-csv');
    
    // Track active requests
    const activeRequests = new Map();
    // 添加流式传输日志
    const streamingLogs = new Map();
    // 断路器状态 - 用于全局检测异常并阻断流
    const circuitBreaker = {
        enabled: true,
        failureThreshold: 3,   // 允许的最大连续失败次数
        failureCount: 0,       // 当前连续失败计数
        status: 'closed',      // closed: 正常, open: 触发熔断, half-open: 尝试恢复
        lastTrippedTime: null, // 上次触发熔断的时间
        cooldownPeriod: 30000, // 冷却时间(毫秒)
        resetTimeout: null,    // 冷却定时器
        errorPatterns: new Set()  // 已检测到的错误模式
    };
    
    let requestCounter = 0;
    let dupeContentDetector = new Set(); // 用于跟踪重复内容
    
    // 添加初始化完成日志
    console.log('UI组件初始化完成');
    
    // 初始化时确保断路器关闭
    initCircuitBreaker();
    
    // 全局错误处理器
    window.addEventListener('error', function(e) {
        console.error('全局错误:', e.error || e.message);
        
        // 错误显示在页面上但不打断操作
        const errorToast = document.createElement('div');
        errorToast.className = 'fixed top-4 right-4 bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded shadow-lg z-50';
        errorToast.innerHTML = `
            <div class="flex items-center">
                <div class="py-1"><svg class="h-6 w-6 text-red-500 mr-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg></div>
                <div>
                    <p class="font-bold">流式处理错误</p>
                    <p class="text-sm">${e.message}</p>
                </div>
            </div>
        `;
        document.body.appendChild(errorToast);
        
        // 5秒后移除
        setTimeout(() => {
            errorToast.classList.add('opacity-0');
            setTimeout(() => errorToast.remove(), 300);
        }, 5000);
        
        return false; // 允许默认错误处理继续
    });

    // 添加调试按钮
    const forceRefreshButton = document.getElementById('force-refresh');
    const debugButton = document.createElement('button');
    debugButton.id = 'debug-streaming';
    debugButton.className = 'px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-md ml-2';
    debugButton.textContent = '检查流式传输';
    debugButton.addEventListener('click', checkStreamingStatus);
    forceRefreshButton.parentNode.appendChild(debugButton);
    
    // 重置断路器按钮
    const resetCircuitButton = document.createElement('button');
    resetCircuitButton.id = 'reset-circuit';
    resetCircuitButton.className = 'px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-md ml-2';
    resetCircuitButton.textContent = '重置断路器';
    resetCircuitButton.addEventListener('click', resetCircuitBreaker);
    resetCircuitButton.style.display = 'none'; // 初始隐藏
    forceRefreshButton.parentNode.appendChild(resetCircuitButton);

    // 添加一个状态指示器
    const statusIndicator = document.createElement('div');
    statusIndicator.id = 'stream-status';
    statusIndicator.className = 'mt-2 text-xs text-center p-1 rounded hidden';
    forceRefreshButton.parentNode.appendChild(statusIndicator);

    startTestButton.addEventListener('click', startConcurrentTests);
    
    // Setup summary modal functionality
    showSummaryButton.addEventListener('click', showSummaryTable);
    closeModalButton.addEventListener('click', () => toggleSummaryModal(false));
    closeModalBtn.addEventListener('click', () => toggleSummaryModal(false));
    exportCsvButton.addEventListener('click', exportTableToCsv);

    // 断路器函数 - 检测是否应该继续处理
    function isCircuitBreakerClosed() {
        // 如果断路器未启用，始终返回true
        if (!circuitBreaker.enabled) return true;
        
        // 如果断路器处于打开状态，检查是否已经过了冷却期
        if (circuitBreaker.status === 'open') {
            const now = Date.now();
            if (circuitBreaker.lastTrippedTime && (now - circuitBreaker.lastTrippedTime) > circuitBreaker.cooldownPeriod) {
                // 冷却期已过，将状态改为半开
                circuitBreaker.status = 'half-open';
                console.log('断路器冷却期已过，进入半开状态');
                
                // 显示重置按钮
                document.getElementById('reset-circuit').style.display = 'inline-block';
                
                // 返回true以允许尝试一次请求
                return true;
            }
            
            // 冷却期未过，继续阻止请求
            return false;
        }
        
        // 半开或关闭状态都允许请求
        return true;
    }
    
    // 触发断路器
    function tripCircuitBreaker(reason) {
        if (circuitBreaker.status !== 'open') {
            circuitBreaker.status = 'open';
            circuitBreaker.lastTrippedTime = Date.now();
            circuitBreaker.failureCount = 0;
            
            console.warn(`断路器已打开! 原因: ${reason}`);
            
            // 显示重置按钮
            document.getElementById('reset-circuit').style.display = 'inline-block';
            
            // 显示全局警告
            showGlobalWarning(`检测到异常流式响应: ${reason}。断路器已启动，等待30秒后再尝试新请求。`);
            
            // 设置自动重置定时器
            if (circuitBreaker.resetTimeout) {
                clearTimeout(circuitBreaker.resetTimeout);
            }
            
            circuitBreaker.resetTimeout = setTimeout(() => {
                resetCircuitBreaker(false);
            }, circuitBreaker.cooldownPeriod);
        }
    }
    
    // 重置断路器
    function resetCircuitBreaker(showMessage = true) {
        circuitBreaker.status = 'closed';
        circuitBreaker.failureCount = 0;
        circuitBreaker.lastTrippedTime = null;
        circuitBreaker.errorPatterns.clear();
        
        // 清除自动重置定时器
        if (circuitBreaker.resetTimeout) {
            clearTimeout(circuitBreaker.resetTimeout);
            circuitBreaker.resetTimeout = null;
        }
        
        // 隐藏重置按钮
        document.getElementById('reset-circuit').style.display = 'none';
        
        if (showMessage) {
            console.log('断路器已手动重置');
            showGlobalWarning('断路器已重置，可以继续发送请求');
        } else {
            console.log('断路器已自动重置');
        }
    }
    
    // 显示全局警告
    function showGlobalWarning(message) {
        const warningToast = document.createElement('div');
        warningToast.className = 'fixed bottom-4 left-4 bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 rounded shadow-lg z-50 transition-opacity duration-300';
        warningToast.innerHTML = `
            <div class="flex items-center">
                <div class="py-1"><svg class="h-6 w-6 text-yellow-500 mr-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg></div>
                <div>
                    <p class="font-bold">系统警告</p>
                    <p class="text-sm">${message}</p>
                </div>
            </div>
        `;
        document.body.appendChild(warningToast);
        
        // 8秒后移除
        setTimeout(() => {
            warningToast.classList.add('opacity-0');
            setTimeout(() => warningToast.remove(), 300);
        }, 8000);
    }
    
    // 检测请求内容是否重复，防止串消息
    function checkDuplicateContent(requestId, content) {
        // 计算内容特征
        const contentHash = content.length > 50 ? 
            content.substring(0, 25) + content.substring(content.length - 25) : content;
        
        // 检查内容是否已存在
        if (dupeContentDetector.has(contentHash)) {
            console.warn(`检测到内容重复! 请求: ${requestId}, 内容哈希: ${contentHash}`);
            
            // 记录此错误模式到断路器
            circuitBreaker.errorPatterns.add('duplicate-content');
            
            // 增加失败计数
            circuitBreaker.failureCount++;
            
            // 如果累计错误超过阈值，触发断路器
            if (circuitBreaker.failureCount >= circuitBreaker.failureThreshold) {
                tripCircuitBreaker('检测到多次内容重复');
            }
            
            return true;
        }
        
        // 添加哈希到集合中
        dupeContentDetector.add(contentHash);
        
        // 限制集合大小，防止内存泄漏
        if (dupeContentDetector.size > 100) {
            // 移除最早的项 (利用迭代器)
            const iterator = dupeContentDetector.values();
            dupeContentDetector.delete(iterator.next().value);
        }
        
        return false;
    }
    
    // 请求前检查断路器状态
    function canStartRequest() {
        if (!isCircuitBreakerClosed()) {
            console.warn('断路器开启中，无法发送新请求');
            showGlobalWarning('系统检测到异常响应模式，请等待冷却期后再试');
            return false;
        }
        return true;
    }

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

    function createNewRequest(prompt) {
        requestCounter++;
        const responseId = `response-${Date.now()}-${requestCounter}`;
        
        // Clone the template
        const responseWindow = document.importNode(responseTemplate.content, true).querySelector('.response-window');
        responseWindow.id = responseId;
        
        // 添加请求唯一标识
        responseWindow.setAttribute('data-request-id', responseId);
        responseWindow.setAttribute('data-creation-time', Date.now());
        responseWindow.setAttribute('data-prompt-hash', safeEncode(prompt.substring(0, 20))); // 使用安全编码函数
        
        responseWindow.querySelector('.response-number').textContent = `请求 #${requestCounter}`;
        
        // Add question content to the question area (limit to 200 characters for display)
        const questionElement = responseWindow.querySelector('.question-content');
        const displayPrompt = prompt.length > 200 ? prompt.substring(0, 197) + '...' : prompt;
        questionElement.textContent = `问题: ${displayPrompt}`;
        
        // Store the full prompt as a data attribute for reference (不含"问题:"前缀)
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
        
        // Set up close button with明确的清理逻辑
        const closeBtn = responseWindow.querySelector('.close-btn');
        closeBtn.addEventListener('click', () => {
            // 取消请求
            if (activeRequests.has(responseId)) {
                console.log(`关闭并终止请求: ${responseId}`);
                const controller = activeRequests.get(responseId);
                controller.abort();
                activeRequests.delete(responseId);
            } else {
                console.log(`关闭已完成的请求: ${responseId}`);
            }
            
            // 记录关闭事件
            if (streamingLogs.has(responseId)) {
                streamingLogs.get(responseId).closedByUser = true;
                streamingLogs.get(responseId).closeTime = Date.now();
            }
            
            // 移除DOM元素
            responseWindow.remove();
        });
        
        // Start the streaming request
        streamLLMResponse(responseId, prompt);
        
        return responseId; // 返回ID方便跟踪
    }

    // 防抖动函数
    function debounce(func, wait) {
        let timeout;
        return function(...args) {
            const context = this;
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(context, args), wait);
        };
    }

    // 安全的字符串编码函数 - 支持Unicode字符
    function safeEncode(str) {
        try {
            // 对于纯ASCII字符串直接使用btoa
            return btoa(str).replace(/=/g, '');
        } catch (e) {
            // 非ASCII字符，先进行UTF-8编码
            try {
                // 使用encodeURIComponent将Unicode转为UTF-8，然后使用escape为特殊字符添加%
                // 然后替换所有%为十六进制字符，最后使用btoa编码
                return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_, p1) => {
                    return String.fromCharCode(parseInt(p1, 16));
                })).replace(/=/g, '');
            } catch (err) {
                // 如果编码仍然失败，使用简单的哈希函数作为回退
                return String(str.length) + str.charCodeAt(0) + str.charCodeAt(str.length - 1);
            }
        }
    }

    function initCircuitBreaker() {
        // 确保断路器初始状态为closed
        if (circuitBreaker) {
            circuitBreaker.status = 'closed';
            circuitBreaker.failureCount = 0;
            circuitBreaker.lastTrippedTime = null;
            circuitBreaker.errorPatterns.clear();
            
            // 清除自动重置定时器
            if (circuitBreaker.resetTimeout) {
                clearTimeout(circuitBreaker.resetTimeout);
                circuitBreaker.resetTimeout = null;
            }
            
            console.log('断路器已初始化为关闭状态');
        }
    }

    // 修改请求创建函数，增加更多日志信息
    function createRequestsWithDelay(concurrentCount) {
        return new Promise(async (resolve) => {
            const requestIds = [];
            
            console.log(`开始创建 ${concurrentCount} 个并发请求`);
            
            for (let i = 0; i < concurrentCount; i++) {
                try {
                    const randomPrompt = getRandomQuestion();
                    console.log(`创建请求 #${i+1}/${concurrentCount}: 使用问题长度 ${randomPrompt.length} 字符`);
                    
                    const newRequestId = createNewRequest(randomPrompt);
                    requestIds.push(newRequestId);
                    
                    // 只对非最后一个请求添加延迟
                    if (i < concurrentCount - 1) {
                        console.log(`请求 #${i+1} 创建完成，等待 200ms 后创建下一个...`);
                        // 增加延迟到200ms，确保足够的请求间隔
                        await new Promise(resolve => setTimeout(resolve, 200));
                    }
                } catch (err) {
                    console.error(`创建请求 #${i+1} 失败:`, err);
                }
            }
            
            console.log(`所有 ${requestIds.length} 个请求已创建完成`);
            resolve(requestIds);
        });
    }

    // 更新startConcurrentTests函数
    function startConcurrentTests() {
        // 检查断路器状态
        if (!canStartRequest()) {
            alert('系统暂时无法处理新请求，请稍后再试');
            return;
        }
        
        // 防止按钮快速多次点击
        if (startTestButton.disabled) return;
        
        // 设置按钮Loading状态
        startTestButton.disabled = true;
        const originalText = startTestButton.textContent;
        startTestButton.innerHTML = `<span class="animate-pulse">处理中...</span>`;
        
        setTimeout(() => {
            const concurrentCount = parseInt(document.getElementById('concurrent-requests').value, 10);
            
            // Clear existing outputs if needed
            if (confirm('清除现有输出？')) {
                // 记录日志
                console.log(`清除现有输出，中止 ${activeRequests.size} 个活跃请求`);
                
                // 首先中止所有活跃请求
                activeRequests.forEach((controller, id) => {
                    console.log(`中止请求: ${id}`);
                    controller.abort();
                });
                
                // 然后清空容器和映射
                outputsContainer.innerHTML = '';
                activeRequests.clear();
                
                // 创建新的日志记录
                const testSession = {
                    startTime: Date.now(),
                    concurrentCount,
                    previousRequestCount: requestCounter
                };
                console.log('开始新测试会话:', testSession);
                
                // 重置计数器
                requestCounter = 0;
                
                // 清空内容检测器
                dupeContentDetector.clear();
            }
            
            // 执行创建请求的异步过程
            createRequestsWithDelay(concurrentCount).then(requestIds => {
                console.log(`已创建 ${requestIds.length} 个请求:`, requestIds);
            }).finally(() => {
                // 恢复按钮状态
                startTestButton.disabled = false;
                startTestButton.textContent = originalText;
            });
        }, 500); // 短暂延迟，给用户反馈
    }

    async function streamLLMResponse(responseId, prompt) {
        // 始终允许发起请求，无论断路器状态
        // 仅对明显的问题执行限制
        
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
        
        // 初始化流式传输日志
        streamingLogs.set(responseId, {
            requestId: responseId,  // 明确存储请求ID
            prompt: prompt,
            chunks: [],
            startTime: Date.now(),
            endTime: null,
            status: 'starting',
            errors: [],
            partialJsonBuffer: ''  // 添加缓冲区处理不完整JSON
        });
        
        // Update status
        updateStatus(statusElement, 'loading');
        responseContent.classList.add('typing-animation');
        
        // Create AbortController for this request
        const controller = new AbortController();
        activeRequests.set(responseId, controller);
        
        // Track time and tokens
        const startTime = Date.now();
        let totalTokens = 0;
        let responseText = '';  // 移到函数顶部，确保在整个生命周期可访问
        let lastReceivedTime = Date.now(); // 添加最后接收时间跟踪
        
        // 为每个请求添加唯一标识到dom元素
        responseWindow.setAttribute('data-request-id', responseId);
        
        const timeInterval = setInterval(() => {
            const elapsedSeconds = ((Date.now() - startTime) / 1000).toFixed(1);
            responseTime.textContent = `${elapsedSeconds}s`;
            
            // 检测长时间无响应（超过5秒无新数据）
            const timeSinceLastChunk = Date.now() - lastReceivedTime;
            if (timeSinceLastChunk > 5000 && streamingLogs.get(responseId) && streamingLogs.get(responseId).status === 'streaming') {
                // 记录警告但不中断流
                console.warn(`请求 ${responseId} 已有 ${timeSinceLastChunk/1000}秒 无新数据`);
                if (streamingLogs.has(responseId)) {
                    streamingLogs.get(responseId).warnings = streamingLogs.get(responseId).warnings || [];
                    streamingLogs.get(responseId).warnings.push({
                        timestamp: Date.now(),
                        message: `长时间无新数据: ${timeSinceLastChunk/1000}秒`
                    });
                }
            }
            
            // Update tokens per second if we have tokens
            if (totalTokens > 0) {
                const elapsedSecondsNum = parseFloat(elapsedSeconds);
                const tokensPerSecond = (totalTokens / elapsedSecondsNum).toFixed(1);
                tokensPerSecondElement.textContent = tokensPerSecond;
                
                // Store these values as data attributes for the summary table
                responseWindow.setAttribute('data-response-tokens', totalTokens);
                responseWindow.setAttribute('data-response-tps', tokensPerSecond);
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
            
            console.log(`发起请求: ${responseId}`);
            
            // 简化请求过程，避免超时和多余检查
            let response;
            try {
                response = await fetch(endpointUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(payload),
                    signal: controller.signal
                });
            } catch (fetchError) {
                throw new Error(`请求失败: ${fetchError.message}`);
            }
            
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
            let jsonBuffer = ''; // 用于处理跨块的JSON
            
            if (streamingLogs.has(responseId)) {
                streamingLogs.get(responseId).status = 'streaming';
            }
            
            // 确保DOM元素存在时才继续处理
            while (document.getElementById(responseId)) {
                let done, value;
                
                try {
                    ({ done, value } = await reader.read());
                    
                    if (done) {
                        if (streamingLogs.has(responseId)) {
                            streamingLogs.get(responseId).status = 'completed';
                            streamingLogs.get(responseId).endTime = Date.now();
                        }
                        break;
                    }
                    
                    // 更新最后接收时间
                    lastReceivedTime = Date.now();
                } catch (readError) {
                    console.warn(`读取流错误: ${readError.message}`);
                    // 尝试继续读取，不要立刻中断
                    continue;
                }
                
                // Decode the stream chunk
                const chunk = decoder.decode(value, { stream: true });
                
                // 记录接收到的chunk
                if (streamingLogs.has(responseId)) {
                    streamingLogs.get(responseId).chunks.push({
                        timestamp: Date.now(),
                        content: chunk
                    });
                }
                
                try {
                    // 处理可能跨块的JSON
                    jsonBuffer += chunk;
                    
                    // 尝试提取完整的JSON行
                    let processedBuffer = '';
                    const lines = jsonBuffer.split('\n');
                    
                    // 处理除最后一行外的所有行（最后一行可能不完整）
                    for (let i = 0; i < lines.length - 1; i++) {
                        const line = lines[i].trim();
                        if (line === '') continue;
                        if (line === 'data: [DONE]') continue;
                        
                        // 处理行
                        const textFromLine = await processLine(line, responseId, responseContent, responseText, tokensInfoElement, totalTokensElement);
                        if (textFromLine) {
                            processedBuffer += textFromLine;
                            // 实时更新token计数
                            totalTokens += estimateTokens(textFromLine);
                            totalTokensElement.textContent = totalTokens;
                            tokensInfoElement.classList.remove('hidden');
                        }
                    }
                    
                    // 保留最后一行（可能不完整）到下一个循环
                    jsonBuffer = lines[lines.length - 1];
                    
                    // 更新响应文本
                    if (processedBuffer) {
                        responseText += processedBuffer;
                        responseContent.textContent = responseText;
                        responseContent.scrollTop = responseContent.scrollHeight;
                    }
                } catch (err) {
                    console.error(`处理chunk错误:`, err);
                    
                    // 回退处理：直接附加原始文本，确保至少显示一些内容
                    responseText += chunk.replace(/^data:\s*/gm, '').replace(/[{}[\]"\\]/g, '');
                    responseContent.textContent = responseText;
                    totalTokens += estimateTokens(chunk);
                    totalTokensElement.textContent = totalTokens;
                    tokensInfoElement.classList.remove('hidden');
                }
            }
            
            // 处理可能剩余的最后一块数据
            if (jsonBuffer.trim() && document.getElementById(responseId)) {
                try {
                    const finalText = await processLine(jsonBuffer, responseId, responseContent, responseText, tokensInfoElement, totalTokensElement);
                    if (finalText) {
                        responseText += finalText;
                        responseContent.textContent = responseText;
                        
                        // 更新token计数
                        totalTokens += estimateTokens(finalText);
                        totalTokensElement.textContent = totalTokens;
                    }
                } catch (err) {
                    console.warn(`处理最终数据失败: ${err.message}`);
                }
            }
            
            // 完成标记
            if (document.getElementById(responseId)) {
                updateStatus(statusElement, 'finished');
                responseContent.classList.remove('typing-animation');
                
                // 最终token速率计算
                const elapsedSeconds = (Date.now() - startTime) / 1000;
                const tokensPerSecond = (totalTokens / Math.max(0.1, elapsedSeconds)).toFixed(1);
                tokensPerSecondElement.textContent = tokensPerSecond;
                
                // 保存统计数据到元素属性
                responseWindow.setAttribute('data-complete', 'true');
                responseWindow.setAttribute('data-elapsed-time', elapsedSeconds.toFixed(1));
                responseWindow.setAttribute('data-response-tokens', totalTokens);
                responseWindow.setAttribute('data-response-tps', tokensPerSecond);
            }
        } catch (error) {
            console.error(`请求处理出错:`, error);
            
            // 记录错误
            if (streamingLogs.has(responseId)) {
                streamingLogs.get(responseId).status = 'error';
                streamingLogs.get(responseId).errors.push({
                    timestamp: Date.now(),
                    message: error.message,
                    stack: error.stack
                });
            }
            
            if (document.getElementById(responseId)) {
                if (error.name === 'AbortError') {
                    updateStatus(statusElement, 'error');
                    responseContent.textContent = '请求已中止';
                } else {
                    updateStatus(statusElement, 'error');
                    responseContent.textContent = `错误: ${error.message}`;
                }
                responseContent.classList.remove('typing-animation');
                
                // 标记为错误状态
                responseWindow.setAttribute('data-complete', 'false');
                responseWindow.setAttribute('data-error', 'true');
            }
        } finally {
            clearInterval(timeInterval);
            activeRequests.delete(responseId);
        }
    }

    // 辅助函数：处理单行数据
    async function processLine(line, responseId, responseContent, currentText, tokensInfoElement, totalTokensElement) {
        // 默认允许处理 - 断路器检查移到更高层次，避免干扰正常流程
        // 只有在明确检测到问题时才阻止内容
        
        // 引用当前正确的tokens计数
        let totalTokens = parseInt(totalTokensElement.textContent) || 0;
        let processedText = '';
        
        // 移除"data: "前缀
        const jsonStr = line.startsWith('data: ') ? line.slice(6) : line;
        
        try {
            const data = JSON.parse(jsonStr);
            
            // 提取不同格式的文本
            let textChunk = '';
            
            if (data.choices && data.choices[0]) {
                if (data.choices[0].text) {
                    textChunk = data.choices[0].text;
                } else if (data.choices[0].delta && data.choices[0].delta.content) {
                    textChunk = data.choices[0].delta.content;
                }
            }
            
            if (textChunk) {
                // 检查内容是否重复（防止串消息），但改为更保守的检查方式
                // 只有在明显检测到重复时才阻止
                const responseElement = document.querySelector(`.response-window[data-request-id="${responseId}"]`);
                if (responseElement && responseElement.querySelector('.response-content').textContent.length > 500) {
                    const currentFullText = responseElement.querySelector('.response-content').textContent;
                    
                    // 只检查较长文本的一些特定模式，例如多次重复的序列
                    // 每1000字符左右检查一次，减少频繁检查导致的错误阻断
                    if (currentFullText.length % 1000 < 20) {
                        // 只有当检测到明显的重复模式时才拒绝
                        if (hasObviousDuplication(currentFullText)) {
                            console.warn(`请求 ${responseId} 检测到明显的重复内容，可能是串消息`);
                            // 不需要触发断路器，只是记录日志
                            streamingLogs.get(responseId).warnings = streamingLogs.get(responseId).warnings || [];
                            streamingLogs.get(responseId).warnings.push({
                                timestamp: Date.now(),
                                message: '检测到内容可能重复，疑似串消息'
                            });
                            
                            // 对于明显重复，仍然返回内容但添加标记
                            processedText = textChunk + " [可能重复]";
                        } else {
                            processedText = textChunk;
                        }
                    } else {
                        processedText = textChunk;
                    }
                } else {
                    processedText = textChunk;
                }
                
                // 更新token计数
                const newTokens = estimateTokens(textChunk);
                totalTokens += newTokens;
                totalTokensElement.textContent = totalTokens;
                
                // 确保tokens信息可见
                tokensInfoElement.classList.remove('hidden');
            }
        } catch (parseError) {
            // JSON解析失败，作为纯文本处理
            console.warn(`请求 ${responseId} JSON解析失败: ${parseError.message}, 行: ${jsonStr.substring(0, 50)}...`);
            
            // 将整行添加为文本，但需要清理格式
            // 如果包含明显的JSON结构但解析失败，可能表示格式不完整
            if (jsonStr.includes('{"choices":') || jsonStr.includes('"delta":') || jsonStr.includes('"text":')) {
                // 可能是不完整的JSON，尝试提取文本部分
                const textMatch = jsonStr.match(/"(?:text|content)":\s*"([^"]+)"/);
                if (textMatch && textMatch[1]) {
                    processedText = textMatch[1];
                } else {
                    // 无法提取，使用原始文本但去除明显的JSON结构
                    processedText = jsonStr.replace(/[{}[\]"\\]/g, '');
                }
            } else {
                // 可能是普通文本，直接使用
                processedText = line;
            }
            
            totalTokens += estimateTokens(processedText);
            totalTokensElement.textContent = totalTokens;
            tokensInfoElement.classList.remove('hidden');
        }
        
        return processedText;
    }

    // 添加一个检测明显重复内容的辅助函数
    function hasObviousDuplication(text) {
        if (text.length < 200) return false;
        
        // 检查1: 同样的句子或段落是否多次重复
        // 将文本分割成句子
        const sentences = text.split(/[.!?。！？]+/).filter(s => s.trim().length > 15);
        const sentenceSet = new Set(sentences);
        
        // 如果有50%以上的句子重复，可能是串消息
        if (sentences.length > 5 && sentenceSet.size < sentences.length * 0.5) {
            return true;
        }
        
        // 检查2: 是否包含多个JSON标记，这通常表示消息串联
        const jsonMarkers = (text.match(/\{"choices":/g) || []).length;
        if (jsonMarkers > 1) {
            return true;
        }
        
        // 检查3: 检查大段重复文本
        // 取最后200个字符，看是否在前面的文本中多次出现
        if (text.length > 400) {
            const lastPart = text.slice(-200);
            const mainText = text.slice(0, -200);
            // 如果在前面文本中多次出现，可能是串消息
            return mainText.includes(lastPart);
        }
        
        return false;
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

    // Function to show the summary table
    function showSummaryTable() {
        const tableBody = document.getElementById('summary-table-body');
        tableBody.innerHTML = ''; // Clear existing rows
        
        // Get all response windows
        const responseWindows = document.querySelectorAll('.response-window');
        
        if (responseWindows.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="7" class="text-center py-4 text-gray-500">没有找到任何请求数据</td></tr>';
            toggleSummaryModal(true);
            return;
        }

        // Collect data from response windows
        const tableData = [];
        responseWindows.forEach(window => {
            const requestNumber = parseInt(window.querySelector('.response-number').textContent.replace('请求 #', ''));
            let question = window.querySelector('.question-content').dataset.fullPrompt || 
                            window.querySelector('.question-content').textContent.replace('问题: ', '');
            
            // 确保去除问题前缀
            question = question.replace(/^问题:\s*/i, '');
            
            const response = window.querySelector('.response-content').textContent;
            
            // Use stored response tokens data if available, otherwise fall back to the displayed value
            const responseTokens = parseInt(window.getAttribute('data-response-tokens')) || 
                                parseInt(window.querySelector('.total-tokens').textContent) || 0;
            
            // Use stored response tokens per second if available, otherwise fall back to the displayed value
            const tokensPerSecond = parseFloat(window.getAttribute('data-response-tps')) || 
                                parseFloat(window.querySelector('.tokens-per-second').textContent) || 0;
            
            const responseTime = parseFloat(window.querySelector('.response-time').textContent.replace('s', '')) || 0;
            const status = window.querySelector('.response-status').textContent;
            
            tableData.push({
                requestNumber,
                question,
                response,
                responseTokens,
                tokensPerSecond,
                responseTime,
                status
            });
        });
        
        // Sort by request number as default
        tableData.sort((a, b) => a.requestNumber - b.requestNumber);
        
        // Render the table
        renderSummaryTable(tableData);
        
        // Setup sorting
        setupTableSorting(tableData);
        
        // Show the modal
        toggleSummaryModal(true);
    }
    
    // Helper function to convert status text to class name
    function status2Class(status) {
        switch (status) {
            case '等待中':
                return 'waiting';
            case '连接中...':
                return 'loading';
            case '流式接收中':
                return 'streaming';
            case '已完成':
                return 'finished';
            case '错误':
                return 'error';
            default:
                return 'default';
        }
    }
    
    // Render table with data
    function renderSummaryTable(data) {
        const tableBody = document.getElementById('summary-table-body');
        tableBody.innerHTML = '';
        
        data.forEach(item => {
            const row = document.createElement('tr');
            
            // 格式化问题内容，去除"问题: "前缀
            const questionText = item.question.replace(/^问题:\s*/i, '');
            
            // 合并回答信息
            const responseInfo = `${item.responseTokens} tokens / ${item.tokensPerSecond.toFixed(1)} t/s`;
            
            // 确保原始完整内容保存在data-content属性中
            const fullQuestionText = questionText;
            const fullResponseText = item.response;
            
            // 在页面上显示的是截断内容
            const displayQuestionText = truncateText(fullQuestionText, 150);
            const displayResponseText = truncateText(fullResponseText, 150);
            
            // 使用类名而不是内联样式
            row.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap">${item.requestNumber}</td>
                <td class="px-6 py-4 summary-text-column question-column" 
                    data-content="${escapeHtml(fullQuestionText)}">
                    ${escapeHtml(displayQuestionText)}
                </td>
                <td class="px-6 py-4 summary-text-column answer-column" 
                    data-content="${escapeHtml(fullResponseText)}">
                    ${escapeHtml(displayResponseText)}
                </td>
                <td class="px-6 py-4 whitespace-nowrap response-info-column">
                    ${responseInfo}
                </td>
                <td class="px-6 py-4 whitespace-nowrap">${item.responseTime.toFixed(1)}</td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="status-label status-${status2Class(item.status)}">${item.status}</span>
                </td>
            `;
            
            tableBody.appendChild(row);
        });
        
        // Add click handlers for expandable text cells
        setupExpandableTextCells();
    }
    
    // Setup table sorting
    function setupTableSorting(tableData) {
        const tableHeaders = document.querySelectorAll('#summary-table th');
        const sortableColumns = [
            { index: 0, key: 'requestNumber', type: 'number' },
            { index: 3, key: 'responseTokens', type: 'number' },
            { index: 4, key: 'responseTime', type: 'number' },
            { index: 5, key: 'status', type: 'string' }
        ];
        
        // Clear existing sort indicators
        tableHeaders.forEach(th => {
            th.style.cursor = 'default';
            th.innerHTML = th.textContent;
        });
        
        // Add sort indicators and click handlers to sortable columns
        sortableColumns.forEach(column => {
            const th = tableHeaders[column.index];
            th.style.cursor = 'pointer';
            th.dataset.key = column.key;
            th.dataset.sortOrder = 'asc'; // Default sort order
            
            // Add sort indicator
            th.innerHTML = `${th.textContent} <span class="sort-indicator">⇅</span>`;
            
            // Add click handler
            th.addEventListener('click', function() {
                const key = this.dataset.key;
                let sortOrder = this.dataset.sortOrder;
                
                // Toggle sort order
                sortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
                this.dataset.sortOrder = sortOrder;
                
                // Update all sort indicators
                tableHeaders.forEach(header => {
                    const indicator = header.querySelector('.sort-indicator');
                    if (indicator) {
                        indicator.textContent = header === this ? (sortOrder === 'asc' ? '↑' : '↓') : '⇅';
                    }
                });
                
                // Sort data
                const sortedData = [...tableData].sort((a, b) => {
                    let valueA = column.getter ? column.getter(a) : a[key];
                    let valueB = column.getter ? column.getter(b) : b[key];
                    
                    if (column.type === 'number') {
                        // Handle NaN or missing values
                        valueA = isNaN(valueA) ? 0 : valueA;
                        valueB = isNaN(valueB) ? 0 : valueB;
                        return sortOrder === 'asc' ? valueA - valueB : valueB - valueA;
                    } else {
                        return sortOrder === 'asc' ? 
                            String(valueA).localeCompare(String(valueB)) : 
                            String(valueB).localeCompare(String(valueA));
                    }
                });
                
                // Render the sorted table
                renderSummaryTable(sortedData);
            });
        });
    }
    
    // Helper function to toggle summary modal
    function toggleSummaryModal(show) {
        if (show) {
            summaryModal.classList.remove('hidden');
            setTimeout(() => {
                summaryModal.classList.add('active');
            }, 10);
        } else {
            summaryModal.classList.remove('active');
            setTimeout(() => {
                summaryModal.classList.add('hidden');
            }, 300);
            
            // Remove any expanded content modals
            const expandedContent = document.querySelector('.expanded-content');
            const backdrop = document.querySelector('.modal-backdrop');
            if (expandedContent) expandedContent.remove();
            if (backdrop) backdrop.remove();
        }
    }
    
    // Helper function to truncate text
    function truncateText(text, maxLength) {
        if (!text) return '';
        return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
    }
    
    // Helper function to escape HTML
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    // Helper function to get status class
    function getStatusClass(status) {
        switch (status) {
            case '等待中':
                return 'bg-yellow-100 text-yellow-800';
            case '连接中...':
                return 'bg-blue-100 text-blue-800';
            case '流式接收中':
                return 'bg-green-100 text-green-800';
            case '已完成':
                return 'bg-green-50 text-green-700';
            case '错误':
                return 'bg-red-100 text-red-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    }
    
    // Setup expandable text cells
    function setupExpandableTextCells() {
        // 获取所有可展开的文本单元格
        const textCells = document.querySelectorAll('#summary-table .summary-text-column');
        console.log(`找到 ${textCells.length} 个可展开文本单元格`);
        
        textCells.forEach((cell, index) => {
            // 确保单元格有data-content属性
            if (!cell.hasAttribute('data-content')) {
                console.warn(`单元格 #${index} 没有data-content属性`);
                return;
            }
            
            // 移除所有现有的事件监听器和指示器
            cell.replaceWith(cell.cloneNode(true));
            
            // 重新获取替换后的元素
            const newCell = document.querySelectorAll('#summary-table .summary-text-column')[index];
            
            // 添加视觉提示
            let indicator = newCell.querySelector('.expand-indicator');
            if (!indicator) {
                indicator = document.createElement('div');
                indicator.className = 'expand-indicator';
                indicator.innerHTML = '👁️';
                indicator.style.cssText = 'position:absolute; bottom:2px; right:2px; font-size:10px; opacity:0.5;';
                newCell.appendChild(indicator);
            }
            
            // 添加点击事件
            newCell.addEventListener('click', function(e) {
                const content = this.getAttribute('data-content');
                console.log(`单元格点击 - 内容长度: ${content?.length || 0}`);
                
                if (!content) {
                    console.error('单元格没有data-content属性');
                    return;
                }
                
                // 移除任何现有的模态框
                document.querySelectorAll('.modal-backdrop, .expanded-content').forEach(el => el.remove());
                
                // 创建背景遮罩
                const backdrop = document.createElement('div');
                backdrop.className = 'modal-backdrop';
                document.body.appendChild(backdrop);
                
                // 创建展开内容区域
                const expandedDiv = document.createElement('div');
                expandedDiv.className = 'expanded-content';
                
                // 添加内容类型标题
                const contentType = this.classList.contains('question-column') ? '提问内容' : '回答内容';
                const titleDiv = document.createElement('div');
                titleDiv.className = 'expanded-content-title';
                titleDiv.textContent = contentType;
                expandedDiv.appendChild(titleDiv);
                
                // 创建内容容器并设置内容
                const contentDiv = document.createElement('div');
                contentDiv.className = 'expanded-content-body';
                contentDiv.textContent = content;
                expandedDiv.appendChild(contentDiv);
                
                // 添加关闭按钮
                const closeBtn = document.createElement('button');
                closeBtn.innerHTML = '&times;';
                closeBtn.className = 'expanded-content-close';
                closeBtn.style.cssText = 'position:absolute;top:10px;right:10px;background:none;border:none;font-size:24px;cursor:pointer;';
                expandedDiv.appendChild(closeBtn);
                
                document.body.appendChild(expandedDiv);
                
                // 确保滚动到顶部
                setTimeout(() => {
                    contentDiv.scrollTop = 0;
                    expandedDiv.scrollTop = 0;
                }, 10);
                
                // 设置关闭处理程序
                closeBtn.addEventListener('click', () => {
                    expandedDiv.remove();
                    backdrop.remove();
                });
                
                backdrop.addEventListener('click', () => {
                    expandedDiv.remove();
                    backdrop.remove();
                });
                
                // 阻止事件冒泡
                e.stopPropagation();
            });
            
            console.log(`设置单元格 #${index}: ${newCell.className}`);
        });
    }
    
    // Export table to CSV
    function exportTableToCsv() {
        const table = document.getElementById('summary-table');
        let csv = [];
        
        // Get table header
        const headerRow = Array.from(table.querySelectorAll('th'))
            .map(th => `"${th.textContent.trim().replace(/"/g, '""')}"`);
        csv.push(headerRow.join(','));
        
        // Get response data directly for more accurate CSV
        const responseWindows = document.querySelectorAll('.response-window');
        const responseData = [];
        
        responseWindows.forEach(window => {
            const requestNumber = window.querySelector('.response-number').textContent.replace('请求 #', '');
            let question = window.querySelector('.question-content').dataset.fullPrompt || 
                            window.querySelector('.question-content').textContent.replace('问题: ', '');
            
            // 确保去除问题前缀
            question = question.replace(/^问题:\s*/i, '');
            
            const response = window.querySelector('.response-content').textContent;
            const responseTokens = window.getAttribute('data-response-tokens') || 
                                window.querySelector('.total-tokens').textContent;
            const tokensPerSecond = window.getAttribute('data-response-tps') || 
                                window.querySelector('.tokens-per-second').textContent;
            const responseTime = window.querySelector('.response-time').textContent.replace('s', '');
            const status = window.querySelector('.response-status').textContent;
            
            responseData.push({
                requestNumber,
                question,
                response,
                responseTokens,
                tokensPerSecond,
                responseTime,
                status
            });
        });
        
        // Sort by request number for consistent order
        responseData.sort((a, b) => parseInt(a.requestNumber) - parseInt(b.requestNumber));
        
        // Add data rows
        responseData.forEach(item => {
            // 合并回答信息
            const responseInfo = `${item.responseTokens} tokens / ${item.tokensPerSecond} t/s`;
            
            const rowData = [
                `"${item.requestNumber}"`,
                `"${item.question.replace(/"/g, '""')}"`,
                `"${item.response.replace(/"/g, '""')}"`,
                `"${responseInfo}"`,
                `"${item.responseTime}"`,
                `"${item.status}"`,
            ];
            csv.push(rowData.join(','));
        });
        
        // Create CSV content
        const csvContent = csv.join('\n');
        
        // Create download link
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `llm-test-summary-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.csv`);
        link.style.display = 'none';
        
        // Add to page, click, and remove
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    // 添加流式传输状态检查函数
    function checkStreamingStatus() {
        const statusDiv = document.getElementById('stream-status');
        
        // 如果没有请求记录，显示提示
        if (streamingLogs.size === 0) {
            statusDiv.textContent = '没有流式传输记录可查看';
            statusDiv.className = 'mt-2 text-xs text-center p-1 rounded bg-yellow-100 text-yellow-800';
            statusDiv.classList.remove('hidden');
            setTimeout(() => statusDiv.classList.add('hidden'), 3000);
            return;
        }
        
        // 检查所有流式传输的状态
        let hasErrors = false;
        let hasOverlap = false;
        let totalStreams = streamingLogs.size;
        let completedStreams = 0;
        
        // 检查每个流的状态
        streamingLogs.forEach((log, id) => {
            if (log.status === 'error' || log.errors.length > 0) {
                hasErrors = true;
            }
            if (log.status === 'completed') {
                completedStreams++;
            }
        });
        
        // 检查是否有内容重叠（简单检查）
        const activeResponseElements = document.querySelectorAll('.response-window');
        const contents = new Set();
        activeResponseElements.forEach(el => {
            const content = el.querySelector('.response-content').textContent;
            // 如果内容非常短，忽略
            if (content.length < 10) return;
            
            // 如果内容已存在于集合中，可能有重叠
            if (contents.has(content)) {
                hasOverlap = true;
            } else {
                contents.add(content);
            }
        });
        
        // 使用新的函数执行更深入的完整性检查
        const integrityIssues = checkStreamIntegrity();
        
        // 显示状态
        if (hasErrors) {
            statusDiv.textContent = '检测到流式传输错误，请检查控制台日志';
            statusDiv.className = 'mt-2 text-xs text-center p-1 rounded bg-red-100 text-red-800';
        } else if (integrityIssues.hasIssues) {
            statusDiv.textContent = `检测到${integrityIssues.issueType}，请查看诊断日志`;
            statusDiv.className = 'mt-2 text-xs text-center p-1 rounded bg-red-100 text-red-800';
        } else if (hasOverlap) {
            statusDiv.textContent = '检测到可能的内容重叠，请检查各响应窗口';
            statusDiv.className = 'mt-2 text-xs text-center p-1 rounded bg-orange-100 text-orange-800';
        } else {
            statusDiv.textContent = `流式传输正常：${completedStreams}/${totalStreams} 已完成`;
            statusDiv.className = 'mt-2 text-xs text-center p-1 rounded bg-green-100 text-green-800';
        }
        
        statusDiv.classList.remove('hidden');
        setTimeout(() => statusDiv.classList.add('hidden'), 5000);
        
        // 在控制台输出详细日志
        console.log('流式传输详细日志:', streamingLogs);
        if (integrityIssues.hasIssues) {
            console.warn('流完整性检查结果:', integrityIssues);
        }
    }
    
    // 新增函数：检查流完整性，用于发现串消息或漏接情况
    function checkStreamIntegrity() {
        const result = {
            hasIssues: false,
            issueType: '',
            details: []
        };
        
        // 1. 检查每个响应窗口的内容是否与其requestId匹配
        const responseWindows = document.querySelectorAll('.response-window');
        responseWindows.forEach(window => {
            const requestId = window.getAttribute('data-request-id');
            if (!requestId) {
                result.hasIssues = true;
                result.issueType = '缺失请求ID';
                result.details.push({
                    type: 'missing-id',
                    element: window.id,
                    content: window.querySelector('.response-content').textContent.substring(0, 50)
                });
                return;
            }
            
            // 检查这个ID是否在日志中
            if (!streamingLogs.has(requestId)) {
                result.hasIssues = true;
                result.issueType = '请求ID不匹配';
                result.details.push({
                    type: 'id-mismatch',
                    requestId,
                    element: window.id
                });
                return;
            }
            
            // 2. 检查消息分块统计
            const log = streamingLogs.get(requestId);
            if (log.chunks.length === 0) {
                // 没有接收到任何块，可能是漏接
                if (log.status === 'streaming') {
                    result.hasIssues = true;
                    result.issueType = '漏接消息';
                    result.details.push({
                        type: 'no-chunks',
                        requestId,
                        status: log.status
                    });
                }
                return;
            }
            
            // 3. 检查响应时间间隔是否异常
            if (log.chunks.length > 1) {
                let abnormalGaps = 0;
                for (let i = 1; i < log.chunks.length; i++) {
                    const timeDiff = log.chunks[i].timestamp - log.chunks[i-1].timestamp;
                    if (timeDiff > 10000) { // 间隔超过10秒
                        abnormalGaps++;
                    }
                }
                
                if (abnormalGaps > 0) {
                    result.hasIssues = true;
                    result.issueType = '响应时间间隔异常';
                    result.details.push({
                        type: 'abnormal-gaps',
                        requestId,
                        abnormalGaps
                    });
                }
            }
            
            // 4. 检查响应文本中是否有明显的异常模式（如重复的内容块）
            const content = window.querySelector('.response-content').textContent;
            // 常见的异常模式：重复的JSON对象或data前缀
            if (content.includes('{"choices":[{"text":') && content.includes('{"choices":[{"text":')) {
                // 发现多个JSON对象头，可能是串消息
                result.hasIssues = true;
                result.issueType = '串消息(JSON对象重复)';
                result.details.push({
                    type: 'duplicate-json-headers',
                    requestId,
                    count: (content.match(/{"choices":\[{"text":/g) || []).length
                });
            }
            
            if ((content.match(/data:/g) || []).length > 3) {
                // 发现多个data:前缀，可能是串消息
                result.hasIssues = true;
                result.issueType = '串消息(data:前缀重复)';
                result.details.push({
                    type: 'duplicate-data-prefix',
                    requestId,
                    count: (content.match(/data:/g) || []).length
                });
            }
        });
        
        return result;
    }

    // 增加安全检查，确保错误处理到位
    window.addEventListener('unhandledrejection', function(event) {
        console.error('未处理的Promise错误:', event.reason);
        
        // 显示给用户
        const errorToast = document.createElement('div');
        errorToast.className = 'fixed top-4 right-4 bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded shadow-lg z-50';
        errorToast.innerHTML = `
            <div class="flex items-center">
                <div class="py-1"><svg class="h-6 w-6 text-red-500 mr-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg></div>
                <div>
                    <p class="font-bold">未处理异常</p>
                    <p class="text-sm">${event.reason.message || '未知错误'}</p>
                </div>
            </div>
        `;
        document.body.appendChild(errorToast);
        
        // 5秒后移除
        setTimeout(() => {
            errorToast.classList.add('opacity-0');
            setTimeout(() => errorToast.remove(), 300);
        }, 5000);
    });
}); 