const axios = require('axios');

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
    } catch (error) {
        console.error("Auth Failed:", error.response ? error.response.data : error.message);
        process.exit(1);
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
    } catch (error) {
        console.error("Log sending failed:", error.response ? error.response.data : error.message);
    }
}

// Knapsack Algorithm implementation
function selectTasksForDepot(depot, vehicles) {
    const capacity = depot.MechanicHours;
    const n = vehicles.length;
    const dp = Array.from({ length: n + 1 }, () => Array(capacity + 1).fill(0));

    for (let i = 1; i <= n; i += 1) {
        const { Duration, Impact } = vehicles[i - 1];
        for (let w = 0; w <= capacity; w += 1) {
            if (Duration <= w) {
                dp[i][w] = Math.max(dp[i - 1][w], dp[i - 1][w - Duration] + Impact);
            } else {
                dp[i][w] = dp[i - 1][w];
            }
        }
    }

    const selected = [];
    let w = capacity;
    for (let i = n; i > 0; i -= 1) {
        if (dp[i][w] !== dp[i - 1][w]) {
            selected.push(vehicles[i - 1]);
            w -= vehicles[i - 1].Duration;
        }
    }

    return {
        DepotID: depot.ID,
        MaxImpact: dp[n][capacity],
        Tasks: selected.reverse(),
    };
}

async function runScheduler() {
    await authenticate();
    await Log("backend", "info", "cron_job", "Vehicle scheduler started.");

    try {
        const [depotsRes, vehiclesRes] = await Promise.all([
            axios.get(`${BASE_URL}/depots`, { headers: { Authorization: `Bearer ${authToken}` } }),
            axios.get(`${BASE_URL}/vehicles`, { headers: { Authorization: `Bearer ${authToken}` } })
        ]);

        const depots = depotsRes.data.depots;
        const vehicles = vehiclesRes.data.vehicles;

        console.log("=== Vehicle Maintenance Scheduler Output ===\n");
        
        depots.forEach(depot => {
            const result = selectTasksForDepot(depot, vehicles);
            console.log(`Depot ID: ${result.DepotID}`);
            console.log(`Available Mechanic Hours: ${depot.MechanicHours}`);
            console.log(`Max Impact Achieved: ${result.MaxImpact}`);
            console.log(`Selected Tasks:`, result.Tasks.map(t => t.TaskID).join(', '));
            console.log("------------------------------------------------");
        });

        await Log("backend", "info", "cron_job", "Vehicle scheduler completed successfully.");
    } catch (error) {
        await Log("backend", "error", "cron_job", error.message);
        console.error("Error running scheduler:", error.message);
    }
}

runScheduler();
