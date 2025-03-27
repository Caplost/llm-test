document.addEventListener('DOMContentLoaded', () => {
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
    let requestCounter = 0;

    startTestButton.addEventListener('click', startConcurrentTests);
    
    // Setup summary modal functionality
    showSummaryButton.addEventListener('click', showSummaryTable);
    closeModalButton.addEventListener('click', () => toggleSummaryModal(false));
    closeModalBtn.addEventListener('click', () => toggleSummaryModal(false));
    exportCsvButton.addEventListener('click', exportTableToCsv);

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
            
            // Mark response as complete for summary table and store final values
            responseWindow.setAttribute('data-complete', 'true');
            responseWindow.setAttribute('data-elapsed-time', elapsedSeconds.toFixed(1));
            responseWindow.setAttribute('data-response-tokens', totalTokens);
            responseWindow.setAttribute('data-response-tps', tokensPerSecond);
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
            
            // Mark response as errored for summary table
            responseWindow.setAttribute('data-complete', 'false');
            responseWindow.setAttribute('data-error', 'true');
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
            
            // 使用类名而不是内联样式
            row.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap">${item.requestNumber}</td>
                <td class="px-6 py-4 summary-text-column question-column" 
                    data-content="${escapeHtml(questionText)}">
                    ${escapeHtml(truncateText(questionText, 150))}
                </td>
                <td class="px-6 py-4 summary-text-column answer-column" 
                    data-content="${escapeHtml(item.response)}">
                    ${escapeHtml(truncateText(item.response, 150))}
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
                expandedDiv.textContent = content;
                
                // 添加关闭按钮
                const closeBtn = document.createElement('button');
                closeBtn.innerHTML = '&times;';
                closeBtn.style.cssText = 'position:absolute;top:10px;right:10px;background:none;border:none;font-size:24px;cursor:pointer;';
                expandedDiv.appendChild(closeBtn);
                
                document.body.appendChild(expandedDiv);
                
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
}); 