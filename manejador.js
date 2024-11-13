/**
 * node manejador.js id_manejador conjunto_de_replicas
 */
"use strict"
const conf = require("./config.json"),
    zmq = require('zeromq'),
    config = require('./config.json');


// Crear y configurar el socket con el proxy hacia clientes
const sock = zmq.socket('dealer');


// Crear y configurar el socket con el proxy hacia clientes
const sock = zmq.socket('dealer');


// STATE variables
const sequenced = [],
    myCommands = new Set(),
    myReplies = new Set();
let localSeq = 1,
    lastServedSeq = 0;

//ACTIONS

