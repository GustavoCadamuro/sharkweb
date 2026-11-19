package com.sharklab.app;

import android.util.Base64;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;
import org.json.JSONArray;
import org.json.JSONObject;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.ByteArrayInputStream;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.apache.commons.net.ftp.FTP;
import org.apache.commons.net.ftp.FTPClient;
import org.apache.commons.net.ftp.FTPFile;
import org.apache.commons.net.ftp.FTPReply;
import org.apache.commons.net.ftp.FTPSClient;

/** Funções nativas que o navegador do celular não tem: FTP (Hostinger). */
@CapacitorPlugin(name = "SharkNative")
public class SharkNativePlugin extends Plugin {
    private final ExecutorService ex = Executors.newCachedThreadPool();
    private final Map<String, FTPClient> sessions = new HashMap<>();

    private FTPClient open(PluginCall c) throws Exception {
        String host = c.getString("host", "");
        int port = c.getInt("port", 21);
        String user = c.getString("user", "");
        String pass = c.getString("pass", "");
        boolean secure = Boolean.TRUE.equals(c.getBoolean("secure", false));
        FTPClient f;
        if (secure) {
            FTPSClient fs = new FTPSClient(false);
            fs.setTrustManager(org.apache.commons.net.util.TrustManagerUtils.getAcceptAllTrustManager());
            fs.setEndpointCheckingEnabled(false);
            f = fs;
        } else f = new FTPClient();
        f.setConnectTimeout(30000);
        f.setDefaultTimeout(60000);
        f.setControlEncoding("UTF-8");
        f.connect(host, port);
        if (!FTPReply.isPositiveCompletion(f.getReplyCode())) {
            f.disconnect();
            throw new Exception("O servidor FTP recusou a conexão.");
        }
        if (secure) {
            ((FTPSClient) f).execPBSZ(0);
            ((FTPSClient) f).execPROT("P");
        }
        if (!f.login(user, pass)) {
            String m = f.getReplyString();
            try { f.disconnect(); } catch (Exception e) {}
            throw new Exception("Usuário ou senha do FTP incorretos. " + (m == null ? "" : m.trim()));
        }
        f.enterLocalPassiveMode();
        f.setFileType(FTP.BINARY_FILE_TYPE);
        f.setDataTimeout(60000);
        return f;
    }

    private void cdMk(FTPClient f, String dir) throws Exception {
        for (String p : dir.split("/")) {
            if (p.isEmpty()) continue;
            if (!f.changeWorkingDirectory(p)) {
                if (!f.makeDirectory(p)) throw new Exception("Não consegui criar a pasta " + p + " no servidor.");
                if (!f.changeWorkingDirectory(p)) throw new Exception("Não consegui entrar na pasta " + p + ".");
            }
        }
    }

    /** Abre a conexão e entra (criando, se preciso) na pasta de destino. Devolve um id de sessão. */
    @PluginMethod
    public void ftpOpen(final PluginCall c) {
        ex.execute(() -> {
            try {
                FTPClient f = open(c);
                String dir = c.getString("dir", "");
                f.changeWorkingDirectory("/");
                if (dir != null && !dir.trim().isEmpty() && !dir.trim().equals("/")) {
                    if (dir.startsWith("/")) f.changeWorkingDirectory("/");
                    cdMk(f, dir.trim());
                }
                String id = UUID.randomUUID().toString();
                synchronized (sessions) { sessions.put(id, f); }
                JSObject r = new JSObject();
                r.put("id", id);
                r.put("pwd", f.printWorkingDirectory());
                c.resolve(r);
            } catch (Exception e) {
                c.reject(String.valueOf(e.getMessage()));
            }
        });
    }

    /** Só testa: conecta, entra na pasta e lista o que tem lá. */
    @PluginMethod
    public void ftpTest(final PluginCall c) {
        ex.execute(() -> {
            FTPClient f = null;
            try {
                f = open(c);
                String dir = c.getString("dir", "");
                boolean exists = true;
                if (dir != null && !dir.trim().isEmpty() && !dir.trim().equals("/") && !f.changeWorkingDirectory(dir.trim())) exists = false;
                JSObject r = new JSObject();
                r.put("exists", exists);
                c.resolve(r);
            } catch (Exception e) {
                c.reject(String.valueOf(e.getMessage()));
            } finally {
                try { if (f != null) { f.logout(); f.disconnect(); } } catch (Exception e) {}
            }
        });
    }

    /** Envia um arquivo (conteúdo em base64) para o caminho relativo à pasta da sessão. */
    @PluginMethod
    public void ftpPut(final PluginCall c) {
        ex.execute(() -> {
            try {
                FTPClient f;
                synchronized (sessions) { f = sessions.get(c.getString("id")); }
                if (f == null) throw new Exception("Sessão FTP expirada.");
                String root = f.printWorkingDirectory();
                String path = c.getString("path", "");
                byte[] data = Base64.decode(c.getString("b64", ""), Base64.DEFAULT);
                int i = path.lastIndexOf('/');
                String dir = i > 0 ? path.substring(0, i) : "";
                String name = i >= 0 ? path.substring(i + 1) : path;
                f.changeWorkingDirectory(root);
                if (!dir.isEmpty()) cdMk(f, dir);
                boolean ok = f.storeFile(name, new ByteArrayInputStream(data));
                f.changeWorkingDirectory(root);
                if (!ok) throw new Exception("Falhou ao enviar " + path + ": " + String.valueOf(f.getReplyString()).trim());
                c.resolve();
            } catch (Exception e) {
                c.reject(String.valueOf(e.getMessage()));
            }
        });
    }

    @PluginMethod
    public void ftpClose(final PluginCall c) {
        ex.execute(() -> {
            FTPClient f;
            synchronized (sessions) { f = sessions.remove(c.getString("id")); }
            try { if (f != null) { f.logout(); f.disconnect(); } } catch (Exception e) {}
            c.resolve();
        });
    }

    /* ---------- HTTP sem as restrições (CORS) do navegador ---------- */
    static class Resp { int code; String url; byte[] body; Map<String, String> headers = new HashMap<>(); String mime = "application/octet-stream"; String enc = null; }

    static byte[] readAll(InputStream is, int max) throws Exception {
        if (is == null) return new byte[0];
        ByteArrayOutputStream o = new ByteArrayOutputStream();
        byte[] b = new byte[16384]; int n;
        while ((n = is.read(b)) > 0) { o.write(b, 0, n); if (max > 0 && o.size() > max) throw new Exception("Arquivo grande demais."); }
        is.close();
        return o.toByteArray();
    }

    static Resp doFetch(String url, String method, Map<String, String> headers, byte[] body, int max) throws Exception {
        String cur = url; String m = method == null ? "GET" : method;
        for (int hop = 0; hop < 8; hop++) {
            HttpURLConnection u = (HttpURLConnection) new URL(cur).openConnection();
            u.setConnectTimeout(30000); u.setReadTimeout(60000); u.setInstanceFollowRedirects(false);
            u.setRequestMethod(m);
            if (headers != null) for (Map.Entry<String, String> e : headers.entrySet()) {
                String k = e.getKey(); if (k.equalsIgnoreCase("host") || k.equalsIgnoreCase("content-length") || k.equalsIgnoreCase("accept-encoding")) continue;
                u.setRequestProperty(k, e.getValue());
            }
            String ck = CookieManager.getInstance().getCookie(cur);
            if (ck != null && (headers == null || !headers.containsKey("Cookie"))) u.setRequestProperty("Cookie", ck);
            if (body != null && body.length > 0 && !m.equals("GET") && !m.equals("HEAD")) { u.setDoOutput(true); u.getOutputStream().write(body); }
            int code = u.getResponseCode();
            Map<String, List<String>> hf = u.getHeaderFields();
            List<String> sc = hf == null ? null : hf.get("Set-Cookie");
            if (sc != null) for (String s : sc) CookieManager.getInstance().setCookie(cur, s);
            if (code >= 300 && code < 400 && u.getHeaderField("Location") != null && hop < 7) {
                cur = new URL(new URL(cur), u.getHeaderField("Location")).toString();
                if (code == 301 || code == 302 || code == 303) { m = "GET"; body = null; }
                u.disconnect(); continue;
            }
            Resp r = new Resp(); r.code = code; r.url = cur;
            r.body = readAll(code >= 400 ? u.getErrorStream() : u.getInputStream(), max);
            if (hf != null) for (Map.Entry<String, List<String>> e : hf.entrySet()) { if (e.getKey() == null || e.getValue() == null || e.getValue().isEmpty()) continue; r.headers.put(e.getKey(), android.text.TextUtils.join(", ", e.getValue())); }
            String ct = u.getContentType();
            if (ct != null) { String[] p = ct.split(";"); r.mime = p[0].trim(); for (String q : p) { q = q.trim(); if (q.toLowerCase().startsWith("charset=")) r.enc = q.substring(8); } }
            u.disconnect();
            return r;
        }
        throw new Exception("Redirecionamentos demais.");
    }

    @PluginMethod
    public void http(final PluginCall c) {
        ex.execute(() -> {
            try {
                Map<String, String> h = new HashMap<>();
                JSObject ho = c.getObject("headers");
                if (ho != null) { Iterator<String> it = ho.keys(); while (it.hasNext()) { String k = it.next(); h.put(k, ho.getString(k)); } }
                String b64 = c.getString("b64");
                byte[] body = (b64 == null || b64.isEmpty()) ? null : Base64.decode(b64, Base64.DEFAULT);
                Resp r = doFetch(c.getString("url"), c.getString("method", "GET"), h, body, 0);
                JSObject o = new JSObject(); o.put("status", r.code); o.put("url", r.url);
                JSObject hh = new JSObject(); for (Map.Entry<String, String> e : r.headers.entrySet()) hh.put(e.getKey(), e.getValue());
                o.put("headers", hh); o.put("b64", Base64.encodeToString(r.body, Base64.NO_WRAP));
                c.resolve(o);
            } catch (Exception e) { c.reject(String.valueOf(e.getMessage())); }
        });
    }

    /* ---------- Clonar: abre a página num navegador escondido e grava tudo que ela carrega ---------- */
    static class Rec { String url, mime; boolean main; File f; long size; }
    private final Map<String, List<Rec>> clones = new HashMap<>();

    @SuppressLint("SetJavaScriptEnabled")
    @PluginMethod
    public void cloneStart(final PluginCall c) {
        final String start = c.getString("url", "");
        final Activity act = getActivity();
        final String ticket = UUID.randomUUID().toString();
        final File dir = new File(act.getCacheDir(), "clone-" + ticket); dir.mkdirs();
        ex.execute(() -> {
            try {
                // descobre o endereço final (redirecionamentos) antes de abrir
                Map<String, String> hh = new HashMap<>(); hh.put("Accept", "text/html,*/*");
                Resp pre = doFetch(start, "GET", hh, null, 8 * 1024 * 1024);
                final String fin = pre.url;
                final List<Rec> recs = new ArrayList<>();
                final AtomicInteger inflight = new AtomicInteger(0);
                final long[] last = { System.currentTimeMillis() };
                final boolean[] mainSeen = { false };
                final WebView[] wv = new WebView[1];
                final Object lock = new Object();
                final boolean[] ready = { false };
                new Handler(Looper.getMainLooper()).post(() -> {
                    WebView w = new WebView(act);
                    wv[0] = w;
                    WebSettings s = w.getSettings();
                    s.setJavaScriptEnabled(true); s.setDomStorageEnabled(true); s.setMediaPlaybackRequiresUserGesture(true);
                    s.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW); s.setLoadWithOverviewMode(false);
                    CookieManager.getInstance().setAcceptThirdPartyCookies(w, true);
                    w.setAlpha(0f);
                    ViewGroup.LayoutParams lp = new ViewGroup.LayoutParams(act.getResources().getDisplayMetrics().widthPixels, act.getResources().getDisplayMetrics().heightPixels);
                    act.addContentView(w, lp);
                    w.setWebViewClient(new WebViewClient() {
                        @Override public WebResourceResponse shouldInterceptRequest(WebView v, WebResourceRequest rq) {
                            try {
                                if (!"GET".equalsIgnoreCase(rq.getMethod())) return null;
                                String u = rq.getUrl().toString();
                                if (!u.startsWith("http")) return null;
                                Map<String, String> rh = rq.getRequestHeaders();
                                if (rh != null && rh.containsKey("Range")) return null;
                                inflight.incrementAndGet(); last[0] = System.currentTimeMillis();
                                try {
                                    Resp r = doFetch(u, "GET", rh, null, 40 * 1024 * 1024);
                                    Rec rc = new Rec(); rc.url = r.url; rc.mime = r.mime; rc.size = r.body.length;
                                    boolean isMain = rq.isForMainFrame() && !mainSeen[0];
                                    if (isMain) { mainSeen[0] = true; rc.main = true; }
                                    if (r.code < 300) {
                                        rc.f = new File(dir, String.valueOf(recs.size()) + ".bin");
                                        FileOutputStream fo = new FileOutputStream(rc.f); fo.write(r.body); fo.close();
                                        synchronized (recs) { recs.add(rc); }
                                    }
                                    Map<String, String> oh = new HashMap<>(r.headers);
                                    WebResourceResponse out = new WebResourceResponse(r.mime, r.enc, r.code < 100 ? 200 : r.code, "OK", oh, new java.io.ByteArrayInputStream(r.body));
                                    return out;
                                } finally { inflight.decrementAndGet(); last[0] = System.currentTimeMillis(); }
                            } catch (Exception e) { return null; }
                        }
                        @Override public void onPageFinished(WebView v, String u) { last[0] = System.currentTimeMillis(); synchronized (lock) { ready[0] = true; } }
                    });
                    w.loadUrl(fin);
                });
                long t0 = System.currentTimeMillis();
                while (System.currentTimeMillis() - t0 < 30000) {
                    synchronized (lock) { if (ready[0]) break; }
                    Thread.sleep(80);
                }
                if (!ready[0]) throw new Exception("O site demorou demais para responder.");
                waitIdle(inflight, last, 500, 6000);
                // rola a página inteira para carregar imagens preguiçosas
                new Handler(Looper.getMainLooper()).post(() -> wv[0].evaluateJavascript("(async()=>{const h=document.documentElement.scrollHeight;for(let y=0;y<h;y+=700){scrollTo(0,y);await new Promise(r=>setTimeout(r,80))}scrollTo(0,0)})()", null));
                Thread.sleep(1200);
                waitIdle(inflight, last, 450, 5000);
                // miniatura
                final String[] thumb = { "" };
                final Object tl = new Object(); final boolean[] td = { false };
                new Handler(Looper.getMainLooper()).post(() -> {
                    try {
                        WebView w = wv[0]; int ww = w.getWidth(), hh2 = w.getHeight();
                        if (ww > 0 && hh2 > 0) {
                            Bitmap b = Bitmap.createBitmap(ww, hh2, Bitmap.Config.ARGB_8888);
                            w.setAlpha(1f); w.draw(new Canvas(b)); w.setAlpha(0f);
                            int tw = 640, th = Math.max(1, (int) ((long) hh2 * tw / ww));
                            Bitmap sc = Bitmap.createScaledBitmap(b, tw, th, true);
                            ByteArrayOutputStream bo = new ByteArrayOutputStream(); sc.compress(Bitmap.CompressFormat.JPEG, 70, bo);
                            thumb[0] = Base64.encodeToString(bo.toByteArray(), Base64.NO_WRAP);
                        }
                    } catch (Throwable e) {}
                    synchronized (tl) { td[0] = true; tl.notifyAll(); }
                });
                synchronized (tl) { if (!td[0]) tl.wait(4000); }
                final String[] fu = { fin };
                final Object ul = new Object(); final boolean[] ud = { false };
                new Handler(Looper.getMainLooper()).post(() -> {
                    try { String cu = wv[0].getUrl(); if (cu != null && cu.startsWith("http")) fu[0] = cu; } catch (Throwable e) {}
                    try { ((ViewGroup) wv[0].getParent()).removeView(wv[0]); wv[0].destroy(); } catch (Throwable e) {}
                    synchronized (ul) { ud[0] = true; ul.notifyAll(); }
                });
                synchronized (ul) { if (!ud[0]) ul.wait(3000); }
                synchronized (clones) { clones.put(ticket, recs); }
                JSObject o = new JSObject(); o.put("ticket", ticket); o.put("url", fu[0]); o.put("thumb", thumb[0]);
                JSONArray arr = new JSONArray();
                synchronized (recs) { for (int i = 0; i < recs.size(); i++) { Rec r = recs.get(i); JSONObject j = new JSONObject(); j.put("i", i); j.put("u", r.url); j.put("t", r.mime); j.put("main", r.main); j.put("n", r.size); arr.put(j); } }
                o.put("files", arr);
                c.resolve(o);
            } catch (Exception e) {
                c.reject(String.valueOf(e.getMessage()));
            }
        });
    }

    private void waitIdle(AtomicInteger inflight, long[] last, long quiet, long max) throws Exception {
        long t = System.currentTimeMillis();
        while (System.currentTimeMillis() - t < max && (inflight.get() > 0 || System.currentTimeMillis() - last[0] < quiet)) Thread.sleep(40);
    }

    @PluginMethod
    public void cloneRead(final PluginCall c) {
        ex.execute(() -> {
            try {
                List<Rec> recs; synchronized (clones) { recs = clones.get(c.getString("ticket")); }
                if (recs == null) throw new Exception("Captura expirada.");
                Rec r; synchronized (recs) { r = recs.get(c.getInt("i", 0)); }
                JSObject o = new JSObject(); o.put("b64", Base64.encodeToString(readAll(new FileInputStream(r.f), 0), Base64.NO_WRAP));
                c.resolve(o);
            } catch (Exception e) { c.reject(String.valueOf(e.getMessage())); }
        });
    }

    @PluginMethod
    public void cloneDone(final PluginCall c) {
        ex.execute(() -> {
            String tk = c.getString("ticket", "");
            synchronized (clones) { clones.remove(tk); }
            File d = new File(getActivity().getCacheDir(), "clone-" + tk);
            File[] l = d.listFiles(); if (l != null) for (File f : l) f.delete();
            d.delete();
            c.resolve();
        });
    }
}
