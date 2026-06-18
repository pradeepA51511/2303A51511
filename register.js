const http = require("http");

const postData = JSON.stringify({
    "email": "2303A51511@sru.edu.in",
    "name": "Kommidi Pradeep Reddy",
    "mobileNo": "7780473126",
    "githubUsername": "pradeepA51511",
    "rollNo": "2303A51511",
    "accessCode": "bDreAq"
});

const options = {
    hostname: '4.224.186.213',
    port: 80,
    path: '/evaluation-service/register',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
    }
};

const req = http.request(options, (res) => {
    let data = '';
    res.setEncoding('utf8');
    res.on('data', (chunk) => {
        data += chunk;
    });
    res.on('end', () => {
        console.log(`STATUS: ${res.statusCode}`);
        console.log(`BODY: ${data}`);
    });
});

req.on('error', (e) => {
    console.error(`Problem with request: ${e.message}`);
});

req.write(postData);
req.end();
