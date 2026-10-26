package br.com.lextecnologias.messenger;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.view.View;
import android.widget.RemoteViews;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import org.json.JSONObject;

/**
 * Widget "Online agora": mostra quais contatos estão online. O app grava a lista (LexNativePlugin.updateWidget)
 * sempre que ela muda; com o app fechado, fica a última lista, com a hora em que foi atualizada.
 */
public class LexOnlineWidget extends AppWidgetProvider {
    static final String PREFS = "lex-widget";

    static JSONObject data(Context ctx) {
        try {
            return new JSONObject(ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString("data", "{}"));
        } catch (Exception e) {
            return new JSONObject();
        }
    }

    /** Chamado pelo app quando a lista de quem está online muda. */
    static void refresh(Context ctx) {
        AppWidgetManager m = AppWidgetManager.getInstance(ctx);
        int[] ids = m.getAppWidgetIds(new ComponentName(ctx, LexOnlineWidget.class));
        if (ids.length == 0) return;
        for (int id : ids) m.updateAppWidget(id, build(ctx, id));
        m.notifyAppWidgetViewDataChanged(ids, R.id.widget_list);
    }

    static RemoteViews build(Context ctx, int widgetId) {
        RemoteViews v = new RemoteViews(ctx.getPackageName(), R.layout.widget_online);
        JSONObject d = data(ctx);
        int count = d.optJSONArray("people") != null ? d.optJSONArray("people").length() : 0;
        v.setTextViewText(R.id.widget_count, String.valueOf(count));
        v.setViewVisibility(R.id.widget_count, count > 0 ? View.VISIBLE : View.GONE);
        long at = d.optLong("updatedAt", 0);
        v.setTextViewText(R.id.widget_updated, at > 0 ? "Atualizado às " + new SimpleDateFormat("HH:mm", new Locale("pt", "BR")).format(new Date(at)) : "");

        // Lista (cada linha vem do LexWidgetService).
        Intent svc = new Intent(ctx, LexWidgetService.class).putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, widgetId);
        svc.setData(Uri.parse(svc.toUri(Intent.URI_INTENT_SCHEME)));
        v.setRemoteAdapter(R.id.widget_list, svc);
        v.setEmptyView(R.id.widget_list, R.id.widget_empty);

        // Toque num contato: abre a conversa. Toque no título: abre o app.
        Intent open = new Intent(ctx, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        v.setPendingIntentTemplate(R.id.widget_list,
                PendingIntent.getActivity(ctx, 7001, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_MUTABLE));
        PendingIntent app = PendingIntent.getActivity(ctx, 7002, new Intent(ctx, MainActivity.class), PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        v.setOnClickPendingIntent(R.id.widget_header, app);
        v.setOnClickPendingIntent(R.id.widget_empty, app);
        return v;
    }

    @Override
    public void onUpdate(Context ctx, AppWidgetManager m, int[] ids) {
        for (int id : ids) m.updateAppWidget(id, build(ctx, id));
        m.notifyAppWidgetViewDataChanged(ids, R.id.widget_list);
    }
}
