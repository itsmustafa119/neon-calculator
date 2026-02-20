
// MathLive Bridge
const mf = document.getElementById('math-display');

// Helper to execute commands on the math field
window.execCmd = (cmd, arg) => {
    mf.focus();
    if (arg) mf.executeCommand([cmd, arg]);
    else mf.executeCommand(cmd);
};

class Calculator {
    constructor() {
        this.history = [];
        this.speechEnabled = false; 
    }

    clear() {
        mf.setValue('');
        mf.focus();
    }

    delete() {
        mf.focus();
        mf.executeCommand('deleteBackward');
    }

    insert(text) {
        mf.focus(); // Focus BEFORE inserting
        if(text.includes('#@')) {
             mf.executeCommand(['insert', text, { selectionMode: 'placeholder' }]);
        } else {
             mf.executeCommand(['insert', text]);
        }
    }

    async compute() {
        // Get ASCII-Math or Text representation for backend
        // MathLive exports LaTeX by default, but mathjs needs clean text.
        // We can ask MathLive for "ascii-math" which is closer.
        let expression = mf.getValue('ascii-math');
        
        // Clean up ascii-math for mathjs
        // MathLive might output `sin(30)` or `(1)/(2)`
        // Mathjs handles most, but we might need tweaks.
        
        // Fallback: If ascii-math is weird, we try converting latex on backend? 
        // Let's rely on backend clean up for now, but do basic fixes.
        
        if (!expression.trim()) return;
        
        // Replace visual times/div in case
        expression = expression.replace(/\\times/g, '*').replace(/\\div/g, '/');

        try {
            const response = await fetch('/api/calculate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ expression: expression })
            });

            const data = await response.json();

            if (data.error) {
                // Shake or show error?
                console.error(data.error);
                // Maybe flash the field red?
                mf.style.boxShadow = "0 0 0 2px red";
                setTimeout(() => mf.style.boxShadow = "", 500);
            } else {
                this.addToHistory(expression, data.result);
                // Update display with result? Or keep expression and show result elsewhere?
                // Standard calc: Replace with result.
                mf.setValue(data.result.toString());
                this.speakResult(data.result);
            }
        } catch (err) {
            console.error(err);
        }
    }
    
    speakResult(text) {
        if (!this.speechEnabled) return;
        const utterance = new SpeechSynthesisUtterance(text);
        window.speechSynthesis.speak(utterance);
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
                mf.setValue(item.result.toString());
            };
            historyList.appendChild(el);
        });
    }
    
    clearHistory() {
        this.history = [];
        this.renderHistory();
    }
}

const calculator = new Calculator();

// --- Event Listeners ---

// Handle clicks on buttons with 'data-insert'
document.querySelectorAll('[data-insert]').forEach(button => {
    button.addEventListener('click', () => {
        const text = button.getAttribute('data-insert');
        calculator.insert(text);
    });
});

// Numbers
document.querySelectorAll('[data-number]').forEach(button => {
    button.addEventListener('click', () => {
        calculator.insert(button.innerText);
    });
});

document.querySelector('[data-equals]').addEventListener('click', () => calculator.compute());
document.querySelector('[data-all-clear]').addEventListener('click', () => calculator.clear());
document.querySelector('[data-delete]').addEventListener('click', () => calculator.delete());

// Keyboard
mf.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        calculator.compute();
    }
    // MathLive handles navigation and typing natively
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
        
        viewCalc.style.display = 'none'; // Flex vs None
        viewCalc.classList.remove('active');
        viewGraph.classList.remove('active');
        viewCurrency.classList.remove('active');

        if (tab.dataset.tab === 'graph') {
            viewGraph.classList.add('active');
            initGraph();
        } else if (tab.dataset.tab === 'currency') {
            viewCurrency.classList.add('active');
            initCurrency();
        } else {
            viewCalc.style.display = 'flex';
            viewCalc.classList.add('active');
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
    calculator.insert(text); // Just insert text, MathLive might interpret it
    // Or parse logically
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
    if (Object.keys(exchangeRates).length > 0) return; 

    try {
        const res = await fetch('https://api.frankfurter.app/latest?from=USD');
        const data = await res.json();
        exchangeRates = data.rates;
        exchangeRates['USD'] = 1; 
        
        const currencies = Object.keys(exchangeRates).sort();
        const fromSel = document.getElementById('curr-from');
        const toSel = document.getElementById('curr-to');
        
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

        document.getElementById('curr-amount').addEventListener('input', convertCurrency);
        fromSel.addEventListener('change', updateBaseRate); 
        toSel.addEventListener('change', convertCurrency);
        convertCurrency(); 
        
    } catch(e) {
        console.error("Currency fetch failed", e);
        document.getElementById('rate-info').innerText = "Failed to load rates.";
    }
}

async function updateBaseRate() {
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
    
    if (exchangeRates[to]) {
        const rate = exchangeRates[to];
        const result = (amount * rate).toFixed(2);
        document.getElementById('curr-result-val').value = result;
        document.getElementById('rate-info').innerText = `1 ${from} = ${rate} ${to}`;
    }
}

document.getElementById('convert-btn').addEventListener('click', convertCurrency);
