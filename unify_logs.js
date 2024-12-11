const fs = require('fs');
const path = require('path');

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
const archivos = ['logs/C1.log', 'logs/C2.log', 'logs/C3.log', 'logs/C4.log', 'logs/C5.log'];

// Leemos los eventos de los archivos
const eventos = leerLogs(archivos);

// Ordenamos los eventos por el campo 't' (tiempo)
eventos.sort((a, b) => a.t - b.t);

// Imprimimos los eventos ordenados
eventos.forEach(evento => {
    console.log(JSON.stringify(evento));
});