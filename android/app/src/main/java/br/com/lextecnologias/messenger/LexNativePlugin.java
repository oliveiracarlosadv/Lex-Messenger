package br.com.lextecnologias.messenger;

import android.content.ComponentName;
import android.content.Context;
import android.media.MediaMetadata;
import android.media.session.MediaController;
import android.media.session.MediaSessionManager;
import android.media.session.PlaybackState;
import androidx.core.app.NotificationManagerCompat;
import java.util.List;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Funções nativas do Android usadas pelo Lex: segundo plano, bateria e ajustes de notificação. */
@CapacitorPlugin(name = "LexNative")
public class LexNativePlugin extends Plugin {

    @PluginMethod
    public void startKeepAlive(PluginCall call) {
        Context ctx = getContext();
        ContextCompat.startForegroundService(ctx, new Intent(ctx, KeepAliveService.class));
        call.resolve();
    }

    @PluginMethod
    public void stopKeepAlive(PluginCall call) {
        Context ctx = getContext();
        ctx.stopService(new Intent(ctx, KeepAliveService.class));
        call.resolve();
    }

    @PluginMethod
    public void batteryStatus(PluginCall call) {
        PowerManager pm = (PowerManager) getContext().getSystemService(Context.POWER_SERVICE);
        JSObject r = new JSObject();
        r.put("unrestricted", Build.VERSION.SDK_INT < 23 || pm.isIgnoringBatteryOptimizations(getContext().getPackageName()));
        call.resolve(r);
    }

    /** Abre o pedido do sistema: "Permitir que o app seja executado em segundo plano?". */
    @PluginMethod
    public void requestBatteryExemption(PluginCall call) {
        try {
            Intent i = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
            i.setData(Uri.parse("package:" + getContext().getPackageName()));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(i);
        } catch (Exception e) {
            Intent i = new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(i);
        }
        call.resolve();
    }

    @PluginMethod
    public void openNotificationSettings(PluginCall call) {
        Intent i = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
                .putExtra(Settings.EXTRA_APP_PACKAGE, getContext().getPackageName())
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(i);
        call.resolve();
    }

    // ---------- Música que estou ouvindo ----------

    @PluginMethod
    public void musicAccess(PluginCall call) {
        JSObject r = new JSObject();
        r.put("granted", NotificationManagerCompat.getEnabledListenerPackages(getContext()).contains(getContext().getPackageName()));
        call.resolve(r);
    }

    /** Abre "Acesso a notificações" para o usuário liberar o Lex (necessário para ver a música tocando). */
    @PluginMethod
    public void requestMusicAccess(PluginCall call) {
        Intent i = new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(i);
        call.resolve();
    }

    /** Devolve a música tocando agora (título e artista), ou nada. */
    @PluginMethod
    public void nowPlaying(PluginCall call) {
        JSObject r = new JSObject();
        try {
            MediaSessionManager msm = (MediaSessionManager) getContext().getSystemService(Context.MEDIA_SESSION_SERVICE);
            List<MediaController> sessions = msm.getActiveSessions(new ComponentName(getContext(), LexMusicListener.class));
            for (MediaController c : sessions) {
                PlaybackState st = c.getPlaybackState();
                MediaMetadata md = c.getMetadata();
                if (st == null || md == null || st.getState() != PlaybackState.STATE_PLAYING) continue;
                String title = md.getString(MediaMetadata.METADATA_KEY_TITLE);
                String artist = md.getString(MediaMetadata.METADATA_KEY_ARTIST);
                if (artist == null) artist = md.getString(MediaMetadata.METADATA_KEY_ALBUM_ARTIST);
                if (title == null || title.isEmpty()) continue;
                r.put("title", title);
                r.put("artist", artist == null ? "" : artist);
                break;
            }
            r.put("granted", true);
        } catch (SecurityException e) {
            r.put("granted", false);
        }
        call.resolve(r);
    }

    // ---------- Notificações com foto ----------

    static LexNativePlugin instance;
    static String pendingChat;

    @Override
    public void load() {
        instance = this;
    }

    /** Alguém tocou numa notificação: abre a conversa (ou guarda até o app carregar). */
    static void opened(String chatId) {
        if (chatId == null) return;
        if (instance != null && instance.hasListeners("notificationOpen")) {
            JSObject d = new JSObject();
            d.put("chatId", chatId);
            instance.notifyListeners("notificationOpen", d);
        } else pendingChat = chatId;
    }

    @PluginMethod
    public void takePendingOpen(PluginCall call) {
        JSObject r = new JSObject();
        r.put("chatId", pendingChat);
        pendingChat = null;
        call.resolve(r);
    }

    @PluginMethod
    public void notify(PluginCall call) {
        LexNotifier.show(
                getContext(),
                call.getInt("id", 1),
                call.getString("chatId", ""),
                call.getString("title", "Lex Messenger"),
                call.getString("body", ""),
                call.getString("avatar", null),
                Boolean.TRUE.equals(call.getBoolean("silent", false)),
                Boolean.TRUE.equals(call.getBoolean("nudge", false)));
        call.resolve();
    }

    @PluginMethod
    public void cancel(PluginCall call) {
        try {
            org.json.JSONArray ids = call.getArray("ids");
            for (int i = 0; i < ids.length(); i++) NotificationManagerCompat.from(getContext()).cancel(ids.getInt(i));
        } catch (Exception ignored) {
        }
        call.resolve();
    }

    // ---------- Push (Firebase) ----------

    /** Prepara o push: devolve o token do Firebase e a chave deste aparelho (ou nada, se o Firebase não estiver configurado). */
    @PluginMethod
    public void pushSetup(PluginCall call) {
        byte[] key = LexPushService.pushKey(getContext());
        try {
            com.google.firebase.messaging.FirebaseMessaging.getInstance().getToken().addOnCompleteListener(t -> {
                JSObject r = new JSObject();
                if (t.isSuccessful() && t.getResult() != null) {
                    r.put("token", t.getResult());
                    r.put("secret", android.util.Base64.encodeToString(key, android.util.Base64.NO_WRAP));
                }
                call.resolve(r);
            });
        } catch (Exception e) {
            call.resolve(new JSObject()); // Firebase não configurado neste aplicativo
        }
    }

    /** O modo silencioso também vale para as notificações push. */
    @PluginMethod
    public void pushSilent(PluginCall call) {
        getContext().getSharedPreferences(LexPushService.PREFS, Context.MODE_PRIVATE).edit().putBoolean("silent", Boolean.TRUE.equals(call.getBoolean("silent", false))).apply();
        call.resolve();
    }

    /** Guarda a foto de um contato para usar nas notificações push (que chegam com o app fechado). */
    @PluginMethod
    public void cacheAvatar(PluginCall call) {
        String id = call.getString("chatId");
        String b64 = call.getString("avatar");
        if (id != null && b64 != null && b64.length() < 200_000)
            getContext().getSharedPreferences("lex-avatars", Context.MODE_PRIVATE).edit().putString(id, b64).apply();
        call.resolve();
    }

    @PluginMethod
    public void clearAvatars(PluginCall call) {
        getContext().getSharedPreferences("lex-avatars", Context.MODE_PRIVATE).edit().clear().apply();
        call.resolve();
    }
}
