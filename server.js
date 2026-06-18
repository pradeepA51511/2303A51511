const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

const BASE_URL = 'http://4.224.186.213/evaluation-service';

const credentials = {
    email: "2303A51511@sru.edu.in",
    name: "Kommidi Pradeep Reddy",
    rollNo: "2303A51511",
    accessCode: "bDreAq",
    clientID: "2b825203-9216-4e6b-8415-53e9195ba76b",
    clientSecret: "hAYxdkfgPMBhvADm"
};

let authToken = null;

async function authenticate() {
    try {
        const response = await axios.post(`${BASE_URL}/auth`, credentials);
        authToken = response.data.access_token;
        console.log("Authentication successful.");
    } catch (error) {
        console.error("Auth Failed:", error.response ? error.response.data : error.message);
    }
}

// Reusable Logging Middleware Function
async function Log(stack, level, pkg, message) {
    if (!authToken) await authenticate();
    try {
        await axios.post(`${BASE_URL}/logs`, {
            stack, level, package: pkg, message
        }, {
            headers: { Authorization: `Bearer ${authToken}` }
        });
        console.log(`[LOG] ${level}: ${message}`);
    } catch (error) {
        console.error("Log sending failed:", error.response ? error.response.data : error.message);
    }
}

// Express Middleware for logging incoming requests
app.use(async (req, res, next) => {
    await Log("backend", "info", "middleware", `Incoming request to ${req.path}`);
    next();
});

const TYPE_WEIGHTS = { Placement: 3, Result: 2, Event: 1 };

app.get('/priority-inbox', async (req, res) => {
    try {
        if (!authToken) await authenticate();
        
        const response = await axios.get(`${BASE_URL}/notifications`, {
            headers: { Authorization: `Bearer ${authToken}` }
        });

        const notifications = response.data.notifications || [];
        const limit = Number(req.query.n) || 10;
        const now = Date.now();

        const inbox = notifications.map(item => {
            // Reformat timestamp to be parsed correctly in some environments if needed
            const createdAt = Date.parse(item.Timestamp.replace(' ', 'T') + 'Z');
            const ageHours = Math.max(0, (now - createdAt) / 36e5);
            const recencyScore = Math.max(0, 24 - ageHours) / 24;
            const weight = TYPE_WEIGHTS[item.Type] || 1;
            
            return {
                ...item,
                score: (weight * 0.75) + (recencyScore * 0.25)
            };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map(({ score, ...rest }) => rest);

        await Log("backend", "info", "controller", `Priority inbox fetched ${limit} items`);
        res.json({ notifications: inbox });
    } catch (error) {
        await Log("backend", "error", "handler", error.message);
        res.status(500).json({ error: "Failed to fetch notifications" });
    }
});

const PORT = 4000;
app.listen(PORT, async () => {
    await authenticate();
    await Log("backend", "info", "config", `Server started on port ${PORT}`);
    console.log(`Server listening on port ${PORT}`);
});
