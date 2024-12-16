/**
 * EJECUCION
 * node replica.js nombre_objeto nombre_bbdd
 */
"use strict"

const zmq = require('zeromq');
const { Level } = require('level');

// Lectura de la configuración
const config = require('./config.json');

// Configuración e inicialización del socket y la base de datos
const sock = zmq.socket('dealer');

// El segundo primer argumento es el nombre del objeto
sock.identity = process.argv[2];

// El segundo argumento es el nombre de la base de datos del objeto
const db = new Level(`./dbs/${process.argv[3]}`);

// Conectar con el proxy
sock.connect("tcp://127.0.0.1:" + config.puerto_proxyMR_R);

// Variables para objetos replicados
let toexecute = new Map(); // a vector of pairs (rhid, cmd). The first index is 1. Initially, ∀i : toexecute[i] = null;
let executed = new Map();  // a vector of pairs (cmd, res). The first index is 1. Initially, ∀i : executed[i] = null;
let expectseq = 1;  // a positive integer. It indicates the first null position in toexecute. Initially, expectseq = 1
const lastSeqCliente = new Map();
for (let i = 1; i <= config.clientes; i++) {
    lastSeqCliente[`C${i}`] = 0;
}

// Función para manejar mensajes recibidos
sock.on('message', async function (...args) {
    const message = JSON.parse(args[1].toString());

    // Comprobar formato del mensaje
    if (!message) {
        console.error("[Replica] Invalid message format.");
        return;
    }

    // Descartar mensajes no dirigidos a este objeto o con secuencia incorrecta
    if (message.dest !== sock.identity || message.tag !== "TOREQUEST" || message.seq <= 0) {
        console.error("[Replica] The message is discarded.");
        return;
    }

    // Comprobar si el mensaje es el esperado

    if (message.seq === expectseq) {
        toexecute.set(expectseq, { rhid: message.source, cmd: message.cmd });

        // Ejecutar los comandos pendientes
        while (toexecute.has(expectseq) && toexecute.get(expectseq) !== null && toexecute.get(expectseq) !== undefined) {
            console.warn(toexecute.has(expectseq), toexecute.get(expectseq) !== null, toexecute.get(expectseq) !== undefined);

            // Obtener el comando a ejecutar
            const rhid = toexecute.get(expectseq).rhid, cmd = toexecute.get(expectseq).cmd;

            // Ejecutar el comando
            const res = await Execute(cmd);

            lastSeqCliente[cmd.cltid] = expectseq;

            // Preparar el mensaje de respuesta
            const resp_message = {
                source: process.argv[2],
                dest: rhid,
                tag: "TOREPLY",
                seq: expectseq,
                cmd: cmd,
                res: res,
            };

            // Añadir comando a executed
            executed.set(expectseq, { cmd: cmd, res: resp_message.res });

            // Enviar la respuesta
            sock.send(['', JSON.stringify(resp_message)]);

            console.error(`[Replica] Command executed: ${JSON.stringify(toexecute.get(expectseq))}`);
            console.error(`[Replica] To execute: `, toexecute);
            console.error(`[Replica] Seq: `, expectseq);

            // Borrar el comando ejecutado
            toexecute.delete(expectseq);

            // Actualizar expectseq
            expectseq++;
        }
        const kk = [];
        // Borrar el comando previamente ejecutado para dicho cliente
        for (let [key, value] of executed) {
            if () {
                executed.delete(key);
            }
        }
    }

    // Si el mensaje es para ejecutar en el futuro
    else if (expectseq < message.seq) {
        // Almacenar el mensaje para ejecutarlo más tarde
        toexecute.set(message.seq, { source: message.source, cmd: message.cmd });
    }

    // Si el mensaje ya fue ejecutado (ha de ser el último ejecutado)
    else if (message.seq === expectseq - 1) {
        // Obtener el comando ejecutado
        let { cmd, res } = executed.get(message.seq);

        // Preparar el mensaje de respuesta
        let msgres = {
            'source': process.argv[2],
            'dest': message.source,
            'tag': "TOREPLY",
            'seq': message.seq,
            'cmd': cmd,
            'res': res
        };

        // Enviar la respuesta
        sock.send(['', JSON.stringify(msgres)]);
    }
});

// Función para ejecutar comandos
async function Execute(cmd) {
    let res;

    switch (cmd.op.name) {
        case "put":
            const value = cmd.op.args;
            await db.put("pruebas", value)
                .then(() => {
                    res = value;
                }).catch(err => {
                    console.error("[Replica] Error on Execute-put: ", err);
                    res = `Error in database: ${err}`;
                });
            break;

        case "get":
            await db.get("pruebas")
                .then(dbResponse => {
                    res = dbResponse;
                }).catch(err => {
                    if (err.code === 'LEVEL_NOT_FOUND') {
                        res = null;
                    }
                    else {
                        console.error("[Replica] Error on Execute-get: ", err)
                        res = `Error in database: ${err}`;
                    }
                });
            break;

        default:
            res = `Error: unsupported operation: ${cmd.op.name}`;
            break;
    }
    return res;
}

// Cierra el socket correctamente al recibir una señal de interrupción
process.on('SIGINT', function () {
    // Imprime toexecute
    for (let [key, value] of executed) {
        console.log(`[Replica] executed[${key}] = ${JSON.stringify(value)}`);
    }
    console.log('[Replica] Shutting down server...');
    sock.close();
});

process.on('SIGTERM', function () {
    // Imprime toexecute
    for (let [key, value] of executed) {
        console.log(`[Replica] executed[${key}] = ${JSON.stringify(value)}`);
    }
    console.log('[Replica] Shutting down server...');
    sock.close();
});