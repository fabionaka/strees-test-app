import { readFileSync } from "fs";
import { createServer } from "https";

const options = {
    key: readFileSync('localhost+2-key.pem'),
    cert: readFileSync('localhost+2.pem'),
};
const server = createServer(options);


server.on("request", (request, res) => {
    res.writeHead(200, {
        'Content-Type': 'application/json',
        'server': "Node 18.13"
    });
    res.end(JSON.stringify({
        data: 'Hello World!',
    }));
    console.log(request.headers.host)
    console.log(request.headers['user-agent'])
});
server.listen(8000);