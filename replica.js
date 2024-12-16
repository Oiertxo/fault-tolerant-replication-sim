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
const lastSeqCliente = new Map();   // Map with the sequence number of the last executed command for each Client. 

for (let i = 1; i <= config.clientes; i++) {
    lastSeqCliente.set(`C${i}`, 0);
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
        while (toexecute.get(expectseq) !== null && toexecute.get(expectseq) !== undefined) {

            // Obtener el comando a ejecutar
            const rhid = toexecute.get(expectseq).rhid, cmd = toexecute.get(expectseq).cmd;

            // Ejecutar el comando
            const res = await Execute(cmd);

            lastSeqCliente.set(cmd.cltid, expectseq);

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

            // Borrar el comando ejecutado
            toexecute.delete(expectseq);

            // Actualizar expectseq
            expectseq++;
        }

        // Borrar los comandos previamente ejecutados para dicho cliente (Al hacer la petición
        // del comando n nunca va a pedir uno anterior. Si lo pide un manejador nos da igual)
        for (let [key, value] of executed) {
            if (!Array.from(lastSeqCliente.values()).some(v => v === key)) {
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
    else if (message.seq === expectseq - 1
        && toexecute.get(expectseq - 1) !== null
        && toexecute.get(expectseq - 1) !== undefined) {
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
            const values = cmd.op.args.split(" ");
            await db.put(values[0], values[1])
                .then(() => {
                    res = values[1];
                }).catch(err => {
                    console.error("[Replica] Error on Execute-put: ", err);
                    res = `Error in database: ${err}`;
                });
            break;

        case "get":
            await db.get(cmd.op.args)
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
    console.log('[Replica] Shutting down server...');
    console.log('[Replica] executed: ', executed);
    console.log('[Replica] toexecute: ', toexecute);

    sock.close();
});

process.on('SIGTERM', function () {
    console.log('[Replica] Shutting down server...');
    console.log('[Replica] executed: ', executed);
    console.log('[Replica] toexecute: ', toexecute);

    sock.close();
});