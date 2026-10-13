server {

    server_name boykovdocs.ru www.boykovdocs.ru;

    client_max_body_size 20M;

    location / {
        proxy_pass http://127.0.0.1:8080;

        proxy_http_version 1.1;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Port $server_port;
    }

    listen [::]:443 ssl ipv6only=on; # managed by Certbot
    listen 443 ssl; # managed by Certbot
    ssl_certificate /etc/letsencrypt/live/boykovdocs.ru/fullchain.pem; # managed by Certbot
    ssl_certificate_key /etc/letsencrypt/live/boykovdocs.ru/privkey.pem; # managed by Certbot
    include /etc/nginx/snippets/options-ssl-boykovdocs.conf; # managed by Certbot
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem; # managed by Certbot


}
server {
    if ($host = www.boykovdocs.ru) {
        return 301 https://$host$request_uri;
    } # managed by Certbot


    if ($host = boykovdocs.ru) {
        return 301 https://$host$request_uri;
    } # managed by Certbot


    listen 80;
    listen [::]:80;

    server_name boykovdocs.ru www.boykovdocs.ru;
    return 404; # managed by Certbot




}
