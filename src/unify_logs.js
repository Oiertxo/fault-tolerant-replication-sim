const fs = require('fs');
const path = require('path');
const conf = require("../config/config.json");

// Función para leer y parsear los archivos de log
const leerLogs = (archivos) => {
    let eventos = [];

    archivos.forEach((archivo) => {
        const rutaArchivo = path.join(__dirname, archivo);

        try {
            // Leemos el archivo línea por línea
            const datos = fs.readFileSync(rutaArchivo, 'utf-8').split('\n');

            // Procesamos cada línea
            datos.forEach((linea) => {
                if (linea.trim() && !linea.includes('Productividad')) { // Ignoramos líneas vacías o de resumen
                    try {
                        const evento = JSON.parse(linea); // Convertimos cada línea en un objeto JSON
                        eventos.push(evento);
                    } catch (error) {
                        console.error(`Error al parsear línea: ${linea}`);
                    }
                }
            });
        } catch (error) {
            console.error(`Error al leer el archivo ${archivo}: ${error.message}`);
        }
    });

    return eventos;
};

// Nombres de los archivos de log

const archivos = [];

for (let i = 1; i <= conf.clientes; i++) archivos.push(`../tests/logs/C${i}.log`);

// Leemos los eventos de los archivos
const eventos = leerLogs(archivos);

// Ordenamos los eventos por el campo 't' (tiempo)
eventos.sort((a, b) => a.t - b.t);

// Imprimimos los eventos ordenados
eventos.forEach(evento => {
    console.log(JSON.stringify(evento));
});