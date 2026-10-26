package br.com.lextecnologias.messenger;

import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.util.Base64;
import android.widget.RemoteViews;
import android.widget.RemoteViewsService;
import org.json.JSONArray;
import org.json.JSONObject;

/** Linhas do widget "Online agora". */
public class LexWidgetService extends RemoteViewsService {
    @Override
    public RemoteViewsFactory onGetViewFactory(Intent intent) {
        return new Factory(getApplicationContext());
    }

    static class Factory implements RemoteViewsFactory {
        private final Context ctx;
        private JSONArray people = new JSONArray();

        Factory(Context ctx) {
            this.ctx = ctx;
        }

        @Override
        public void onCreate() {}

        @Override
        public void onDataSetChanged() {
            JSONArray p = LexOnlineWidget.data(ctx).optJSONArray("people");
            people = p != null ? p : new JSONArray();
        }

        @Override
        public void onDestroy() {}

        @Override
        public int getCount() {
            return people.length();
        }

        static int colorOf(String c) {
            if ("busy".equals(c)) return 0xFFD64545;
            if ("away".equals(c)) return 0xFFF0A020;
            return 0xFF2EBD5B;
        }

        @Override
        public RemoteViews getViewAt(int i) {
            RemoteViews v = new RemoteViews(ctx.getPackageName(), R.layout.widget_item);
            JSONObject p = people.optJSONObject(i);
            if (p == null) return v;
            String id = p.optString("id"), name = p.optString("name");
            v.setTextViewText(R.id.item_name, name);
            v.setTextViewText(R.id.item_status, p.optString("status"));
            v.setInt(R.id.item_dot, "setColorFilter", colorOf(p.optString("color")));
            Bitmap photo = null;
            String b64 = p.optString("photo", "");
            if (!b64.isEmpty()) {
                try {
                    byte[] bytes = Base64.decode(b64, Base64.DEFAULT);
                    Bitmap b = BitmapFactory.decodeByteArray(bytes, 0, bytes.length);
                    if (b != null) photo = LexNotifier.circle(Bitmap.createScaledBitmap(b, 96, 96, true));
                } catch (Exception ignored) {
                }
            }
            v.setImageViewBitmap(R.id.item_photo, photo != null ? photo : LexNotifier.initials(name, id));
            v.setOnClickFillInIntent(R.id.item_root, new Intent().putExtra(LexNotifier.EXTRA_CHAT, id));
            return v;
        }

        @Override
        public RemoteViews getLoadingView() {
            return null;
        }

        @Override
        public int getViewTypeCount() {
            return 1;
        }

        @Override
        public long getItemId(int i) {
            return i;
        }

        @Override
        public boolean hasStableIds() {
            return false;
        }
    }
}
