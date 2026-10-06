/*
 * Heartbleed lab — vulnerable TLS reverse proxy.
 *
 * This process terminates TLS using OpenSSL 1.0.1f (CVE-2014-0160) and
 * forwards the decrypted HTTP request to the Spring Boot backend.
 *
 * How the demo leaks credentials:
 *   OpenSSL 1.0.1f keeps a per-context freelist for the SSL read buffer
 *   (rbuf), so the SAME ~17KB heap chunk is reused for every connection.
 *   When a client logs in, the plaintext HTTP request (including the JSON
 *   body with username/password and any Cookie/Authorization headers) is
 *   written into that read buffer. A later "heartbeat" connection reuses the
 *   same buffer; the Heartbleed bug then echoes ~16KB of memory forward from
 *   the heartbeat record, which includes the previous request's leftovers.
 *
 * Run hb_loop.py against this server while logging in via the web app to see
 * the leaked username, password, session id and cookies.
 */

#include <arpa/inet.h>
#include <errno.h>
#include <netdb.h>
#include <netinet/in.h>
#include <openssl/err.h>
#include <openssl/ssl.h>
#include <signal.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <strings.h>
#include <sys/socket.h>
#include <sys/time.h>
#include <unistd.h>

#define PORT 443
#define BACKEND_HOST "springboot-app"
#define BACKEND_PORT "8080"
#define REQ_BUF_SIZE 65536
#define BACKEND_TIMEOUT_SEC 10

static void ssl_write_all(SSL *ssl, const char *buf, int len) {
  int off = 0;
  while (off < len) {
    int n = SSL_write(ssl, buf + off, len - off);
    if (n <= 0) break;
    off += n;
  }
}

static void ssl_write_str(SSL *ssl, const char *s) {
  ssl_write_all(ssl, s, (int)strlen(s));
}

static int header_value(const char *request, const char *name, char *out, size_t out_size) {
  char needle[128];
  snprintf(needle, sizeof(needle), "\r\n%s", name);
  const char *start = strstr(request, needle);
  if (!start) {
    start = request;
    if (strncasecmp(start, name, strlen(name)) != 0) return 0;
  } else {
    start += 2; /* skip "\r\n" */
  }

  const char *end = strstr(start, "\r\n");
  if (!end) return 0;
  size_t len = (size_t)(end - start);
  if (len >= out_size) len = out_size - 1;
  memcpy(out, start, len);
  out[len] = '\0';
  return 1;
}

static int looks_like_login_request(const char *request) {
  return strstr(request, "/api/auth/login") ||
         strstr(request, "HEARTBLEED_DEMO_LOGIN") ||
         strstr(request, "\"username\"") ||
         strstr(request, "username=") ||
         strstr(request, "\"password\"") ||
         strstr(request, "password=");
}

/* Log the sensitive data captured in this decrypted request. The leak itself
 * happens later, when a heartbeat over-reads this connection's leftover data
 * from the reused SSL read buffer; this log just makes the demo easy to follow. */
static void remember_interesting_request(const char *request) {
  char cookie[2048] = "";
  char auth[4096] = "";
  int has_cookie = header_value(request, "Cookie:", cookie, sizeof(cookie));
  int has_auth = header_value(request, "Authorization:", auth, sizeof(auth));
  int has_login = looks_like_login_request(request);

  if (!has_login && !has_cookie && !has_auth) return;

  fprintf(stdout, "[lab] CAPTURED decrypted request -> login=%s cookie=%s auth=%s\n",
          has_login ? "yes" : "no",
          has_cookie ? "yes" : "no",
          has_auth ? "yes" : "no");

  if (has_login) {
    const char *body = strstr(request, "\r\n\r\n");
    fprintf(stdout, "[lab] LOGIN BODY   = %s\n", body ? body + 4 : "(body not captured)");
  }
  if (has_cookie) fprintf(stdout, "[lab] COOKIE       = %s\n", cookie);
  if (has_auth)   fprintf(stdout, "[lab] AUTHORIZATION= %s\n", auth);
  fflush(stdout);
}

static int get_content_length(const char *headers) {
  const char *p = strstr(headers, "Content-Length:");
  if (!p) p = strstr(headers, "content-length:");
  if (!p) return 0;
  return atoi(p + 15); /* strlen("Content-Length:") == 15 */
}

/* Read one full HTTP request: headers + body (per Content-Length). A single
 * SSL_read may only return part of a POST (e.g. headers in one record, body in
 * the next), so we keep reading until the whole body has arrived. */
static int read_full_request(SSL *ssl, char *buf, int buf_size) {
  int total = 0;
  int header_end = -1;
  int content_length = -1;

  while (total < buf_size - 1) {
    int n = SSL_read(ssl, buf + total, buf_size - 1 - total);
    if (n <= 0) break;
    total += n;
    buf[total] = '\0';

    if (header_end < 0) {
      const char *sep = strstr(buf, "\r\n\r\n");
      if (sep) {
        header_end = (int)(sep - buf) + 4;
        content_length = get_content_length(buf);
      }
    }

    if (header_end >= 0 && content_length >= 0 && total >= header_end + content_length) {
      break; /* complete request received */
    }
  }

  return total;
}

/* Rebuild the HTTP request so the backend always closes the connection after
 * responding: rewrite "HTTP/1.1" -> "HTTP/1.0", drop any Connection/Keep-Alive
 * headers, and add "Connection: close". Without this, Tomcat keeps the socket
 * alive and the proxy blocks in recv() waiting for EOF. */
static int rebuild_request_close(const char *in, int in_len, char *out, int out_size) {
  int pos = 0;
  const char *end = in + in_len;

  const char *line_end = strstr(in, "\r\n");
  if (!line_end) line_end = end;

  for (const char *q = in; q < line_end && pos < out_size - 2;) {
    if (q + 8 <= line_end && memcmp(q, "HTTP/1.1", 8) == 0) {
      memcpy(out + pos, "HTTP/1.0", 8);
      pos += 8;
      q += 8;
    } else {
      out[pos++] = *q++;
    }
  }
  out[pos++] = '\r';
  out[pos++] = '\n';

  const char *p = line_end + 2;
  while (p < end) {
    const char *h_end = strstr(p, "\r\n");
    if (!h_end) h_end = end;
    int h_len = (int)(h_end - p);
    if (h_len == 0) break;
    if (strncasecmp(p, "Connection:", 11) != 0 && strncasecmp(p, "Keep-Alive:", 11) != 0) {
      if (pos + h_len + 2 >= out_size) break;
      memcpy(out + pos, p, h_len);
      pos += h_len;
      out[pos++] = '\r';
      out[pos++] = '\n';
    }
    p = h_end + 2;
  }

  {
    static const char close_hdr[] = "Connection: close\r\n\r\n";
    size_t close_len = sizeof(close_hdr) - 1; /* exclude the NUL terminator */
    memcpy(out + pos, close_hdr, close_len);
    pos += (int)close_len;
  }

  const char *body = strstr(in, "\r\n\r\n");
  if (body) {
    body += 4;
    if (body < end) {
      int body_len = (int)(end - body);
      if (pos + body_len < out_size) {
        memcpy(out + pos, body, body_len);
        pos += body_len;
      }
    }
  }
  out[pos] = '\0';
  return pos;
}

static int connect_backend(void) {
  struct addrinfo hints;
  struct addrinfo *result = NULL;
  memset(&hints, 0, sizeof(hints));
  hints.ai_family = AF_UNSPEC;
  hints.ai_socktype = SOCK_STREAM;

  int rc = getaddrinfo(BACKEND_HOST, BACKEND_PORT, &hints, &result);
  if (rc != 0) {
    fprintf(stderr, "getaddrinfo backend failed: %s\n", gai_strerror(rc));
    return -1;
  }

  int fd = -1;
  for (struct addrinfo *rp = result; rp != NULL; rp = rp->ai_next) {
    fd = socket(rp->ai_family, rp->ai_socktype, rp->ai_protocol);
    if (fd == -1) continue;
    if (connect(fd, rp->ai_addr, rp->ai_addrlen) == 0) break;
    close(fd);
    fd = -1;
  }

  freeaddrinfo(result);
  return fd;
}

static void proxy_to_backend(SSL *ssl, const char *request, int request_len) {
  char *fwd = malloc(REQ_BUF_SIZE);
  if (!fwd) {
    ssl_write_str(ssl, "HTTP/1.1 502 Bad Gateway\r\nConnection: close\r\nContent-Type: text/plain\r\n\r\nOut of memory");
    return;
  }
  int fwd_len = rebuild_request_close(request, request_len, fwd, REQ_BUF_SIZE);

  int backend = connect_backend();
  if (backend < 0) {
    free(fwd);
    ssl_write_str(ssl, "HTTP/1.1 502 Bad Gateway\r\nConnection: close\r\nContent-Type: text/plain\r\n\r\nSpring Boot backend is not reachable");
    return;
  }

  struct timeval tv;
  tv.tv_sec = BACKEND_TIMEOUT_SEC;
  tv.tv_usec = 0;
  setsockopt(backend, SOL_SOCKET, SO_RCVTIMEO, &tv, sizeof(tv));

  int off = 0;
  while (off < fwd_len) {
    int w = send(backend, fwd + off, fwd_len - off, 0);
    if (w <= 0) break;
    off += w;
  }

  char buf[8192];
  int n;
  while ((n = recv(backend, buf, sizeof(buf), 0)) > 0) {
    ssl_write_all(ssl, buf, n);
  }
  close(backend);
  free(fwd);
}

static void handle_client(SSL_CTX *ctx, int client_fd) {
  SSL *ssl = SSL_new(ctx);
  if (!ssl) {
    close(client_fd);
    return;
  }

  SSL_set_fd(ssl, client_fd);
  if (SSL_accept(ssl) <= 0) {
    SSL_free(ssl);
    close(client_fd);
    return;
  }

  char *req = malloc(REQ_BUF_SIZE);
  if (!req) {
    SSL_shutdown(ssl);
    SSL_free(ssl);
    close(client_fd);
    return;
  }

  int n = read_full_request(ssl, req, REQ_BUF_SIZE);
  if (n > 0) {
    req[n] = '\0';
    remember_interesting_request(req);
    proxy_to_backend(ssl, req, n);
  }

  free(req);
  SSL_shutdown(ssl);
  SSL_free(ssl);
  close(client_fd);
}

int main(void) {
  signal(SIGPIPE, SIG_IGN);

  SSL_library_init();
  SSL_load_error_strings();
  OpenSSL_add_all_algorithms();

  SSL_CTX *ctx = SSL_CTX_new(SSLv23_server_method());
  if (!ctx) {
    ERR_print_errors_fp(stderr);
    return 1;
  }

  if (SSL_CTX_use_certificate_file(ctx, "/lab/certs/server.crt", SSL_FILETYPE_PEM) <= 0 ||
      SSL_CTX_use_PrivateKey_file(ctx, "/lab/certs/server.key", SSL_FILETYPE_PEM) <= 0) {
    ERR_print_errors_fp(stderr);
    return 1;
  }

  int server_fd = socket(AF_INET, SOCK_STREAM, 0);
  int opt = 1;
  setsockopt(server_fd, SOL_SOCKET, SO_REUSEADDR, &opt, sizeof(opt));

  struct sockaddr_in addr;
  memset(&addr, 0, sizeof(addr));
  addr.sin_family = AF_INET;
  addr.sin_addr.s_addr = INADDR_ANY;
  addr.sin_port = htons(PORT);

  if (bind(server_fd, (struct sockaddr *)&addr, sizeof(addr)) != 0 || listen(server_fd, 128) != 0) {
    perror("bind/listen");
    return 1;
  }

  fprintf(stdout, "[lab] Vulnerable OpenSSL reverse proxy listening on %d -> %s:%s (%s)\n",
          PORT, BACKEND_HOST, BACKEND_PORT, SSLeay_version(SSLEAY_VERSION));
  fprintf(stdout, "[lab] Open http://localhost/cve-heartbleed/ and log in with demo / demo123\n");
  fflush(stdout);

  while (1) {
    int client_fd = accept(server_fd, NULL, NULL);
    if (client_fd < 0) {
      if (errno == EINTR) continue;
      perror("accept");
      continue;
    }
    handle_client(ctx, client_fd);
  }
}
