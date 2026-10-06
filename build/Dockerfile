FROM debian:bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        build-essential \
        perl \
        ca-certificates \
        make \
        libc6-dev \
        zlib1g-dev && \
    rm -rf /var/lib/apt/lists/*

COPY openssl-1.0.1f.tar.gz /tmp/

RUN cd /tmp && \
    tar -xzf openssl-1.0.1f.tar.gz && \
    cd openssl-1.0.1f && \
    ./config no-asm --prefix=/opt/openssl-1.0.1f shared && \
    make -j1 && \
    make install_sw

ENV PATH="/opt/openssl-1.0.1f/bin:${PATH}"
ENV LD_LIBRARY_PATH="/opt/openssl-1.0.1f/lib"

RUN openssl version

RUN mkdir -p /lab/certs && \
    openssl req -x509 -newkey rsa:2048 -nodes \
    -keyout /lab/certs/server.key \
    -out /lab/certs/server.crt \
    -days 3650 \
    -subj "/CN=heartbleed-lab"

COPY web /lab/web
COPY heartbleed_lab_server.c /tmp/heartbleed_lab_server.c

RUN gcc -I/opt/openssl-1.0.1f/include \
    /tmp/heartbleed_lab_server.c \
    -L/opt/openssl-1.0.1f/lib \
    -Wl,-rpath,/opt/openssl-1.0.1f/lib \
    -lssl -lcrypto \
    -o /usr/local/bin/heartbleed_lab_server

WORKDIR /lab/web

EXPOSE 443

CMD ["/usr/local/bin/heartbleed_lab_server"]
