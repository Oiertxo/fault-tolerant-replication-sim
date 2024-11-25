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
const START_TIME = new Date().getTime();

// Enviar mensajes
const intervalReqCommand = setInterval(() => {
    ReqCommand(generaOp(clientId));
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
        const message = JSON.parse(args[1])
        console.log("[Cliente] Received: ", message);
        if (message.dest === clientId && message.tag === "REPLY" &&
            message.seq > 0 && JSON.stringify(message.cmd) === JSON.stringify(msg.cmd)) {
            clearInterval(intervalID);
            running = false;
            opnum++;
            Deliver_ResCommand(message);
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
    log_file(message, START_TIME);
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
 * 
 */
function generaOp(numOp) {
    const randAux = Math.random();
    return {
        name: randAux < 0.5 ? "get" : "put",
        args: randAux < 0.5 ? "pruebas" : `pruebas valor_pruebas_${clientId}_${numOp}`
    }
}

function log_file(msg, start_time) {
    const type = msg.tag === "REQUEST" ? "inv" : "res";
    const key = msg.tag === "REQUEST" ? msg.dest : msg.source;
    const value = msg.tag === "REQUEST" ? msg.cmd.op.args : msg.res;
    const n = msg.cmd.opnum;
    const id = msg.tag === "REQUEST" ? msg.source : msg.dest;

    const content = {
        tipo_e: type,
        op: msg.cmd.op.name,
        clave: key,
        valor: value,
        n: n,
        id: id,
        t: new Date().getTime() - start_time
    };
    const line = JSON.stringify(content) + "\n";
    console.log(line);
}

// Cierra el socket correctamente al recibir una señal de interrupción
process.on('SIGINT', function () {
    console.log('[Cliente] Closing client socket...');
    clearInterval(intervalID);
    clearInterval(intervalReqCommand);
    sock.close();
    process.exit();
});

process.on('SIGTERM', function () {
    console.log('[Cliente] Closing client socket...');
    clearInterval(intervalID);
    clearInterval(intervalReqCommand);
    sock.close();
    process.exit();
});
