clientes=$(grep '"clientes"' config.json | awk -F': ' '{print $2}' | tr -d ', ')
replicas=$(grep '"replicas"' config.json | awk -F': ' '{print $2}' | tr -d ', ')

echo "Clientes: $clientes"
echo "Replicas: $replicas"