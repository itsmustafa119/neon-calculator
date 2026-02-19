const express = require('express');
const math = require('mathjs');
const path = require('path');
const app = express();
const port = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// API Endpoint for calculation
app.post('/api/calculate', (req, res) => {
    const { expression } = req.body;
    console.log(`[Request] Expression: "${expression}"`);

    if (!expression) {
        return res.status(400).json({ error: 'Expression is required' });
    }

    try {
        // cleanup visual operators
        // Replace 'x' or '×' with '*'
        // Replace '÷' with '/'
        // Replace 'sin(' with 'sin(deg ' to use degrees? No, let's stick to radians for now or handle unit if user wants.
        // Actually, let's keep it simple: mathjs uses radians.

        let cleanExpression = expression
            .replace(/×/g, '*')
            .replace(/÷/g, '/');

        // Check for balanced parentheses
        const openParens = (cleanExpression.match(/\(/g) || []).length;
        const closeParens = (cleanExpression.match(/\)/g) || []).length;
        if (openParens > closeParens) {
            cleanExpression += ')'.repeat(openParens - closeParens);
            console.log(`[Auto-Fix] Closing parens: "${cleanExpression}"`);
        }

        const result = math.evaluate(cleanExpression);

        console.log(`[Success] Result: ${result}`);
        res.json({ result: result });

    } catch (error) {
        console.error(`[Error] ${error.message}`);
        res.status(400).json({
            error: 'Invalid Expression',
            details: error.message
        });
    }
});

// Graph Plotting Endpoint
app.post('/api/plot', (req, res) => {
    const { expression, xRange, step } = req.body;
    let points = [];
    
    if (!expression || !xRange) return res.status(400).json({error: 'Invalid request'});
    
    try {
        const compiled = math.compile(expression);
        
        for (let x = xRange[0]; x <= xRange[1]; x += step) {
            try {
                let y = compiled.evaluate({x: x});
                points.push({x, y});
            } catch (e) {
                // ignore points outside domain
            }
        }
        res.json({ points });
    } catch (e) {
        res.status(400).json({ error: 'Plot error' });
    }
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});
