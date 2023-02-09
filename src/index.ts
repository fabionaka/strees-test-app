import { Worker } from "worker_threads";
import { LoadTester } from "./classes/tester/Tester";

let t: LoadTester = new LoadTester({ host: 'https://localhost', maxExecutions: 200, port: 8000 })

t.prepareUrls([
    "/rest/diagnostics",
    "/rest/aplicativos/self",
    "/rest/params-front/gestores",
], 1);

t.bulkRequests(100); 