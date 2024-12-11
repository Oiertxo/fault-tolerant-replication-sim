/**
 * EJECUCION
 * node cliente.js nombre_cliente
*/
"use strict"

const zmq = require('zeromq');

// Lectura de la configuración
const config = require('./config.json');

// Crear un socket 'dealer' y establecer su identidad basada en el PID del proceso
const sock = zmq.socket('dealer');

// El primer argumento pasado al script es el id del cliente
const clientId = process.argv[2];

// Variables
let running = false;
let rhid = 0;
let opnum = 1;
let correctOps = 0;     // Variable para medir la productividad del cliente
let delta = 100;

// Variables auxiliares
let intervalID = null;
let manejadores = [];
for (let i = 1; i <= config.manejadores; i++) {
    manejadores.push('M' + i);
}

sock.identity = clientId;

// Conectar con el proxy
sock.connect("tcp://127.0.0.1:" + config.puerto_proxyCM_C);

// Variable auxiliar para medir lo que tarda en recibir respuestas
const START_TIME = process.hrtime();

// Enviar mensajes
const intervalReqCommand = setInterval(() => {
    ReqCommand(generaOp(opnum));
}, 10);

const msg = {
    'source': null,
    'dest': null,
    'tag': null,
    'seq': null,
    'cmd': {
        cltid: null,
        opnum: null,
        op: null
    },
    'res': null
};

/**
 * Envía una solicitud al servidor
 * @param {Object} op - Operación a ejecutar
 */
function ReqCommand(op) {
    if (!running) {
        running = true;
        rhid = eligeManejador(manejadores);

        msg.source = clientId;
        msg.dest = rhid;
        msg.tag = "REQUEST";
        msg.seq = null
        msg.cmd.cltid = clientId;
        msg.cmd.opnum = opnum;
        msg.cmd.op = op;
        msg.res = null;

        sock.send(['', JSON.stringify(msg)]);

        log_file(msg, START_TIME);

        // Timeout cada delta milisegundos
        intervalID = setInterval(() => {
            rhid = eligeManejador(manejadores.filter((manejador) => manejador !== rhid));
            msg.dest = rhid;
            sock.send(['', JSON.stringify(msg)]);
        }, delta);
    } else {
        return "Abort command";
    }
}


// Escucha respuestas del objeto
sock.on('message', function (...args) {
    // Asume que el segundo argumento es el mensaje
    if (args[1]) {
        const message = JSON.parse(args[1]);
        if (message.dest === clientId && message.tag === "REPLY" &&
            message.seq > 0 && JSON.stringify(message.cmd) === JSON.stringify(msg.cmd)
            && opnum === message.cmd.opnum) {
            clearInterval(intervalID);
            Deliver_ResCommand(message);
            opnum++;
            running = false;
        }

    } else {
        console.error("[Cliente] Unexpected message format.");
    }
});

/**
 * Entrega el mensaje a la aplicación
 * @param {Object} message - Mensaje a entregar
 */
function Deliver_ResCommand(message) {
    log_file(message);
    correctOps++;
}

/**
 * Elige aleatoriamente un manejador al que hacer la solicitud
 * @param {string[]} manejadores - Nombres de los manejadores entre los que elegir
 */
function eligeManejador(manejadores) {
    const index = Math.floor(Math.random() * manejadores.length);
    return manejadores[index];
}

/**
 * Elige aleatoriamnete entre hacer un get o un set de un valor
 * @param {Number} numOp - Número de la operación a generar
 */
function generaOp(numOp) {
    const randAux = Math.random();
    return {
        name: randAux < 0.5 ? "get" : "put",
        args: randAux < 0.5 ? "pruebas" : `pruebas valor_pruebas_${clientId}_${numOp}`
    }
}

function log_file(msg) {
    const type = msg.tag === "REQUEST" ? "inv" : "res";
    const value = msg.res;
    const n = msg.cmd.opnum;
    const id = msg.tag === "REQUEST" ? msg.source : msg.dest;

    const END_TIME = process.hrtime(START_TIME);

    const content = {
        tipo_e: type,
        op: msg.cmd.op.name,
        clave: 'r1',
        valor: value,
        n: n,
        id: id,
        t: END_TIME[0] * 1e9 + END_TIME[1]
    };
    const line = JSON.stringify(content);
    console.log(line);
}

// Cierra el socket correctamente al recibir una señal de interrupción
process.on('SIGINT', function () {
    const END_TIME = process.hrtime(START_TIME);
    const prod = correctOps / ((END_TIME[0] * 1e9 + END_TIME[1]) / 1e9);
    console.log(`Productividad del cliente ${clientId}: ${Math.round(prod * 100) / 100} msgs/s`);
    clearInterval(intervalID);
    clearInterval(intervalReqCommand);
    sock.close();
    process.exit();
});

process.on('SIGTERM', function () {
    const END_TIME = process.hrtime(START_TIME);
    const prod = correctOps / ((END_TIME[0] * 1e9 + END_TIME[1]) / 1e9);
    console.log(`Productividad del cliente ${clientId}: ${Math.round(prod * 100) / 100} msgs/s`);
    clearInterval(intervalID);
    clearInterval(intervalReqCommand);
    sock.close();
    process.exit();
});
