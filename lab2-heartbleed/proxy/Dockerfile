# Proxy TLS đứng trước backend thật.
# - OPENSSL_VERSION=1.0.1f (mặc định) -> stunnel link với OpenSSL DÍNH Heartbleed.
# - OPENSSL_VERSION=1.0.1g                -> stunnel link với OpenSSL ĐÃ VÁ (đối chứng).
#
# Đây chính là mô hình các vụ Heartbleed thật năm 2014: backend/app hoàn toàn
# không có lỗi, lỗi nằm ở phần mềm làm TLS termination (ở đây là stunnel,
# thực tế là nginx/Apache cũng bị vì cùng dùng thư viện OpenSSL hệ thống).

FROM ubuntu:20.04 AS build
ARG OPENSSL_VERSION=1.0.1f
ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y \
    build-essential \
    perl \
    wget \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /tmp/build

# 1) Build OpenSSL từ source (bản lỗi hoặc bản vá tùy ARG).
#    Tải từ GitHub tag chính thức của OpenSSL (mirror openssl-library.org không
#    giữ đủ mọi bản cũ — một số version trả 404). Tách thành nhiều RUN riêng
#    (không gộp bằng "||" fallback) để nếu lỗi, log hiện đúng bước/đúng output thật.
RUN echo "Build OpenSSL version: ${OPENSSL_VERSION}"

RUN GH_TAG="OpenSSL_$(echo ${OPENSSL_VERSION} | tr '.' '_')" && \
    echo "Tai tu GitHub tag: ${GH_TAG}" && \
    wget -v -O openssl-src.tar.gz "https://github.com/openssl/openssl/archive/refs/tags/${GH_TAG}.tar.gz"

RUN mkdir -p openssl-${OPENSSL_VERSION} && \
    tar -tzf openssl-src.tar.gz | head -n 3 && \
    tar -xzf openssl-src.tar.gz -C openssl-${OPENSSL_VERSION} --strip-components=1

RUN cd openssl-${OPENSSL_VERSION} && ./config --prefix=/opt/openssl shared

# QUAN TRỌNG: KHÔNG dùng "-j2"/parallel build ở đây. Makefile của OpenSSL
# 1.0.1x không khai báo đúng thứ tự phụ thuộc giữa việc build thư viện
# chia sẻ (libssl.so/libcrypto.so) và việc link app CLI "openssl" — build
# song song (-j2) có thể link app trước khi thư viện build xong hoàn
# chỉnh, gây lỗi "undefined reference" tới hàng loạt symbol. Build tuần
# tự (make, không -j) để tránh race condition này.
RUN cd openssl-${OPENSSL_VERSION} && make

RUN cd openssl-${OPENSSL_VERSION} && make install_sw

# 2) Build stunnel (bản cũ 4.56, tương thích API OpenSSL 1.0.1), LINK với
#    đúng bản OpenSSL vừa build ở bước 1 (không dùng OpenSSL hệ thống của Ubuntu).
RUN wget -v -O stunnel-src.tar.gz "https://www.stunnel.org/archive/4.x/stunnel-4.56.tar.gz"

RUN mkdir -p stunnel-4.56 && \
    tar -tzf stunnel-src.tar.gz | head -n 3 && \
    tar -xzf stunnel-src.tar.gz -C stunnel-4.56 --strip-components=1

RUN cd stunnel-4.56 && \
    ./configure --prefix=/opt/stunnel --with-ssl=/opt/openssl \
      LDFLAGS="-Wl,-rpath,/opt/openssl/lib"

RUN cd stunnel-4.56 && make -j2

RUN cd stunnel-4.56 && make install

FROM ubuntu:20.04
RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*

COPY --from=build /opt/openssl /opt/openssl
COPY --from=build /opt/stunnel /opt/stunnel
ENV LD_LIBRARY_PATH=/opt/openssl/lib

RUN mkdir -p /lab \
    && /opt/openssl/bin/openssl req \
       -new -x509 -nodes -days 3650 \
       -subj "/CN=localhost" \
       -keyout /lab/server.key \
       -out /lab/server.crt \
    && cat /lab/server.key /lab/server.crt > /lab/stunnel.pem

COPY stunnel.conf /lab/stunnel.conf

EXPOSE 8443

CMD ["/opt/stunnel/bin/stunnel", "/lab/stunnel.conf"]
