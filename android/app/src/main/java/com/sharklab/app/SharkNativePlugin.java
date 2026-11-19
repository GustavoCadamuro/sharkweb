package com.sharklab.app;

import android.util.Base64;
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
        FTPClient f = secure ? new FTPSClient(false) : new FTPClient();
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
                if (dir != null && !dir.trim().isEmpty() && !f.changeWorkingDirectory(dir.trim())) {
                    throw new Exception("A pasta \"" + dir.trim() + "\" não existe no servidor.");
                }
                FTPFile[] l = f.listFiles();
                JSObject r = new JSObject();
                r.put("pwd", f.printWorkingDirectory());
                r.put("count", l == null ? 0 : l.length);
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
}
