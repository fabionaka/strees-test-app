import { get, request, RequestOptions } from "https";
import { ClientRequest } from "http";
import { hrtime } from "process"
import { Observable, Subject, throwError } from 'rxjs';
import chalk from "chalk";
import{env} from "process";



env['NODE_TLS_REJECT_UNAUTHORIZED'] = 0

export interface LoadTesterConfig {
    host: string;
    urls?: urlInfo[] | undefined,
    maxExecutions?: number;
    port?: number | undefined;
}

export interface LoaderTiming {
    startAt: [number, number];
    dnsLookupAt: [number, number] | undefined,
    tcpConnectionAt: [number, number] | undefined,
    tlsHandshakeAt: [number, number] | undefined,
    firstByteAt: [number, number] | undefined,
    endAt: [number, number] | undefined,
    total: [number, number] | undefined,
}

export interface urlInfo {
    host: string;
    path: string | undefined;
    repetitions: number;
    doneRepetitions: number;
    lastStatusCode?: number | undefined;
    lastExecution?: any;
    erros?: any[] | undefined;
}
export interface responseInfo {
    url: urlInfo;
    execution_time: string;
    status_code: number | undefined;
}

enum listUrlType {
    BLANK, ADD, CHANGE
}
enum errosMessage {
    EMPTY_URL_LIST = 'NENHUMA URL DEFINIDA',
    MAX_EXECUTION_EXCEEDED = "LIMITE MÁXIMO DE EXECUÇÃO ATINGIDO"
}

export class LoadTester implements LoadTesterConfig {
    constructor(config: LoadTesterConfig) {
        this.host = config.host;
        this.maxExecutions = config.maxExecutions;
        this.port = config.port;

        console.log(`Host:\t${this.host}`);
        console.log(`Port:\t${this.port}`);


        console.log(chalk.blue(`\nINSTÂNCIADO NOVO TESTE DE CARGA`));
        console.log(`Versão:`, chalk.yellow(this.version), `\n`);
    }
    private version: string = '0.0.0';
    host: string = '';
    port?: number | undefined = 8080;
    urls: urlInfo[] | undefined = [];
    response = new Subject<responseInfo>()
    totalExecutions: number | undefined = 0;
    maxExecutions: number | undefined = 100;

    public prepareUrls(list: string[], repetitions: number = 1, change: listUrlType = listUrlType.BLANK) {
        console.log(`NORMALIZANDO URLS`);
        let total: number = 0;
        let totalAnterior = this.urls?.length;
        // limpa urls
        this.urls = [];
        list.forEach((v, i) => {
            let url: urlInfo = {
                host: this.host,
                path: v,
                repetitions: repetitions,
                doneRepetitions: 0,
            }
            this.urls?.push(url); total++;
        });
        if (totalAnterior != this.urls?.length) {
            console.log(`URLS:\t${chalk.yellow(total)}`);
            // adicionar evento de alterado
        }

    }

    public bulkRequests(
        quantity: number = 1) {
        console.log(`BULK TEST`);
        if (this.urls?.length == 0) {
            let e = chalk.red(errosMessage.EMPTY_URL_LIST);
            throw new Error(e);
        }

        this.urls?.forEach(url => {
            // multiplica pelo total de  execuções repetidas
            url.repetitions = url.repetitions * quantity;
            if (typeof url.path !== "undefined")
                this.fetchUrl(url);
        });

        // subscription para execução
        let subscription = this.response.subscribe((data: responseInfo) => {
            console.log(`\n-- -- -- -- --`);
            console.log(`TOTAL EXERCUTADO:`, `\t`, this.totalExecutions);
            console.log('LIMITE DE EXECUÇÕES:', `\t`, this.maxExecutions)
            console.log(`-- -- -- -- --\n`);
            if ((typeof this.maxExecutions !== "undefined" && typeof this.totalExecutions !== "undefined") && this.maxExecutions <= this.totalExecutions) {
                let e = chalk.red(errosMessage.MAX_EXECUTION_EXCEEDED);
                throw new Error(e);
            }
            let urlsubscribed: urlInfo[] | undefined = this.urls?.filter(u => {
                return u.host == data.url.host && u.path === data.url.path
            })
            if (typeof urlsubscribed !== "undefined" && urlsubscribed?.length > 0) {
                urlsubscribed[0].lastStatusCode = data.status_code;
                urlsubscribed[0].doneRepetitions++;
                (urlsubscribed[0].doneRepetitions < urlsubscribed[0].repetitions) ? this.fetchUrl(urlsubscribed[0]) : null;
            }

        });
    }



    /**
     *
     *
     * @param {urlInfo} url
     * @memberof LoadTester
     */
    public fetchUrl(url: urlInfo) {
        console.log(`exec:`, `fetchUrl`)
        let timings: LoaderTiming = {
            startAt: hrtime(),
            dnsLookupAt: undefined,
            tcpConnectionAt: undefined,
            tlsHandshakeAt: undefined,
            firstByteAt: undefined,
            endAt: undefined,
            total: undefined,
        }

        let requestConfig: RequestOptions = {
            host: this.host,
            path: url.path,
            port: this.port,
            method: "GET",
            headers: { "User-Agent": "Stress Test App - Node Implementation/0.0.0" }
        };
        let requestUrl = `${this.host}`
            + `:${this.port}`
            + `${url.path}`
        let req: ClientRequest = request(requestUrl, requestConfig, (res) => {
            res.once('readable', () => {
                timings.firstByteAt = hrtime()
            })

            res.on('data', (chunk) => {
                //console.log(`BODY: ${chunk}`);
            });
            res.on('end', () => {
                (typeof this.totalExecutions !== "undefined") ? this.totalExecutions++ : null;
                timings.endAt = hrtime()
                timings.total = hrtime(timings.startAt);
                console.log(chalk.yellow(`-- RESPONSE --`))
                console.log(req.method, "-", res.statusCode, "-", req.protocol + "//" + req.host + req.path, "-", `${timings.total[1] / 1e9} s`)
                this.response.next({
                    url: url,
                    execution_time: `${timings.total[1] / 1e9} s`,
                    status_code: res.statusCode
                });



            })
        })
        req.on('socket', (socket) => {
            socket.on('lookup', () => {
                timings.dnsLookupAt = process.hrtime()
            })
            socket.on('connect', () => {
                timings.tcpConnectionAt = process.hrtime()
            })
            socket.on('secureConnect', () => {
                timings.tlsHandshakeAt = process.hrtime()
            })
        })

        req.end();
    }
}
