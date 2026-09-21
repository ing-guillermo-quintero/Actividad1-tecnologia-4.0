#!/bin/bash
set -e
! grep -nE ' on(click|submit|change)=' public/index.html   || { echo "Handlers inline"; exit 1; }
grep -q 'integrity="sha384-' public/index.html             || { echo "SDK sin SRI"; exit 1; }
! grep -nE 'tr\.innerHTML|\.innerHTML *= *`[^`]*\$\{' public/app.js || { echo "innerHTML con datos"; exit 1; }
! grep -rnE 'service_role' --exclude-dir=node_modules --exclude-dir=.git . || { echo "service_role encontrando"; exit 1; }
echo "Pruebas de seguridad superadas."