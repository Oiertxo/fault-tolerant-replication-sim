#!/bin/bash
## Para ejecutar el sistema desde la raíz: 
## sh scripts/run_cluster.sh

# Definición de directorios para que sea más limpio
SRC="src"
CONFIG="config/config.json"
LOG_DIR="tests/logs"
DB_DIR="dbs" # Puedes moverlo a tests/dbs si prefieres

echo "--- Iniciando Simulación de Cluster ---"

# 1. Limpieza
echo "[Limpieza] Borrando logs y bases de datos anteriores..."
rm -rf $LOG_DIR
rm -rf $DB_DIR

# 2. Crear directorios necesarios
mkdir -p $LOG_DIR
# mkdir -p $DB_DIR  <-- Descomenta si tus scripts de node no crean la carpeta dbs ellos mismos

##### Ejecutar sistema #####

# 3. Ejecutar proxys
echo "[Inicio] Lanzando Proxys..."
node $SRC/proxyCM.js &
proxyCM=$!

node $SRC/proxyMR.js &
proxyMR=$!

sleep .2; # Un poco más de margen

# 4. Ejecutar secuenciador
echo "[Inicio] Lanzando Secuenciador..."
node $SRC/secuenciador.js &
secuenciador=$!

sleep .2;

# 5. Ejecutar manejadores
# Nota: Ajustamos la ruta del grep para buscar en config/
numManejadores=$(grep '"manejadores"' $CONFIG | awk -F': ' '{print $2}' | tr -d ', ')

echo "[Inicio] Lanzando $numManejadores Manejadores..."
declare -a manejadores

for i in $(seq 1 $numManejadores)
do
    node $SRC/manejador.js M$i &
    manejadores[$i]=$!
done

sleep .2;

# 6. Ejecutar replicas
numReplicas=$(grep '"replicas"' $CONFIG | awk -F': ' '{print $2}' | tr -d ', ')

echo "[Inicio] Lanzando $numReplicas Réplicas..."
declare -a replicas

for i in $(seq 1 $numReplicas)
do
    # Nota: Asegúrate de que replica.js sepa dónde crear la DB
    node $SRC/replica.js R$i db$i &
    replicas[$i]=$!
done

sleep .2;

# 7. Ejecutar clientes
numClientes=$(grep '"clientes"' $CONFIG | awk -F': ' '{print $2}' | tr -d ', ')

echo "[Inicio] Lanzando $numClientes Clientes (Logs en $LOG_DIR)..."
declare -a clientes

for i in $(seq 1 $numClientes)
do
    # Redirigimos la salida a la carpeta tests/logs
    node $SRC/cliente.js C$i > $LOG_DIR/C$i.log &  
    clientes[$i]=$!
done

# --- Fase de Ejecución ---
echo "--- Sistema en ejecución (Esperando 3 segundos) ---"
sleep 3; 

# --- Fase de Apagado ---
echo "--- Deteniendo procesos ---"

kill $proxyCM;
kill $proxyMR;
kill $secuenciador;

for i in $(seq 1 $numManejadores)
do
    kill ${manejadores[$i]};
done;

for i in $(seq 1 $numReplicas)
do
    kill ${replicas[$i]};
done;

for i in $(seq 1 $numClientes)
do
    kill ${clientes[$i]};
done;

sleep .5;

echo "--- Generando reporte de consistencia ---"

# Ajustamos rutas para los scripts de análisis
node $SRC/unify_logs.js > $LOG_DIR/unified_logs.log;
sleep .1;
node $SRC/atomicity.js $LOG_DIR/unified_logs.log > $LOG_DIR/atomicity.log;

echo "✅ Simulación Finalizada. Revisa $LOG_DIR/atomicity.log"