FROM php:8.2-apache

RUN apt-get update \
    && apt-get install -y --no-install-recommends unzip git \
    && rm -rf /var/lib/apt/lists/* \
    && docker-php-ext-install pdo_mysql \
    && a2enmod rewrite headers

COPY docker/apache-vhost.conf /etc/apache2/sites-available/000-default.conf

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/html

COPY composer.json composer.lock ./
RUN composer install --no-dev --no-interaction --no-progress --optimize-autoloader

COPY . .

RUN composer dump-autoload --no-dev --optimize

# Versiona los assets (?v=hash + import map) para poder cachearlos por un año.
RUN php docker/version-assets.php

# Al arrancar aplica las migraciones pendientes (database/migrations/) y recién
# después levanta Apache. Si una migración falla, el contenedor no arranca.
CMD ["sh", "-c", "php bin/migrate.php && exec apache2-foreground"]
