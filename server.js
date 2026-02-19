const express = require('express');
const math = require('mathjs'); // We'll need to install this: npm install mathjs
const path = require('path');
const app = express();
const port = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// API Endpoint for calculation
app.post('/api/calculate', (req, res) => {
    const { expression } = req.body;

    if (!expression) {
        return res.status(400).json({ error: 'Expression is required' });
    }

    try {
        // Sanitize input (basic check) although math.evaluate is safer than eval()
        // Replace visual operators with math operators if needed, though frontend should send clean data
        // For example, '×' to '*' and '÷' to '/'
        let cleanExpression = expression
            .replace(/×/g, '*')
            .replace(/÷/g, '/');

        // Evaluate using mathjs for safe and powerful math parsing
        const result = math.evaluate(cleanExpression);

        // Return result
        res.json({ result: result });
    } catch (error) {
        console.error("Calculation Error:", error.message);
        res.status(400).json({ error: 'Invalid Expression', details: error.message });
    }
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});
