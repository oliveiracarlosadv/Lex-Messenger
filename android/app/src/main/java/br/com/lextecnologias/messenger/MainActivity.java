package br.com.lextecnologias.messenger;

import android.os.Bundle;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(LexNativePlugin.class);
        super.onCreate(savedInstanceState);
        WebView wv = getBridge().getWebView();
        // Sons de aviso tocam sem precisar de um toque na tela antes.
        wv.getSettings().setMediaPlaybackRequiresUserGesture(false);
        // A página do app continua com prioridade mesmo fora da tela (para receber mensagens).
        wv.setRendererPriorityPolicy(WebView.RENDERER_PRIORITY_IMPORTANT, false);
    }
}
