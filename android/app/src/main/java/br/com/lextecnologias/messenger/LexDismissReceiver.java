package br.com.lextecnologias.messenger;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import androidx.core.app.NotificationManagerCompat;

/** Botão "Agora não" da notificação de chamar atenção: só fecha a notificação. */
public class LexDismissReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context ctx, Intent intent) {
        NotificationManagerCompat.from(ctx).cancel(intent.getIntExtra("id", 0));
    }
}
