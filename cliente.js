/**
 * EJECUCION
 * node cliente.js nombre_cliente
 */
"use strict"

const zmq = require('zeromq');
const fs = require('node:fs');

const date = new Date();

// Objetos con los que se puede comunicar el cliente
const OBJETOS = ["O1", "O2", "O3"];

// Crear un socket 'dealer' y establecer su identidad basada en el PID del proceso
const sock = zmq.socket('dealer');

// El primer argumento pasado al script es el id del cliente
const clientId = process.argv[2];

// Nombre del fichero donde guardar el log
const FILE_NAME = `./logs/log_${clientId}.txt`;

// Crear el fichero o vaciarlo si ya existe
if (!fs.existsSync("./logs")) fs.mkdirSync("logs", () => { });
fs.writeFileSync(FILE_NAME, "", (e) => {
    if (e) {
        console.log(`Error al crear fichero: ${e}`);
    }
});

sock.identity = clientId;

sock.connect("tcp://127.0.0.1:1112");

const objeto = eligeOb(OBJETOS);

let op = generaOp(1);

// cmd con el id del cliente, numero de operacion y la operacion
const cmd = {
    cltid: clientId,
    opnum: 1,
    op: op
}

// Variable auxiliar para medir lo que tarda en recibir respuestas
const START_TIME = date.getTime();

// Envía un mensaje al objeto basado en argumentos pasados al script
getFromServer(objeto, cmd, START_TIME, FILE_NAME);

// Escucha respuestas del objeto
sock.on('message', function (...args) {
    // Asume que el segundo argumento es el mensaje
    if (args[1]) {
        const message = JSON.parse(args[1])
        log_file(FILE_NAME, message, START_TIME);
        console.log(message.dest, "\x1b[35m: Respuesta recibida de:\x1b[0m", message.source);
        cmd.opnum++;
        cmd.op = generaOp(cmd.opnum);
        if (cmd.opnum < 11) {
            getFromServer(eligeOb(OBJETOS), cmd, START_TIME, FILE_NAME);
        }
    } else {
        console.error("Unexpected message format.");
    }
});



/**
 * Elige aleatoriamente un objeto al que hacer la solicitud
 * @param {string[]} objetos - Nombres de los objetos entre los que elegir
 */
function eligeOb(objetos) {
    const index = Math.floor(Math.random() * objetos.length);
    return objetos[index];
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

/**
 * Envía un mensaje estructurado al objeto.
 * @param {string} objeto - El objeto de destino.
 * @param {object} cmd - El comando a realizar.
 */
function getFromServer(objeto, cmd, start_time, file_name) {
    const message = {
        'source': sock.identity,
        'dest': objeto,
        'tag': "REQUEST",
        'cmd': cmd,
        'res': null
    };
    sock.send(['', JSON.stringify(message)]);
    log_file(file_name, message, start_time);
    console.log(message.source, "\x1b[35m: Solicitud hecha a: \x1b[0m", message.dest);
}

function log_file(name, msg, start_time) {
    const type = msg.tag === "REQUEST" ? "inv" : "res";
    const key = msg.tag === "REQUEST" ? msg.dest : msg.source;
    const value = msg.tag === "REQUEST" ? msg.cmd.op.args : msg.res;
    const n = msg.cmd.opnum;
    const id = msg.tag === "REQUEST" ? msg.source : msg.dest;

    const content = {
        tipo_e: type,
        op: cmd.op.name,
        clave: key,
        valor: value,
        n: n,
        id: id,
        t: new Date().getTime() - start_time
    };
    const line = JSON.stringify(content) + "\n";

    fs.writeFileSync(name, line, { flag: "a+" }, (e) => {
        if (e) {
            console.log(`Error al escribir en fichero: ${e}`);
        }
    });
}

// Cierra el socket correctamente al recibir una señal de interrupción
process.on('SIGINT', function () {
    console.log('Closing client socket...');
    sock.close();
});

process.on('SIGTERM', function () {
    console.log('Closing client socket...');
    sock.close();
});
