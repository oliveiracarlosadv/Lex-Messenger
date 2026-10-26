package br.com.lextecnologias.messenger;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Base64;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Arrays;
import javax.crypto.Cipher;
import javax.crypto.spec.SecretKeySpec;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Notificações push do Telegram (via Firebase), como no app oficial: chegam na hora, mesmo com o
 * Lex fechado e sem o aviso fixo "Conectado ao Telegram".
 *
 * O Telegram manda o conteúdo criptografado com uma chave criada neste aparelho ("chave de push",
 * entregue ao Telegram no registro). Só este aparelho consegue ler.
 */
public class LexPushService extends FirebaseMessagingService {
    static final String PREFS = "lex-push";
    static final String NUDGE_TEXT = "📳 Chamou sua atenção!";

    /** Chave de 256 bytes deste aparelho (criada uma vez). */
    static byte[] pushKey(Context ctx) {
        SharedPreferences sp = ctx.getSharedPreferences(PREFS, MODE_PRIVATE);
        String k = sp.getString("key", null);
        if (k != null) return Base64.decode(k, Base64.NO_WRAP);
        byte[] key = new byte[256];
        new SecureRandom().nextBytes(key);
        sp.edit().putString("key", Base64.encodeToString(key, Base64.NO_WRAP)).apply();
        return key;
    }

    @Override
    public void onNewToken(String token) {
        getSharedPreferences(PREFS, MODE_PRIVATE).edit().putString("token", token).putBoolean("tokenChanged", true).apply();
    }

    /** Guarda o que aconteceu com o último aviso (aparece em Configurações > Avisos). */
    void note(String result) {
        SharedPreferences sp = getSharedPreferences(PREFS, MODE_PRIVATE);
        sp.edit().putLong("lastAt", System.currentTimeMillis()).putString("lastResult", result).putInt("count", sp.getInt("count", 0) + 1).apply();
    }

    @Override
    public void onMessageReceived(RemoteMessage message) {
        try {
            java.util.Map<String, String> data = message.getData();
            String p = data.get("p");
            if (MainActivity.visible) {
                note("app aberto (o próprio app avisou)");
                return;
            }
            JSONObject json = null;
            if (p != null) {
                try {
                    json = decrypt(pushKey(this), Base64.decode(p, Base64.URL_SAFE | Base64.NO_WRAP));
                } catch (Exception e) {
                    json = null;
                }
                if (json == null) {
                    note("chegou, mas não deu para ler (chave)");
                    int id = (int) (System.currentTimeMillis() & 0x7fffffff);
                    LexNotifier.show(this, id, "", "Lex Messenger", "Nova mensagem no Telegram", null, false, false);
                    return;
                }
            } else if (data.containsKey("loc_key")) {
                json = new JSONObject();
                json.put("loc_key", data.get("loc_key"));
                String a = data.get("loc_args");
                json.put("loc_args", a != null ? new JSONArray(a) : new JSONArray());
                String c = data.get("custom");
                if (c != null) json.put("custom", new JSONObject(c));
            } else {
                note("chegou sem conteúdo: " + data.keySet());
                return;
            }
            note(show(json) ? "mostrado" : "aviso do sistema (" + json.optString("loc_key", "sem tipo") + ")");
        } catch (Exception e) {
            note("erro: " + e.getClass().getSimpleName());
        }
    }

    // ---------- Decifrar (MTProto 2.0, mensagem vinda do servidor: x = 8) ----------

    static byte[] sha256(byte[]... parts) throws Exception {
        MessageDigest md = MessageDigest.getInstance("SHA-256");
        for (byte[] b : parts) md.update(b);
        return md.digest();
    }

    static byte[] slice(byte[] b, int from, int len) {
        return Arrays.copyOfRange(b, from, from + len);
    }

    static JSONObject decrypt(byte[] key, byte[] data) throws Exception {
        if (data.length < 24 + 16) return null;
        byte[] msgKey = slice(data, 8, 16);
        byte[] enc = slice(data, 24, data.length - 24);
        int x = 8;
        byte[] a = sha256(msgKey, slice(key, x, 36));
        byte[] b = sha256(slice(key, 40 + x, 36), msgKey);
        byte[] aesKey = new byte[32];
        byte[] aesIv = new byte[32];
        System.arraycopy(a, 0, aesKey, 0, 8);
        System.arraycopy(b, 8, aesKey, 8, 16);
        System.arraycopy(a, 24, aesKey, 24, 8);
        System.arraycopy(b, 0, aesIv, 0, 8);
        System.arraycopy(a, 8, aesIv, 8, 16);
        System.arraycopy(b, 24, aesIv, 24, 8);
        byte[] plain = igeDecrypt(enc, aesKey, aesIv);
        // Confere a integridade (msg_key = parte do SHA-256 da chave + texto).
        byte[] check = sha256(slice(key, 88 + x, 32), plain);
        if (!Arrays.equals(slice(check, 8, 16), msgKey)) return null;
        int len = ByteBuffer.wrap(plain, 0, 4).order(ByteOrder.LITTLE_ENDIAN).getInt();
        if (len <= 0 || len > plain.length - 4) return null;
        return new JSONObject(new String(plain, 4, len, StandardCharsets.UTF_8));
    }

    static byte[] igeDecrypt(byte[] data, byte[] key, byte[] iv) throws Exception {
        Cipher c = Cipher.getInstance("AES/ECB/NoPadding");
        c.init(Cipher.DECRYPT_MODE, new SecretKeySpec(key, "AES"));
        byte[] out = new byte[data.length];
        // IGE: m[i] = D(c[i] xor m[i-1]) xor c[i-1]; começa com c[-1] = iv[0..16) e m[-1] = iv[16..32).
        byte[] prevX = slice(iv, 16, 16); // texto claro anterior
        byte[] prevY = slice(iv, 0, 16); // bloco cifrado anterior
        for (int i = 0; i < data.length; i += 16) {
            byte[] block = slice(data, i, 16);
            byte[] t = new byte[16];
            for (int j = 0; j < 16; j++) t[j] = (byte) (block[j] ^ prevX[j]);
            byte[] d = c.doFinal(t);
            for (int j = 0; j < 16; j++) d[j] ^= prevY[j];
            System.arraycopy(d, 0, out, i, 16);
            prevX = d;
            prevY = block;
        }
        return out;
    }

    // ---------- Mostrar ----------

    static String peerId(JSONObject custom) {
        if (custom == null) return "";
        if (custom.has("channel_id")) return "-100" + custom.optString("channel_id");
        if (custom.has("chat_id")) return "-" + custom.optString("chat_id");
        return custom.optString("from_id", "");
    }

    boolean show(JSONObject json) throws Exception {
        String locKey = json.optString("loc_key", "");
        JSONArray args = json.optJSONArray("loc_args");
        JSONObject custom = json.optJSONObject("custom");
        if (locKey.isEmpty() || args == null || args.length() == 0) return false; // ex.: aviso de leitura em outro aparelho
        String chatId = peerId(custom);
        String who = args.optString(0, "Alguém");
        boolean group = locKey.startsWith("CHAT_") || locKey.startsWith("CHANNEL_");
        String where = group && args.length() > 1 ? args.optString(1, "") : "";
        String last = args.optString(args.length() - 1, "");
        String body;
        if (locKey.endsWith("_TEXT") || locKey.endsWith("_NOTEXT")) body = last;
        else if (locKey.contains("PHOTO")) body = "📷 Foto";
        else if (locKey.contains("ROUND")) body = "⭕ Recado";
        else if (locKey.contains("VIDEO")) body = "🎬 Vídeo";
        else if (locKey.contains("AUDIO") || locKey.contains("VOICE")) body = "🎤 Mensagem de voz";
        else if (locKey.contains("STICKER")) body = "🙂 Figurinha";
        else if (locKey.contains("GIF")) body = "🎞️ GIF";
        else if (locKey.contains("DOC")) body = "📎 Arquivo";
        else body = "Nova mensagem";
        boolean nudge = NUDGE_TEXT.equals(body);
        boolean silent = getSharedPreferences(PREFS, MODE_PRIVATE).getBoolean("silent", false);
        String title = nudge ? "📳 " + who + " chamou a sua atenção!" : group && !where.isEmpty() ? who + " em " + where : who;
        if (nudge) body = "Deseja abrir a conversa?";
        String avatar = getSharedPreferences("lex-avatars", MODE_PRIVATE).getString(chatId, null);
        int id = (int) (System.currentTimeMillis() & 0x7fffffff);
        LexNotifier.show(this, id, chatId, title, body, avatar, silent, nudge);
        return true;
    }
}
