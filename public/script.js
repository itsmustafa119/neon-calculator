class Calculator {
    constructor(previousOperandTextElement, currentOperandTextElement) {
        this.previousOperandTextElement = previousOperandTextElement;
        this.currentOperandTextElement = currentOperandTextElement;
        this.clear();
        this.history = [];
    }

    clear() {
        this.currentOperand = '';
        this.previousOperand = '';
        this.operation = undefined;
        this.fullExpression = ''; // Track full string for API
        this.resetDisplay = false;
    }

    delete() {
        if (this.resetDisplay) {
            this.currentOperand = '';
            this.resetDisplay = false;
            return;
        }
        this.currentOperand = this.currentOperand.toString().slice(0, -1);
    }

    appendNumber(number) {
        if (this.resetDisplay) {
            this.currentOperand = number.toString();
            this.resetDisplay = false;
        } else {
            if (number === '.' && this.currentOperand.includes('.')) return;
            this.currentOperand = this.currentOperand.toString() + number.toString();
        }
    }

    chooseOperation(operation) {
        // Allow starting with negative or scientific functions
        if (this.currentOperand === '' && operation !== '-' && !operation.includes('(')) return;

        // Visual update
        if (this.currentOperand !== '') {
            this.fullExpression += this.currentOperand + ' ' + operation + ' ';
        } else {
            // Handling case where we change operator or start with one 
            // (Simple logic: just append for now, backend will parse)
            this.fullExpression += operation + ' ';
        }

        this.previousOperand = this.fullExpression;
        this.currentOperand = '';
    }

    // New Append for Scientific Functions (sin, cos, etc.)
    appendFunction(func) {
        if (this.resetDisplay) {
            this.fullExpression = '';
            this.resetDisplay = false;
        }

        // If we have a current operand, assume multiplication? Or just append
        // E.g., 5 sin(30) -> 5 * sin(30)
        if (this.currentOperand !== '') {
            this.fullExpression += this.currentOperand + ' * ' + func;
        } else {
            this.fullExpression += func;
        }

        this.currentOperand = ''; // Ready for inner number
        this.previousOperand = this.fullExpression;
        this.updateDisplay();
    }

    // Append simple operator or parens
    appendOperator(op) {
        if (this.resetDisplay) {
            this.fullExpression = this.currentOperand; // Start new with result if valid
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
        // Finalize expression
        let expressionToSend = this.fullExpression + this.currentOperand;

        // Clean up visual operators for backend (though backend does some too)
        // We use backend for robust parsing

        if (!expressionToSend.trim()) return;

        try {
            const response = await fetch('/api/calculate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ expression: expressionToSend })
            });

            const data = await response.json();

            if (data.error) {
                // simple visual error
                this.currentOperand = 'Error';
                this.resetDisplay = true;
                this.fullExpression = '';
            } else {
                this.addToHistory(expressionToSend, data.result);
                this.currentOperand = data.result;
                this.previousOperand = '';
                this.fullExpression = ''; // Reset full expression, result becomes start of new one
                this.resetDisplay = true;
            }
        } catch (err) {
            console.error(err);
            this.currentOperand = 'Error';
        }
        this.updateDisplay();
    }

    getDisplayNumber(number) {
        if (number === 'Error') return 'Error';
        const stringNumber = number.toString();
        // If science notation or too long, just return string
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
        this.currentOperandTextElement.innerText = this.getDisplayNumber(this.currentOperand);
        // Show the building expression in the top (previous) line
        this.previousOperandTextElement.innerText = this.fullExpression || '';
    }

    addToHistory(expression, result) {
        const historyItem = { expression, result, timestamp: new Date() };
        this.history.unshift(historyItem); // Add to top
        this.renderHistory();
    }

    renderHistory() {
        const historyList = document.getElementById('history-list');
        historyList.innerHTML = ''; // Clear current list

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
            // Click to load result back? (Optional enhancement)
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

// --- DOM ELEM ---
const numberButtons = document.querySelectorAll('[data-number]');
const operationButtons = document.querySelectorAll('[data-operation]'); // Covers science too if attr matches
const scienceButtons = document.querySelectorAll('.function-science');
const equalsButton = document.querySelector('[data-equals]');
const deleteButton = document.querySelector('[data-delete]');
const allClearButton = document.querySelector('[data-all-clear]');
const previousOperandTextElement = document.querySelector('[data-previous-operand]');
const currentOperandTextElement = document.querySelector('[data-current-operand]');

const calculator = new Calculator(previousOperandTextElement, currentOperandTextElement);

// --- Event Listeners ---

numberButtons.forEach(button => {
    button.addEventListener('click', () => {
        calculator.appendNumber(button.innerText);
        calculator.updateDisplay();
    });
});

// Distinguish between simple ops (+ - * /) and science/parens
operationButtons.forEach(button => {
    button.addEventListener('click', () => {
        const op = button.getAttribute('data-operation'); // use attribute for clean value
        if (['+', '-', '*', '/', '^'].includes(op)) {
            calculator.appendOperator(op);
        } else if (['sin()', 'cos()', 'tan()', 'sqrt()'].includes(op)) {
            calculator.appendFunction(op.replace('()', '(')); // remove closing paren for user to type num
        } else {
            // parens
            calculator.appendOperator(op);
        }
    });
});

equalsButton.addEventListener('click', button => {
    calculator.compute();
});

allClearButton.addEventListener('click', button => {
    calculator.clear();
    calculator.updateDisplay();
});

deleteButton.addEventListener('click', button => {
    calculator.delete();
    calculator.updateDisplay();
});

// --- Theme Toggle ---
const themeToggle = document.getElementById('theme-toggle');
themeToggle.addEventListener('click', () => {
    document.body.classList.toggle('light-mode');
});

// --- History Panel ---
const historyPanel = document.getElementById('history-panel');
const historyToggle = document.getElementById('history-toggle');
const closeHistory = document.getElementById('close-history');
const clearHistoryBtn = document.getElementById('clear-history');

historyToggle.addEventListener('click', () => {
    historyPanel.classList.add('open');
});

closeHistory.addEventListener('click', () => {
    historyPanel.classList.remove('open');
});

clearHistoryBtn.addEventListener('click', () => {
    calculator.clearHistory();
});


// --- Keyboard Support (Enhanced) ---
document.addEventListener('keydown', (e) => {
    if ((e.key >= 0 && e.key <= 9) || e.key === '.') {
        calculator.appendNumber(e.key);
        calculator.updateDisplay();
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
        calculator.updateDisplay();
    }
    if (e.key === 'Escape') {
        calculator.clear();
        calculator.updateDisplay();
    }
});
