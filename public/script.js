class Calculator {
    constructor(previousOperandTextElement, currentOperandTextElement) {
        this.previousOperandTextElement = previousOperandTextElement;
        this.currentOperandTextElement = currentOperandTextElement;
        this.clear();
        this.history = [];
        this.speechEnabled = false; // Default off
    }

    clear() {
        this.currentOperand = '';
        this.previousOperand = '';
        this.operation = undefined;
        this.fullExpression = ''; 
        this.resetDisplay = false;
        this.updateDisplay();
    }

    delete() {
        if (this.resetDisplay) {
            this.currentOperand = '';
            this.resetDisplay = false;
            return;
        }
        this.currentOperand = this.currentOperand.toString().slice(0, -1);
        this.updateDisplay();
    }

    appendNumber(number) {
        if (this.resetDisplay) {
            this.currentOperand = number.toString();
            this.resetDisplay = false;
        } else {
            if (number === '.' && this.currentOperand.includes('.')) return;
            this.currentOperand = this.currentOperand.toString() + number.toString();
        }
        this.updateDisplay();
    }

    chooseOperation(operation) {
        if (this.currentOperand === '' && operation !== '-' && !operation.includes('(')) return;

        if (this.currentOperand !== '') {
            this.fullExpression += this.currentOperand + ' ' + operation + ' ';
        } else {
             this.fullExpression += operation + ' ';
        }
        
        this.previousOperand = this.fullExpression; 
        this.currentOperand = '';
        this.updateDisplay();
    }

    appendFunction(func) {
        if (this.resetDisplay) {
            this.fullExpression = '';
            this.resetDisplay = false;
        }
        
        if (this.currentOperand !== '') {
            this.fullExpression += this.currentOperand + ' * ' + func;
        } else {
            this.fullExpression += func;
        }
        
        this.currentOperand = ''; 
        this.previousOperand = this.fullExpression;
        this.updateDisplay();
    }
    
    appendOperator(op) {
        if (this.resetDisplay) {
            this.fullExpression = this.currentOperand; 
            this.resetDisplay = false;
        }

        if (this.currentOperand !== '') {
            this.fullExpression += this.currentOperand;
        }
        
        this.fullExpression += ` ${op} `;
        this.currentOperand = '';
        this.previousOperand = this.fullExpression;
        this.updateDisplay();
    }

    async compute() {
        let expressionToSend = this.fullExpression + this.currentOperand;
        if (!expressionToSend.trim()) return;

        try {
            const response = await fetch('/api/calculate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ expression: expressionToSend })
            });

            const data = await response.json();

            if (data.error) {
                this.currentOperand = 'Error';
                this.resetDisplay = true;
                this.fullExpression = '';
            } else {
                this.addToHistory(expressionToSend, data.result);
                this.currentOperand = data.result;
                this.previousOperand = '';
                this.fullExpression = ''; 
                this.resetDisplay = true;
                this.speakResult(data.result);
            }
        } catch (err) {
            console.error(err);
            this.currentOperand = 'Error';
        }
        this.updateDisplay();
    }
    
    speakResult(text) {
        if (!this.speechEnabled) return;
        const utterance = new SpeechSynthesisUtterance(text);
        window.speechSynthesis.speak(utterance);
    }

    getDisplayNumber(number) {
        if (number === 'Error') return 'Error';
        const stringNumber = number.toString();
        if (stringNumber.length > 12) return parseFloat(stringNumber).toPrecision(10);
        
        const integerDigits = parseFloat(stringNumber.split('.')[0]);
        const decimalDigits = stringNumber.split('.')[1];
        let integerDisplay;
        if (isNaN(integerDigits)) {
            integerDisplay = '';
        } else {
            integerDisplay = integerDigits.toLocaleString('en', { maximumFractionDigits: 0 });
        }
        if (decimalDigits != null) {
            return `${integerDisplay}.${decimalDigits}`;
        } else {
            return integerDisplay;
        }
    }

    updateDisplay() {
        this.currentOperandTextElement.innerText = this.getDisplayNumber(this.currentOperand) || '0';
        this.previousOperandTextElement.innerText = this.fullExpression || '';
    }

    addToHistory(expression, result) {
        const historyItem = { expression, result, timestamp: new Date() };
        this.history.unshift(historyItem);
        this.renderHistory();
    }

    renderHistory() {
        const historyList = document.getElementById('history-list');
        historyList.innerHTML = '';

        if (this.history.length === 0) {
            historyList.innerHTML = '<div class="empty-state">No calculations yet</div>';
            return;
        }

        this.history.forEach(item => {
            const el = document.createElement('div');
            el.className = 'history-item';
            el.innerHTML = `
                <div class="history-expression">${item.expression} =</div>
                <div class="history-result">${item.result}</div>
            `;
            el.onclick = () => {
                this.currentOperand = item.result;
                this.updateDisplay();
            };
            historyList.appendChild(el);
        });
    }
    
    clearHistory() {
        this.history = [];
        this.renderHistory();
    }
}

// --- DOM ELEMENTS ---
const previousOperandTextElement = document.querySelector('[data-previous-operand]');
const currentOperandTextElement = document.querySelector('[data-current-operand]');
const calculator = new Calculator(previousOperandTextElement, currentOperandTextElement);

// --- EVENT LISTENERS ---
document.querySelectorAll('[data-number]').forEach(button => {
    button.addEventListener('click', () => {
        calculator.appendNumber(button.innerText);
    });
});
document.querySelectorAll('[data-operation]').forEach(button => {
    button.addEventListener('click', () => {
        const op = button.getAttribute('data-operation');
        if(['+', '-', '*', '/', '^'].includes(op)) {
             calculator.appendOperator(op);
        } else if (['sin()', 'cos()', 'tan()', 'sqrt()'].includes(op)) {
             calculator.appendFunction(op.replace('()', '(')); 
        } else {
            calculator.appendOperator(op);
        }
    });
});
document.querySelector('[data-equals]').addEventListener('click', () => calculator.compute());
document.querySelector('[data-all-clear]').addEventListener('click', () => calculator.clear());
document.querySelector('[data-delete]').addEventListener('click', () => calculator.delete());

// Keyboard
document.addEventListener('keydown', (e) => {
    if ((e.key >= 0 && e.key <= 9) || e.key === '.') {
        calculator.appendNumber(e.key);
    }
    if (['+', '-', '*', '/', '^', '(', ')'].includes(e.key)) {
        calculator.appendOperator(e.key);
    }
    if (e.key === 'Enter' || e.key === '=') {
        e.preventDefault();
        calculator.compute();
    }
    if (e.key === 'Backspace') {
        calculator.delete();
    }
    if (e.key === 'Escape') {
        calculator.clear();
    }
});

// --- Tab Switching ---
const tabs = document.querySelectorAll('.tab-btn');
const viewCalc = document.getElementById('view-calc');
const viewGraph = document.getElementById('view-graph');
const viewCurrency = document.getElementById('view-currency');

tabs.forEach(tab => {
    tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        
        viewCalc.style.display = 'none';
        viewGraph.classList.remove('active');
        viewCurrency.classList.remove('active');

        if (tab.dataset.tab === 'graph') {
            viewGraph.classList.add('active');
            initGraph();
        } else if (tab.dataset.tab === 'currency') {
            viewCurrency.classList.add('active');
            initCurrency();
        } else {
            viewCalc.style.display = 'block';
        }
    });
});

// --- History Panel ---
const historyPanel = document.getElementById('history-panel');
document.getElementById('history-toggle').addEventListener('click', () => {
    historyPanel.classList.add('open');
});
document.getElementById('close-history').addEventListener('click', () => {
    historyPanel.classList.remove('open');
});
document.getElementById('clear-history').addEventListener('click', () => {
    calculator.clearHistory();
});

// --- Voice Control & TTS ---
const voiceBtn = document.getElementById('voice-btn');
const speakToggle = document.getElementById('speak-toggle');

// TTS Toggle
speakToggle.addEventListener('click', () => {
    calculator.speechEnabled = !calculator.speechEnabled;
    speakToggle.classList.toggle('speaking');
    const icon = speakToggle.querySelector('ion-icon');
    icon.setAttribute('name', calculator.speechEnabled ? 'volume-high' : 'volume-mute-outline');
});

if ('webkitSpeechRecognition' in window) {
    const recognition = new webkitSpeechRecognition();
    recognition.continuous = false;
    recognition.lang = 'en-US';

    voiceBtn.addEventListener('click', () => {
        recognition.start();
        voiceBtn.classList.add('listening');
    });

    recognition.onresult = (event) => {
        voiceBtn.classList.remove('listening');
        const transcript = event.results[0][0].transcript;
        processVoiceInput(transcript);
    };

    recognition.onerror = () => voiceBtn.classList.remove('listening');
    recognition.onend = () => voiceBtn.classList.remove('listening');
} else {
    voiceBtn.style.display = 'none';
}

function processVoiceInput(text) {
    let processed = text.toLowerCase();
    processed = processed.replace(/plus/g, '+').replace(/minus/g, '-').replace(/times/g, '*').replace(/divided by/g, '/');
    const wordsToNum = { 'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5, 'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'zero': 0 };
    for (const [word, num] of Object.entries(wordsToNum)) {
        processed = processed.replace(new RegExp(`\\b${word}\\b`, 'g'), num);
    }
    calculator.fullExpression = processed;
    calculator.currentOperand = '';
    calculator.compute();
}

// --- Graphing Logic ---
let myChart = null;
function initGraph() {
    const ctx = document.getElementById('graphCanvas').getContext('2d');
    if (myChart) return; 

    myChart = new Chart(ctx, {
        type: 'line',
        data: {
            datasets: [{
                label: 'f(x)',
                data: [],
                borderColor: '#3b82f6',
                borderWidth: 2,
                pointRadius: 0,
                fill: false,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { type: 'linear', position: 'center' },
                y: { type: 'linear', position: 'center', reverse: false }
            },
            plugins: {
                zoom: {
                    zoom: {
                        wheel: { enabled: true },
                        pinch: { enabled: true },
                        mode: 'xy',
                    },
                    pan: { enabled: true, mode: 'xy' }
                }
            }
        }
    });
}

function addGraphFunc(func) {
    document.getElementById('graph-input').value = func;
    document.getElementById('plot-btn').click();
}

function resetZoom() {
    if(myChart) myChart.resetZoom();
}

document.getElementById('plot-btn').addEventListener('click', async () => {
    const expr = document.getElementById('graph-input').value; 
    if (!expr) return;
    try {
        const response = await fetch('/api/plot', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ expression: expr, xRange: [-20, 20], step: 0.2 })
        });
        const data = await response.json();
        if (data.points) {
            myChart.data.labels = data.points.map(p => p.x);
            myChart.data.datasets[0].data = data.points.map(p => p.y);
            myChart.update();
        }
    } catch (e) { console.error("Graph error", e); }
});

// --- Currency Logic ---
let exchangeRates = {};

async function initCurrency() {
    if (Object.keys(exchangeRates).length > 0) return; // Already loaded

    try {
        const res = await fetch('https://api.frankfurter.app/latest?from=USD');
        const data = await res.json();
        exchangeRates = data.rates;
        exchangeRates['USD'] = 1; // Base
        
        // Populate Selects
        const currencies = Object.keys(exchangeRates).sort();
        const fromSel = document.getElementById('curr-from');
        const toSel = document.getElementById('curr-to');
        
        // Clear existing options first to be safe, though HTML has some defaults
        fromSel.innerHTML = '';
        toSel.innerHTML = '';

        currencies.forEach(curr => {
            const opt1 = document.createElement('option');
            opt1.value = curr;
            opt1.innerText = curr;
            if(curr === 'USD') opt1.selected = true;
            fromSel.appendChild(opt1);

            const opt2 = document.createElement('option');
            opt2.value = curr;
            opt2.innerText = curr;
            if(curr === 'EUR') opt2.selected = true;
            toSel.appendChild(opt2);
        });

        // Add Listeners for live update
        document.getElementById('curr-amount').addEventListener('input', convertCurrency);
        fromSel.addEventListener('change', updateBaseRate); // Need to re-fetch if base changes? No, use cross-calc
        toSel.addEventListener('change', convertCurrency);
        convertCurrency(); // Initial
        
    } catch(e) {
        console.error("Currency fetch failed", e);
        document.getElementById('rate-info').innerText = "Failed to load rates.";
    }
}

async function updateBaseRate() {
     // Frankfurter free API only supports EUR as base for historical, but latest supports conversion?
     // Actually frankfurter base is EUR by default but we requested ?from=USD. 
     // For simplicity, we can fetch new rates when 'from' changes OR do math locally if we had all pairs. 
     // Simplest: just Re-fetch with new base.
     const newBase = document.getElementById('curr-from').value;
     try {
         const res = await fetch(`https://api.frankfurter.app/latest?from=${newBase}`);
         const data = await res.json();
         exchangeRates = data.rates;
         exchangeRates[newBase] = 1; 
         convertCurrency();
     } catch(e) { console.error(e); }
}

function convertCurrency() {
    const amount = parseFloat(document.getElementById('curr-amount').value) || 0;
    const from = document.getElementById('curr-from').value;
    const to = document.getElementById('curr-to').value;
    
    // logic: fetch was based on 'from' so exchangeRates[to] is the rate.
    // If we re-fetched on change, exchangeRates is correct.
    
    if (exchangeRates[to]) {
        const rate = exchangeRates[to];
        const result = (amount * rate).toFixed(2);
        document.getElementById('curr-result-val').value = result;
        document.getElementById('rate-info').innerText = `1 ${from} = ${rate} ${to}`;
    }
}

document.getElementById('convert-btn').addEventListener('click', convertCurrency);
document.getElementById('swap-curr').addEventListener('click', () => {
    const from = document.getElementById('curr-from');
    const to = document.getElementById('curr-to');
    const temp = from.value;
    from.value = to.value;
    to.value = temp;
    updateBaseRate(); // fetch new rates
});
