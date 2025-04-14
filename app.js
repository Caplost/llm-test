let models = [];

// 加载配置文件
async function loadConfig() {
    try {
        const response = await fetch('config.json');
        const config = await response.json();
        models = config.models;
        renderModelCheckboxes();
    } catch (error) {
        console.error('Error loading config:', error);
    }
}

// 渲染模型选择框
function renderModelCheckboxes() {
    const container = document.getElementById('model-checkboxes');
    container.innerHTML = models
        .filter(model => model.enabled)
        .map(model => `
            <div class="model-checkbox">
                <input type="checkbox" id="${model.id}" value="${model.id}">
                <label for="${model.id}">${model.name}</label>
            </div>
        `).join('');
}

// 提交问题
async function submitQuestion() {
    const question = document.getElementById('question').value.trim();
    if (!question) {
        alert('请输入问题');
        return;
    }

    const selectedModels = Array.from(document.querySelectorAll('input[type="checkbox"]:checked'))
        .map(checkbox => checkbox.value);

    if (selectedModels.length === 0) {
        alert('请至少选择一个模型');
        return;
    }

    const resultsContainer = document.getElementById('results-container');
    resultsContainer.innerHTML = '';

    // 为每个选中的模型创建结果容器
    selectedModels.forEach(modelId => {
        const model = models.find(m => m.id === modelId);
        const resultBox = document.createElement('div');
        resultBox.className = 'result-box';
        resultBox.innerHTML = `
            <div class="result-header">${model.name}</div>
            <div class="result-content" id="result-${modelId}">正在生成...</div>
        `;
        resultsContainer.appendChild(resultBox);
    });

    // 并行调用所有选中的模型
    selectedModels.forEach(modelId => {
        callModel(modelId, question);
    });
}

// 调用模型API
async function callModel(modelId, question) {
    const model = models.find(m => m.id === modelId);
    const resultElement = document.getElementById(`result-${modelId}`);
    
    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: modelId,
                question: question
            })
        });

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let result = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            const chunk = decoder.decode(value);
            result += chunk;
            resultElement.textContent = result;
        }
    } catch (error) {
        console.error(`Error calling ${model.name}:`, error);
        resultElement.textContent = `错误: ${error.message}`;
    }
}

// 页面加载时初始化
document.addEventListener('DOMContentLoaded', loadConfig); 