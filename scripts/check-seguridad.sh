#!/bin/bash
# Verificaciones estáticas de seguridad. Uso: npm test
set -e
cd "$(dirname "$0")/.."

# 1. Sin manejadores inline (compatibles con la CSP)
! grep -nE ' on[a-z]+=' public/index.html \
    || { echo "FALLO: manejadores inline en index.html"; exit 1; }

# 2. SDK con versión exacta y SRI
grep -qE 'supabase-js@[0-9]+\.[0-9]+\.[0-9]+/' public/index.html \
    || { echo "FALLO: SDK sin versión exacta"; exit 1; }
grep -q 'integrity="sha384-' public/index.html \
    || { echo "FALLO: SDK sin SRI"; exit 1; }

# 3. Sin sinks HTML dinámicos en el frontend (cualquier asignación, no solo con ${})
! grep -nE '\.(innerHTML|outerHTML)[[:space:]]*=|insertAdjacentHTML|document\.write|[^a-zA-Z]eval\(' public/app.js \
    || { echo "FALLO: sink HTML dinámico en app.js"; exit 1; }

# 4. Sin service_role ni secretos (se excluye la carpeta de este script)
! grep -rnE 'service_role|sb_secret_' --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=scripts . \
    || { echo "FALLO: posible secreto en el código"; exit 1; }

# 5. Cabeceras de seguridad presentes
grep -q 'Content-Security-Policy' vercel.json \
    || { echo "FALLO: vercel.json sin CSP"; exit 1; }

echo "Pruebas de seguridad superadas."