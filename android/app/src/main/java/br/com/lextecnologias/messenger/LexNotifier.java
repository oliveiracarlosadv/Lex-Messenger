package br.com.lextecnologias.messenger;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.PorterDuff;
import android.graphics.PorterDuffXfermode;
import android.graphics.Rect;
import android.os.Build;
import android.util.Base64;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.app.Person;
import androidx.core.graphics.drawable.IconCompat;

/** Notificações do Lex com a foto (redonda) de quem mandou. */
public class LexNotifier {
    static final String CH_MSG = "mensagens";
    static final String CH_SILENT = "silencioso";
    static final String EXTRA_CHAT = "lexChatId";

    static void channels(Context ctx) {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager nm = ctx.getSystemService(NotificationManager.class);
        if (nm.getNotificationChannel(CH_MSG) == null) {
            NotificationChannel c = new NotificationChannel(CH_MSG, "Mensagens", NotificationManager.IMPORTANCE_HIGH);
            c.setDescription("Mensagens novas e chamadas de atenção");
            c.enableVibration(true);
            c.enableLights(true);
            c.setLightColor(0xFF2B6CC4);
            nm.createNotificationChannel(c);
        }
        if (nm.getNotificationChannel(CH_SILENT) == null) {
            NotificationChannel c = new NotificationChannel(CH_SILENT, "Mensagens (silencioso)", NotificationManager.IMPORTANCE_LOW);
            c.enableVibration(false);
            c.setSound(null, null);
            nm.createNotificationChannel(c);
        }
    }

    static Bitmap circle(Bitmap src) {
        int size = Math.min(src.getWidth(), src.getHeight());
        Bitmap out = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(out);
        Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);
        canvas.drawCircle(size / 2f, size / 2f, size / 2f, p);
        p.setXfermode(new PorterDuffXfermode(PorterDuff.Mode.SRC_IN));
        int dx = (src.getWidth() - size) / 2, dy = (src.getHeight() - size) / 2;
        canvas.drawBitmap(src, new Rect(dx, dy, dx + size, dy + size), new Rect(0, 0, size, size), p);
        return out;
    }

    static PendingIntent openIntent(Context ctx, String chatId, int requestCode) {
        Intent i = new Intent(ctx, MainActivity.class)
                .putExtra(EXTRA_CHAT, chatId)
                .addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        return PendingIntent.getActivity(ctx, requestCode, i, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    static void show(Context ctx, int id, String chatId, String title, String body, String avatarB64, boolean silent, boolean nudge) {
        channels(ctx);
        Bitmap avatar = null;
        if (avatarB64 != null && !avatarB64.isEmpty()) {
            try {
                byte[] bytes = Base64.decode(avatarB64, Base64.DEFAULT);
                Bitmap b = BitmapFactory.decodeByteArray(bytes, 0, bytes.length);
                if (b != null) avatar = circle(b);
            } catch (Exception ignored) {
            }
        }
        Person.Builder pb = new Person.Builder().setName(title);
        if (avatar != null) pb.setIcon(IconCompat.createWithBitmap(avatar));
        Person sender = pb.build();
        NotificationCompat.MessagingStyle style = new NotificationCompat.MessagingStyle(new Person.Builder().setName("Você").build())
                .addMessage(body, System.currentTimeMillis(), sender);

        NotificationCompat.Builder n = new NotificationCompat.Builder(ctx, silent ? CH_SILENT : CH_MSG)
                .setSmallIcon(R.drawable.ic_stat_lex)
                .setColor(0xFF2B6CC4)
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(style)
                .setAutoCancel(true)
                .setCategory(NotificationCompat.CATEGORY_MESSAGE)
                .setPriority(silent ? NotificationCompat.PRIORITY_LOW : NotificationCompat.PRIORITY_HIGH)
                .setGroup(chatId)
                .setContentIntent(openIntent(ctx, chatId, id));
        if (avatar != null) n.setLargeIcon(avatar);
        if (nudge) {
            n.addAction(0, "Abrir conversa", openIntent(ctx, chatId, id + 100000));
            Intent later = new Intent(ctx, LexDismissReceiver.class).putExtra("id", id);
            n.addAction(0, "Agora não", PendingIntent.getBroadcast(ctx, id + 200000, later, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT));
        }
        try {
            NotificationManagerCompat.from(ctx).notify(id, n.build());
        } catch (SecurityException ignored) {
            // sem permissão de notificações
        }
    }
}
