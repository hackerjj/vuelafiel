# VuelaAmigo backend — mismo patrón contenedor que MealLi (Docker en Render)
FROM php:8.3-cli

# curl ya viene en la imagen; servimos con el servidor embebido de PHP.
WORKDIR /app
COPY public/ /app/public/

# Render inyecta $PORT. Servimos public/ como document root.
CMD ["sh", "-c", "php -S 0.0.0.0:${PORT:-8080} -t /app/public"]
